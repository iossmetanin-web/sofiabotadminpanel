"""app.handlers.admin — /admin command and admin helpers.

Admin-only commands:
  /admin          — show admin panel
  /add @username N — gift N crystals to a user by username
  /broadcast TEXT — broadcast to all users (or use the panel)

Admin permission is checked via `settings.is_admin(telegram_id)`.
"""
from __future__ import annotations

import asyncio
from typing import Any, Dict, List

from aiogram import Bot, Router, types
from aiogram.filters import Command, CommandObject

from app.config import settings
from app.db import Queries
from app.i18n import t
from app.keyboards.inline import admin_panel_keyboard, main_menu_keyboard
from app.services import crystals as crystal_service
from app.utils.logger import get_logger

log = get_logger("app.handlers.admin")

router = Router(name="admin")


def _is_admin(message: types.Message) -> bool:
    return bool(message.from_user and settings.is_admin(message.from_user.id))


@router.message(Command("admin"))
async def cmd_admin(message: types.Message) -> None:
    if not message.from_user:
        return
    if not _is_admin(message):
        await message.answer(t("ru", "admin_forbidden"))
        return
    tg_id = str(message.from_user.id)
    user = await Queries.find_user_by_telegram_id(tg_id)
    loc = user.get("language", "ru") if user else "ru"
    await Queries.set_user_state(tg_id, "ADMIN_PANEL")
    await message.answer(
        t(loc, "admin_panel_title"),
        reply_markup=admin_panel_keyboard(loc),
    )


@router.message(Command("add"))
async def cmd_add(message: types.Message, command: CommandObject) -> None:
    """/add @username N — gift N crystals to a user."""
    if not _is_admin(message):
        await message.answer(t("ru", "admin_forbidden"))
        return
    tg_id = str(message.from_user.id)
    admin_user = await Queries.find_user_by_telegram_id(tg_id)
    loc = admin_user.get("language", "ru") if admin_user else "ru"

    args = (command.args or "").split()
    if len(args) < 2:
        await message.answer(t(loc, "admin_add_format"))
        return
    target_handle = args[0].lstrip("@").strip()
    try:
        amount = int(args[1])
    except ValueError:
        await message.answer(t(loc, "admin_add_format"))
        return
    if amount <= 0:
        await message.answer(t(loc, "admin_add_format"))
        return

    target = await Queries.find_user_by_username(target_handle)
    if not target:
        await message.answer(t(loc, "admin_not_found", username=target_handle))
        return

    updated = await crystal_service.gift_crystals(
        admin_telegram_id=tg_id,
        target_user_row=target,
        amount=amount,
    )
    await message.answer(
        t(loc, "admin_add_done",
          username=target_handle,
          amount=amount,
          balance=updated["crystals"]),
    )


@router.message(Command("broadcast"))
async def cmd_broadcast(message: types.Message, command: CommandObject) -> None:
    """/broadcast TEXT — broadcast to all onboarded, non-blocked users."""
    if not _is_admin(message):
        await message.answer(t("ru", "admin_forbidden"))
        return
    tg_id = str(message.from_user.id)
    admin_user = await Queries.find_user_by_telegram_id(tg_id)
    loc = admin_user.get("language", "ru") if admin_user else "ru"

    text = (command.args or "").strip()
    if not text:
        await message.answer(t(loc, "admin_broadcast_no_text"))
        return

    bot: Bot = message.bot
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
                "telegram_id": r["telegramId"], "err": str(e)
            })
            failed += 1
        await asyncio.sleep(0.05)  # throttle

    await Queries.mark_broadcast_sent(bc_id, sent, failed)
    await Queries.record_audit(
        actor_id=tg_id,
        action="broadcast",
        details=f"sent={sent} failed={failed}",
    )
    summary = (
        loc == "en"
        and f"✅ Broadcast done. Sent: {sent}, failed: {failed}."
        or f"✅ Рассылка завершена. Отправлено: {sent}, не удалось: {failed}."
    )
    await message.answer(summary, reply_markup=admin_panel_keyboard(loc))


# ---- Stats rendering (used by callback handler) ----

async def render_stats(loc: str) -> str:
    from datetime import datetime, timedelta
    total = await Queries.count_users()
    active = await Queries.count_active_since(datetime.utcnow() - timedelta(hours=24))
    onboarded = await Queries.count_onboarded()
    msgs = await Queries.count_conversations()
    readings = await Queries.count_readings()
    spent = await Queries.sum_crystals_spent()
    if loc == "en":
        return (
            "📊 <b>Stats</b>\n\n"
            f"Users: <b>{total}</b>\n"
            f"Active 24h: <b>{active}</b>\n"
            f"Onboarded: <b>{onboarded}</b>\n"
            f"Messages: <b>{msgs}</b>\n"
            f"Readings: <b>{readings}</b>\n"
            f"💎 Crystals spent: <b>{spent}</b>"
        )
    return (
        "📊 <b>Статистика</b>\n\n"
        f"Пользователей: <b>{total}</b>\n"
        f"Активны за 24ч: <b>{active}</b>\n"
        f"Завершили онбординг: <b>{onboarded}</b>\n"
        f"Сообщений всего: <b>{msgs}</b>\n"
        f"Раскладов всего: <b>{readings}</b>\n"
        f"💎 Кристаллов потрачено: <b>{spent}</b>"
    )


async def render_users_page(page: int, loc: str) -> tuple:
    """Return (text, total_pages) for the users pagination view."""
    limit = 10
    total = await Queries.count_users()
    total_pages = max(1, (total + limit - 1) // limit)
    offset = (page - 1) * limit
    users = await Queries.list_users_paginated(offset, limit)

    def _esc(s: Any) -> str:
        return str(s).replace("<", "&lt;").replace(">", "&gt;")

    title = (
        loc == "en"
        and f"<b>👥 Users ({page}/{total_pages})</b>"
        or f"<b>👥 Пользователи ({page}/{total_pages})</b>"
    )
    lines: List[str] = [title, ""]
    for u in users:
        name = _esc(u.get("name") or u.get("firstName") or "—")
        uname = _esc(u.get("username") or "—")
        crystals = u.get("crystals", 0)
        step = u.get("onboardingStep", "?")
        lines.append(f"• {name} @{uname} · 💎{crystals} · {step}")
    return "\n".join(lines), total_pages
