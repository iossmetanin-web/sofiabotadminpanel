"""app.handlers.profile — /profile, /memory, /subscription commands."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict

from aiogram import Router, types
from aiogram.filters import Command

from app.db import Queries
from app.i18n import t
from app.keyboards.inline import (
    main_menu_keyboard, delete_confirm_keyboard, subscription_keyboard,
    home_only_keyboard,
)
from app.services import crystals as crystal_service
from app.services.memory import format_memory_for_user
from app.utils.logger import get_logger

log = get_logger("app.handlers.profile")

router = Router(name="profile")


@router.message(Command("profile"))
async def cmd_profile(message: types.Message) -> None:
    if not message.from_user:
        return
    tg_id = str(message.from_user.id)
    user = await Queries.find_user_by_telegram_id(tg_id)
    if not user:
        await message.answer(t("ru", "err_unknown_user"))
        return
    loc = user.get("language", "ru")
    if user.get("isBlocked"):
        await message.answer(t(loc, "err_blocked"))
        return

    text = _format_profile(user, loc)
    from aiogram.types import InlineKeyboardButton
    from aiogram.utils.keyboard import InlineKeyboardBuilder
    kb = InlineKeyboardBuilder()
    kb.button(text=t(loc, "profile_delete_data"), callback_data="nav:delete")
    kb.button(text=t(loc, "menu_home"), callback_data="nav:menu")
    await message.answer(text, reply_markup=kb.as_markup())


def _format_profile(user: Dict[str, Any], loc: str) -> str:
    name = user.get("name") or user.get("firstName") or "—"
    zodiac = user.get("zodiacSign") or "—"
    age_group = user.get("ageGroup") or "—"
    messages = user.get("messageCount", 0)
    streak = user.get("streakDays", 0)
    crystals = user.get("crystals", 0)
    sub_type = user.get("subscriptionType")
    sub_until = user.get("subscriptionUntil")
    if isinstance(sub_until, str):
        try:
            sub_until = datetime.fromisoformat(sub_until.replace("Z", "+00:00"))
        except ValueError:
            sub_until = None
    if isinstance(sub_until, datetime) and sub_until.tzinfo is not None:
        sub_until = sub_until.replace(tzinfo=None)

    if sub_type and sub_until and sub_until > datetime.utcnow():
        sub_line = t(loc, "profile_subscription", type=sub_type, until=sub_until.strftime("%Y-%m-%d"))
    else:
        sub_line = t(loc, "profile_no_subscription")

    referral_code = user.get("referralCode", "—")
    lines = [
        t(loc, "profile_title"),
        t(loc, "profile_name", name=name),
        t(loc, "profile_zodiac", sign=zodiac),
        t(loc, "profile_age_group", group=age_group),
        t(loc, "profile_messages", count=messages),
        t(loc, "profile_streak", days=streak),
        t(loc, "profile_crystals", count=crystals),
        sub_line,
        t(loc, "profile_referral_code", code=referral_code),
    ]
    return "\n".join(lines)


@router.message(Command("memory"))
async def cmd_memory(message: types.Message) -> None:
    """Show what Sofia remembers about the user."""
    if not message.from_user:
        return
    tg_id = str(message.from_user.id)
    user = await Queries.find_user_by_telegram_id(tg_id)
    if not user:
        await message.answer(t("ru", "err_unknown_user"))
        return
    loc = user.get("language", "ru")
    if user.get("isBlocked"):
        await message.answer(t(loc, "err_blocked"))
        return
    text = await format_memory_for_user(user)
    await message.answer(text, reply_markup=home_only_keyboard(loc))


@router.message(Command("subscription"))
async def cmd_subscription(message: types.Message) -> None:
    if not message.from_user:
        return
    tg_id = str(message.from_user.id)
    user = await Queries.find_user_by_telegram_id(tg_id)
    if not user:
        await message.answer(t("ru", "err_unknown_user"))
        return
    loc = user.get("language", "ru")
    if user.get("isBlocked"):
        await message.answer(t(loc, "err_blocked"))
        return
    sub_until = user.get("subscriptionUntil")
    if isinstance(sub_until, str):
        try:
            sub_until = datetime.fromisoformat(sub_until.replace("Z", "+00:00"))
        except ValueError:
            sub_until = None
    if isinstance(sub_until, datetime) and sub_until.tzinfo is not None:
        sub_until = sub_until.replace(tzinfo=None)

    sub_type = user.get("subscriptionType")
    if sub_type and sub_until and sub_until > datetime.utcnow():
        line = t(loc, "subscription_active_until", until=sub_until.strftime("%Y-%m-%d"))
    else:
        line = t(loc, "subscription_none")
    await message.answer(
        f"{t(loc, 'subscription_title')}\n\n{line}",
        reply_markup=subscription_keyboard(loc),
    )
