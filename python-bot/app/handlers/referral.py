"""app.handlers.referral — /referral command."""
from __future__ import annotations

from aiogram import Router, types
from aiogram.filters import Command

from app.config import settings
from app.db import Queries
from app.i18n import t
from app.keyboards.inline import referral_keyboard, main_menu_keyboard

router = Router(name="referral")


@router.message(Command("referral"))
async def cmd_referral(message: types.Message) -> None:
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

    code = user.get("referralCode") or ""
    link = f"https://t.me/{settings.bot_username}?start=ref_{code}"
    # Count referrals made.
    made_count = await Queries.count_referrals_made(user["id"])

    body = t(loc, "referral_body", link=link)
    text = f"{t(loc, 'referral_title')}\n\n{body}"
    if made_count:
        count_line = (
            loc == "en"
            and f"\n\nYou've invited {made_count} friend(s) so far."
            or f"\n\nТы уже пригласил {made_count} друга(ей)."
        )
        text += count_line
    await message.answer(text, reply_markup=referral_keyboard(code, loc))
