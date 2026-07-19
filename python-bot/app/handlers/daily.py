"""app.handlers.daily — /daily command (card of the day, free, 1/day, updates streak)."""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Dict

from aiogram import Router, types
from aiogram.filters import Command

from app.config import settings
from app.db import Queries
from app.i18n import t
from app.keyboards.inline import main_menu_keyboard
from app.services import crystals as crystal_service
from app.services.ai import ai, LLMError
from app.services.tarot import draw_random_cards, cards_to_json
from app.utils.logger import get_logger

log = get_logger("app.handlers.daily")

router = Router(name="daily")


@router.message(Command("daily"))
async def cmd_daily(message: types.Message) -> None:
    """Card of the day — free, once every N hours. Updates streak."""
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

    now = datetime.utcnow()
    cooldown_hours = settings.daily_card_cooldown_hours

    # Check cooldown.
    last = user.get("lastDailyCardAt")
    if isinstance(last, str):
        try:
            last = datetime.fromisoformat(last.replace("Z", "+00:00"))
        except ValueError:
            last = None
    if isinstance(last, datetime) and last.tzinfo is not None:
        last = last.replace(tzinfo=None)

    if last and (now - last) < timedelta(hours=cooldown_hours):
        remaining_hours = cooldown_hours - int((now - last).total_seconds() // 3600)
        await message.answer(
            t(loc, "card_of_day_cooldown", hours=max(0, remaining_hours)),
            reply_markup=main_menu_keyboard(user),
        )
        return

    # Update streak.
    user = await crystal_service.maybe_daily_bonus(user) or user

    # Draw a card.
    cards = draw_random_cards(1, loc)
    card = cards[0]
    await message.answer(t(loc, "reading_processing"))

    try:
        interpretation = await ai.card_of_day(
            name=user.get("name"),
            zodiac=user.get("zodiacSign"),
            card_name=card.name,
            reversed=card.reversed,
        )
    except LLMError as e:
        log.warning("card_of_day_llm_failed", extra={"err": str(e)})
        # Fallback — short deterministic text.
        reversed_note = " (перевёрнута)" if card.reversed else ""
        interpretation = (
            f"🃏 {card.name}{reversed_note}\n\n"
            + (loc == "en" and "I would sit with this card today. What does it bring up for you? 🌙"
               or "Я бы посидела с этой картой сегодня. Что она в тебе откликает? 🌙")
        )

    # Save reading + update timestamps.
    await Queries.save_reading(
        user_id=user["id"],
        reading_type="card_of_day",
        question=None,
        cards_json=cards_to_json(cards),
        interpretation=interpretation,
        cost=0,
    )
    await Queries.update_user(user["telegramId"], lastDailyCardAt=now)

    # Daily bonus notification (streak >= 3 → +1 already applied in maybe_daily_bonus).
    # Show extra message if a bonus was awarded — we check streakDays.
    if int(user.get("streakDays") or 0) >= 3:
        # The bonus was already applied; just inform the user.
        await message.answer(
            t(loc, "daily_bonus_received", days=user.get("streakDays", 0))
        )

    await message.answer(
        f"🃏 {card.name}{' (перевёрнута)' if card.reversed else ''}\n\n{interpretation}",
        reply_markup=main_menu_keyboard(user),
    )
