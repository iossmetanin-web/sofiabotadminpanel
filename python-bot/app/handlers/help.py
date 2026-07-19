"""app.handlers.help — /help and /cancel commands."""
from __future__ import annotations

from aiogram import Router, types
from aiogram.filters import Command

from app.db import Queries
from app.i18n import t
from app.keyboards.inline import main_menu_keyboard, home_only_keyboard

router = Router(name="help")


@router.message(Command("help"))
async def cmd_help(message: types.Message) -> None:
    if not message.from_user:
        return
    tg_id = str(message.from_user.id)
    user = await Queries.find_user_by_telegram_id(tg_id)
    loc = user.get("language", "ru") if user else "ru"
    await message.answer(
        t(loc, "help_body"),
        reply_markup=home_only_keyboard(loc),
    )


@router.message(Command("cancel"))
async def cmd_cancel(message: types.Message) -> None:
    if not message.from_user:
        return
    tg_id = str(message.from_user.id)
    user = await Queries.find_user_by_telegram_id(tg_id)
    loc = user.get("language", "ru") if user else "ru"
    if user:
        if user.get("onboardingCompleted"):
            await Queries.set_user_state(tg_id, "CONVERSATION")
        else:
            # If they're in onboarding, keep the step (so they can resume).
            pass
    await message.answer(
        t(loc, "cancel_body"),
        reply_markup=main_menu_keyboard(user) if user else None,
    )
