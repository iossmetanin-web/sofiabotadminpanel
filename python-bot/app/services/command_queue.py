"""app.services.command_queue — polls BotCommand table and executes admin commands.

The admin panel (Next.js / Vercel) is serverless and can't hold a long-polling
connection. It inserts rows into `BotCommand`; this worker polls every 2s and
executes them. Each command is atomically claimed (status: pending → processing)
before execution to avoid double-processing if the bot restarts mid-flight.

Supported command types:
  broadcast        payload: {"text": "..."}
  dm               payload: {"telegramId": "...", "text": "..."}
  ban              payload: {"telegramId": "..."}
  unban            payload: {"telegramId": "..."}
  gift_crystals    payload: {"telegramId": "...", "amount": 5}
  set_subscription payload: {"telegramId": "...", "type": "monthly", "days": 30}
  reload_config    payload: {}
  shutdown         payload: {} (admin only — graceful shutdown)
"""
from __future__ import annotations

import asyncio
import json
import os
import signal
from datetime import datetime, timedelta
from typing import Any, Dict, Optional

from aiogram import Bot
from aiogram.exceptions import TelegramForbiddenError, TelegramRetryAfter

from app.config import settings
from app.db import Queries
from app.services import crystals as crystal_service
from app.utils.logger import get_logger

log = get_logger("app.command_queue")


class CommandQueueWorker:
    """Background task that polls + executes admin commands."""

    def __init__(
        self,
        bot: Bot,
        interval_seconds: int = settings.command_queue_interval_seconds,
        batch_size: int = 10,
    ) -> None:
        self._bot = bot
        self._interval = interval_seconds
        self._batch = batch_size
        self._task: Optional[asyncio.Task[None]] = None
        self._stop = asyncio.Event()
        # Config cache — reloaded on `reload_config` command.
        self._config_cache: Dict[str, str] = {}
        self._shutdown_requested = False

    async def _loop(self) -> None:
        log.info("command_queue_started", extra={"interval": self._interval})
        # Prime config cache on startup.
        try:
            self._config_cache = await Queries.all_config()
        except Exception as e:
            log.warning("config_cache_init_failed", extra={"err": str(e)})

        while not self._stop.is_set():
            try:
                commands = await Queries.fetch_pending_commands(self._batch)
                for cmd in commands:
                    await self._process_one(cmd)
            except Exception as e:
                log.error("command_queue_iteration_failed", extra={"err": str(e)})

            if self._shutdown_requested:
                log.info("command_queue_shutdown_requested")
                self._request_process_shutdown()
                break

            try:
                await asyncio.wait_for(self._stop.wait(), timeout=self._interval)
            except asyncio.TimeoutError:
                continue
        log.info("command_queue_stopped")

    async def _process_one(self, cmd: Dict[str, Any]) -> None:
        cmd_id = cmd["id"]
        cmd_type = cmd["type"]
        # Atomic claim — only proceed if we won the claim.
        try:
            won = await Queries.claim_command(cmd_id)
        except Exception as e:
            log.warning("claim_command_failed", extra={"cmd_id": cmd_id, "err": str(e)})
            return
        if not won:
            return

        try:
            payload = json.loads(cmd.get("payload") or "{}")
        except (ValueError, TypeError) as e:
            await Queries.finish_command(cmd_id, "failed", {"error": f"bad payload: {e}"})
            return

        log.info("command_processing", extra={
            "cmd_id": cmd_id, "type": cmd_type, "payload_keys": list(payload.keys())
        })

        try:
            result = await self._dispatch(cmd_type, payload)
            await Queries.finish_command(cmd_id, "done", result)
        except Exception as e:
            log.error("command_failed", extra={"cmd_id": cmd_id, "type": cmd_type, "err": str(e)})
            await Queries.finish_command(cmd_id, "failed", {"error": str(e)})

    async def _dispatch(self, cmd_type: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        handler = {
            "broadcast": self._cmd_broadcast,
            "dm": self._cmd_dm,
            "ban": self._cmd_ban,
            "unban": self._cmd_unban,
            "gift_crystals": self._cmd_gift_crystals,
            "set_subscription": self._cmd_set_subscription,
            "reload_config": self._cmd_reload_config,
            "shutdown": self._cmd_shutdown,
        }.get(cmd_type)
        if not handler:
            raise ValueError(f"unknown command type: {cmd_type}")
        return await handler(payload)

    # ---- handlers ----

    async def _cmd_broadcast(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        text = (payload.get("text") or "").strip()
        if not text:
            return {"error": "empty text"}
        recipients = await Queries.list_users_for_broadcast(limit=2000)
        sent = 0
        failed = 0
        # Record a Broadcast row for audit.
        bc_id = await Queries.create_broadcast("admin", text, len(recipients))
        for r in recipients:
            try:
                await self._bot.send_message(r["telegramId"], text)
                sent += 1
            except TelegramRetryAfter as e:
                # Telegram says "slow down" — wait and retry once.
                await asyncio.sleep(e.retry_after or 1)
                try:
                    await self._bot.send_message(r["telegramId"], text)
                    sent += 1
                except Exception:
                    failed += 1
            except (TelegramForbiddenError, Exception):
                failed += 1
            # Soft throttle to stay under Telegram's ~30 msg/sec limit.
            await asyncio.sleep(0.05)
        await Queries.mark_broadcast_sent(bc_id, sent, failed)
        await Queries.record_audit(
            actor_id="admin",
            action="broadcast",
            details=f"sent={sent} failed={failed}",
        )
        return {"sent": sent, "failed": failed, "total": len(recipients), "broadcast_id": bc_id}

    async def _cmd_dm(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        telegram_id = str(payload.get("telegramId") or "").strip()
        text = (payload.get("text") or "").strip()
        if not telegram_id or not text:
            return {"error": "telegramId and text required"}
        try:
            await self._bot.send_message(telegram_id, text)
            return {"sent": True}
        except TelegramRetryAfter as e:
            await asyncio.sleep(e.retry_after or 1)
            await self._bot.send_message(telegram_id, text)
            return {"sent": True, "retried": True}

    async def _cmd_ban(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        return await self._set_block(payload, blocked=True)

    async def _cmd_unban(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        return await self._set_block(payload, blocked=False)

    async def _set_block(self, payload: Dict[str, Any], *, blocked: bool) -> Dict[str, Any]:
        telegram_id = str(payload.get("telegramId") or "").strip()
        if not telegram_id:
            return {"error": "telegramId required"}
        user = await Queries.find_user_by_telegram_id(telegram_id)
        if not user:
            return {"error": "user not found"}
        await Queries.update_user(telegram_id, isBlocked=blocked)
        await Queries.record_audit(
            actor_id="admin",
            action="ban" if blocked else "unban",
            target_user_id=user["id"],
        )
        return {"telegramId": telegram_id, "blocked": blocked}

    async def _cmd_gift_crystals(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        telegram_id = str(payload.get("telegramId") or "").strip()
        amount = int(payload.get("amount") or 0)
        if not telegram_id or amount <= 0:
            return {"error": "telegramId and positive amount required"}
        user = await Queries.find_user_by_telegram_id(telegram_id)
        if not user:
            return {"error": "user not found"}
        updated = await crystal_service.gift_crystals(
            admin_telegram_id="admin",
            target_user_row=user,
            amount=amount,
        )
        return {"telegramId": telegram_id, "new_balance": updated["crystals"]}

    async def _cmd_set_subscription(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        telegram_id = str(payload.get("telegramId") or "").strip()
        sub_type = (payload.get("type") or "").strip()
        days = int(payload.get("days") or 0)
        if not telegram_id or sub_type not in ("weekly", "monthly") or days <= 0:
            return {"error": "telegramId, type (weekly|monthly), days (>0) required"}
        user = await Queries.find_user_by_telegram_id(telegram_id)
        if not user:
            return {"error": "user not found"}
        updated = await crystal_service.apply_subscription(
            user_row=user, sub_type=sub_type, days=days
        )
        await Queries.record_audit(
            actor_id="admin",
            action="set_subscription",
            target_user_id=user["id"],
            details=f"type={sub_type} days={days}",
        )
        return {
            "telegramId": telegram_id,
            "subscriptionType": updated["subscriptionType"],
            "subscriptionUntil": updated["subscriptionUntil"].isoformat()
                if isinstance(updated["subscriptionUntil"], datetime)
                else str(updated["subscriptionUntil"]),
        }

    async def _cmd_reload_config(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        self._config_cache = await Queries.all_config()
        log.info("config_reloaded", extra={"keys": list(self._config_cache.keys())})
        return {"keys": list(self._config_cache.keys())}

    async def _cmd_shutdown(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        # Only admins can enqueue a shutdown (verified at admin panel level);
        # here we just honour it.
        self._shutdown_requested = True
        return {"shutdown": True}

    # ---- lifecycle ----

    def start(self) -> None:
        if self._task is None or self._task.done():
            self._stop = asyncio.Event()
            self._shutdown_requested = False
            self._task = asyncio.create_task(self._loop(), name="command_queue")

    async def stop(self) -> None:
        self._stop.set()
        if self._task and not self._task.done():
            try:
                await asyncio.wait_for(self._task, timeout=5)
            except (asyncio.TimeoutError, asyncio.CancelledError):
                self._task.cancel()

    def _request_process_shutdown(self) -> None:
        """Send SIGTERM to ourselves for graceful shutdown."""
        try:
            os.kill(os.getpid(), signal.SIGTERM)
        except Exception as e:
            log.error("failed_to_signal_shutdown", extra={"err": str(e)})
