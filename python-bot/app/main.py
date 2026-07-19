"""app.main — entry point. Starts the aiogram bot with long polling.

Wires up:
- All routers (commands + callbacks + catch-all message router)
- Heartbeat worker (every 20s → updates BotHeartbeat row)
- Command queue worker (every 2s → polls BotCommand table)
- Graceful shutdown on SIGTERM / SIGINT
- BotFather command list (so /start /help etc. show up in Telegram's menu)

Run:
    python -m app.main
"""
from __future__ import annotations

import asyncio
import signal
import sys
from typing import Any, Dict, Optional

from aiogram import Bot, Dispatcher, F, types
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext

from app.config import settings
from app.db import db, Queries
from app.utils.logger import get_logger
from app.utils.heartbeat import HeartbeatWorker
from app.services.command_queue import CommandQueueWorker
from app.services.ai import ai as ai_service

log = get_logger("app.main")

# Import routers after logger is configured.
from app.handlers.start import router as start_router, handle_onboarding_message
from app.handlers.help import router as help_router
from app.handlers.daily import router as daily_router
from app.handlers.readings import router as readings_router, handle_reading_numbers_message, handle_dream_message
from app.handlers.profile import router as profile_router
from app.handlers.referral import router as referral_router
from app.handlers.admin import router as admin_router
from app.handlers.callback import router as callback_router


# BotFather command list (shown in Telegram's "/" menu).
BOT_COMMANDS = [
    types.BotCommand(command="start",         description="Запустить бота / Start"),
    types.BotCommand(command="help",          description="Помощь / Help"),
    types.BotCommand(command="daily",         description="Карта дня / Card of the day"),
    types.BotCommand(command="readings",      description="Расклады / Readings"),
    types.BotCommand(command="profile",       description="Профиль / Profile"),
    types.BotCommand(command="referral",      description="Реферал / Referral"),
    types.BotCommand(command="memory",        description="Память / Memory"),
    types.BotCommand(command="subscription",  description="Подписка / Subscription"),
    types.BotCommand(command="admin",         description="Админ-панель / Admin (admins only)"),
    types.BotCommand(command="cancel",        description="Отмена / Cancel"),
]


# ---- Catch-all text message router (handles onboarding / dream / readings FSM) ----


async def _catch_all_text(message: types.Message) -> None:
    """Route non-command text messages based on user.onboardingStep."""
    if not message.from_user or not message.text:
        return
    # Skip messages that start with a slash (commands handled elsewhere).
    if message.text.startswith("/"):
        return
    tg_id = str(message.from_user.id)
    user = await Queries.find_user_by_telegram_id(tg_id)
    if not user:
        # No user record — prompt /start.
        from app.i18n import t
        await message.answer(t("ru", "err_unknown_user"))
        return
    loc = user.get("language", "ru")
    if user.get("isBlocked"):
        from app.i18n import t
        await message.answer(t(loc, "err_blocked"))
        return

    step = user.get("onboardingStep", "")

    # Onboarding states.
    if step in ("ASK_NAME", "ASK_BIRTH_DATE", "ASK_BIRTH_TIME",
                "ASK_BIRTH_PLACE", "ASK_GENDER", "ASK_AGE_GROUP", "PROBING"):
        handled = await handle_onboarding_message(message)
        if handled:
            return

    # AWAIT_NUMBERS — user is typing card numbers for a reading.
    if step == "AWAIT_NUMBERS":
        handled = await handle_reading_numbers_message(message)
        if handled:
            return

    # DREAM — user is describing a dream.
    if step == "DREAM":
        handled = await handle_dream_message(message)
        if handled:
            return

    # AWAIT_DELETE_CONFIRM — user replied to the "delete data?" prompt.
    if step == "AWAIT_DELETE_CONFIRM":
        from app.i18n import t
        from app.keyboards.inline import main_menu_keyboard
        lower = message.text.lower().strip()
        if lower in ("да", "yes", "y", "удалить", "delete"):
            await Queries.delete_user(tg_id)
            await Queries.record_audit(
                actor_id=tg_id, action="delete_own_data", target_user_id=user["id"]
            )
            await message.answer(t(loc, "profile_deleted"))
        else:
            await Queries.set_user_state(tg_id, "CONVERSATION")
            await message.answer(
                t(loc, "profile_delete_cancelled"),
                reply_markup=main_menu_keyboard(user),
            )
        return

    # BROADCAST state — admin is typing broadcast text.
    if step == "BROADCAST" and settings.is_admin(tg_id):
        await _admin_broadcast_inline(message, user)
        return

    # Default — conversation. Free chat with Sofia.
    await _free_chat(message, user)


async def _admin_broadcast_inline(message: types.Message, user: Dict[str, Any]) -> None:
    """Handle broadcast text typed by an admin in BROADCAST state."""
    import asyncio
    from datetime import datetime
    from app.db import Queries
    from app.i18n import t
    from app.keyboards.inline import admin_panel_keyboard

    loc = user.get("language", "ru")
    tg_id = user["telegramId"]
    text = (message.text or "").strip()
    if not text:
        await message.answer(t(loc, "admin_broadcast_no_text"))
        return
    bot = message.bot
    recipients = await Queries.list_users_for_broadcast(limit=2000)
    bc_id = await Queries.create_broadcast(tg_id, text, len(recipients))
    await message.answer(t(loc, "admin_broadcast_launched", id=bc_id))
    sent = 0
    failed = 0
    for r in recipients:
        try:
            await bot.send_message(r["telegramId"], text)
            sent += 1
        except Exception as e:
            log.warning("broadcast_send_failed", extra={
                "telegram_id": r["telegramId"], "err": str(e),
            })
            failed += 1
        await asyncio.sleep(0.05)
    await Queries.mark_broadcast_sent(bc_id, sent, failed)
    await Queries.record_audit(
        actor_id=tg_id, action="broadcast",
        details=f"sent={sent} failed={failed}",
    )
    await Queries.set_user_state(tg_id, "ADMIN_PANEL")
    await message.answer(
        loc == "en"
        and f"✅ Broadcast done. Sent: {sent}, failed: {failed}."
        or f"✅ Рассылка завершена. Отправлено: {sent}, не удалось: {failed}.",
        reply_markup=admin_panel_keyboard(loc),
    )


async def _free_chat(message: types.Message, user: Dict[str, Any]) -> None:
    """Free-form conversation. Saves to history + asks Sofia for a reply."""
    from datetime import datetime, timedelta
    from app.i18n import t
    from app.keyboards.inline import main_menu_keyboard
    from app.services.ai import ai, LLMError
    from app.services.memory import build_context_for_llm, extract_and_store
    from app.db import Queries

    loc = user.get("language", "ru")
    text = message.text[:2000]
    tg_id = user["telegramId"]

    # Save user message.
    await Queries.save_conversation(user["id"], "user", text)

    # Update activity counters.
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    last_msg_date = user.get("dailyMessageDate")
    if isinstance(last_msg_date, str):
        try:
            last_msg_date = datetime.fromisoformat(last_msg_date.replace("Z", "+00:00"))
        except ValueError:
            last_msg_date = None
    if isinstance(last_msg_date, datetime) and last_msg_date.tzinfo is not None:
        last_msg_date = last_msg_date.replace(tzinfo=None)

    if last_msg_date and last_msg_date >= today:
        daily_count = int(user.get("dailyMessageCount") or 0) + 1
    else:
        daily_count = 1
    msg_count = int(user.get("messageCount") or 0) + 1
    user = await Queries.update_user(
        tg_id, messageCount=msg_count, dailyMessageCount=daily_count, dailyMessageDate=today
    ) or user

    # Build memory context.
    try:
        memory_ctx = await build_context_for_llm(user, limit=8)
    except Exception as e:
        log.warning("memory_context_failed", extra={"err": str(e)})
        memory_ctx = ""

    # Sofia reply.
    try:
        from app.services.ai import SOFIA_SYSTEM_PROMPT
        reply = await ai_service.generate(
            system_prompt=SOFIA_SYSTEM_PROMPT,
            user_message=text,
            memory_context=memory_ctx,
            max_tokens=500,
            timeout=15.0,
        )
    except LLMError as e:
        log.warning("free_chat_llm_failed", extra={"err": str(e)})
        reply = (
            loc == "en"
            and "The mist is thick today. Sit with me a moment, then ask again. 🌙"
            or "Туман сегодня густой. Посиди со мной минуту — и спроси снова. 🌙"
        )

    # Save Sofia's reply.
    await Queries.save_conversation(user["id"], "sofia", reply)

    # Periodically extract memory (every 5 messages today).
    if daily_count % 5 == 0:
        try:
            recent = await Queries.recent_conversations(user["id"], limit=10)
            recent_text = "\n".join(
                f"{m['role']}: {m['content']}" for m in reversed(recent)
            )
            asyncio.create_task(
                extract_and_store(user_row=user, recent_dialogue=recent_text)
            )
        except Exception as e:
            log.warning("memory_extract_dispatch_failed", extra={"err": str(e)})

    # Send reply.
    try:
        await message.answer(reply)
    except Exception as e:
        log.error("send_reply_failed", extra={"err": str(e)})


# ---- Bot lifecycle ----


async def _on_startup(bot: Bot) -> None:
    """Called once before polling starts."""
    log.info("bot_starting", extra={
        "version": settings.bot_version,
        "username": settings.bot_username,
        "postgres": settings.is_postgres,
    })
    # DB connect.
    await db.connect()
    # Set BotFather commands.
    try:
        await bot.set_my_commands(BOT_COMMANDS)
        log.info("bot_commands_set", extra={"count": len(BOT_COMMANDS)})
    except Exception as e:
        log.warning("set_my_commands_failed", extra={"err": str(e)})
    # Verify bot token by fetching me.
    try:
        me = await bot.get_me()
        log.info("bot_verified", extra={
            "id": me.id, "username": me.username, "first_name": me.first_name,
        })
    except Exception as e:
        log.error("bot_verify_failed", extra={"err": str(e)})
        raise


async def _on_shutdown(bot: Bot) -> None:
    """Called once on graceful shutdown."""
    log.info("bot_stopping")
    try:
        await bot.session.close()
    except Exception:
        pass
    try:
        await ai_service.close()
    except Exception:
        pass
    try:
        await db.disconnect()
    except Exception:
        pass
    log.info("bot_stopped")


async def main() -> None:
    """Main async entry point."""
    bot = Bot(
        token=settings.bot_token,
        default=DefaultBotProperties(parse_mode=ParseMode.HTML),
    )
    dp = Dispatcher()

    # Register routers in this order so commands win over catch-all.
    dp.include_router(start_router)
    dp.include_router(help_router)
    dp.include_router(daily_router)
    dp.include_router(readings_router)
    dp.include_router(profile_router)
    dp.include_router(referral_router)
    dp.include_router(admin_router)
    dp.include_router(callback_router)

    # Catch-all text message handler — registered as a separate router that
    # is included LAST so command handlers in the routers above take precedence.
    fallback_router = Router(name="fallback")
    fallback_router.message.register(_catch_all_text, F.text)
    dp.include_router(fallback_router)

    # Startup / shutdown hooks.
    dp.startup.register(_on_startup)
    dp.shutdown.register(_on_shutdown)

    # Background workers.
    heartbeat = HeartbeatWorker()
    cmd_queue = CommandQueueWorker(bot=bot)

    # Wire graceful shutdown.
    main_task: Optional[asyncio.Task] = None
    shutdown_event = asyncio.Event()

    def _signal_handler(*_: Any) -> None:
        log.info("signal_received")
        if main_task and not main_task.done():
            main_task.cancel()

    # SIGTERM (Render / k8s) and SIGINT (Ctrl-C).
    try:
        loop = asyncio.get_running_loop()
        for sig in (signal.SIGTERM, signal.SIGINT):
            loop.add_signal_handler(sig, _signal_handler)
    except NotImplementedError:
        # Windows fallback.
        signal.signal(signal.SIGTERM, _signal_handler)  # type: ignore[arg-type]
        signal.signal(signal.SIGINT, _signal_handler)  # type: ignore[arg-type]

    # Start background workers after DB is up.
    await _on_startup(bot)
    heartbeat.start()
    cmd_queue.start()

    # Long polling loop.
    log.info("long_polling_started")
    try:
        await dp.start_polling(bot, allowed_updates=dp.resolve_used_update_types())
    except asyncio.CancelledError:
        log.info("polling_cancelled")
    finally:
        # Stop workers.
        await heartbeat.stop()
        await cmd_queue.stop()
        await _on_shutdown(bot)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nInterrupted.", file=sys.stderr)
        sys.exit(0)
