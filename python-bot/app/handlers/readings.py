"""app.handlers.readings — /readings command + the reading flow FSM.

7 reading types:
    fate_card (1 💎) — 4-part fate card (re-reading after onboarding)
    tarot_small (1 💎) — 5 cards: past / present / hidden / advice / outcome
    tarot_full (3 💎) — 20 cards
    tarot_love (2 💎) — 3 cards: you / partner / bond
    tarot_career (2 💎) — 5 cards
    tarot_decision (2 💎) — 3 cards: path A / path B / heart
    horoscope (1 💎) — text-only, no cards

The flow is:
    /readings → menu → user picks a type →
        iftarot_*: ask for N numbers (or random) → draw → LLM interpret → save
        if horoscope: LLM interpret (no cards) → save
        if fate_card: LLM generate 4-part (no cards) → save
"""
from __future__ import annotations

import asyncio
from datetime import datetime
from typing import Any, Dict, List, Optional

from aiogram import Router, types
from aiogram.filters import Command

from app.config import settings
from app.db import Queries
from app.i18n import t
from app.keyboards.inline import (
    reading_menu_keyboard, reading_numbers_keyboard, main_menu_keyboard,
    buy_menu_keyboard, home_only_keyboard,
)
from app.services import crystals as crystal_service
from app.services.ai import ai, LLMError
from app.services.tarot import (
    SPREADS, TarotCard, draw_random_cards, format_cards_for_prompt,
    get_card_by_number, parse_user_numbers, cards_to_json,
)
from app.utils.logger import get_logger

log = get_logger("app.handlers.readings")

router = Router(name="readings")


# Reading flow uses the `User.onboardingStep` column to track transient state:
#   AWAIT_NUMBERS — user is typing card numbers for a reading
#   DREAM         — user is describing a dream for interpretation
# These values are NOT aiogram FSM states; they live in the DB so they survive
# bot restarts.


# ---- /readings command ----

@router.message(Command("readings"))
async def cmd_readings(message: types.Message) -> None:
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
    await Queries.set_user_state(tg_id, "CONVERSATION")
    await message.answer(
        t(loc, "reading_menu_title"),
        reply_markup=reading_menu_keyboard(loc),
    )


# ---- Internal: start a reading flow ----

async def start_reading_flow(
    message: types.Message,
    user: Dict[str, Any],
    reading_type: str,
    *,
    use_random: bool = False,
) -> None:
    """Common entry point for all reading types (called from callbacks)."""
    loc = user.get("language", "ru")
    if reading_type not in SPREADS:
        await message.answer(t(loc, "err_unknown_callback"))
        return

    spread = SPREADS[reading_type]
    price = settings.reading_price(reading_type)

    # Check balance (free types: card_of_day, single_card).
    if price > 0:
        try:
            user = await crystal_service.spend_crystals(
                user_row=user, amount=price, description=f"Расклад {reading_type}"
            )
        except crystal_service.InsufficientCrystalsError as e:
            await message.answer(
                t(loc, "billing_low_balance", count=e.needed),
                reply_markup=buy_menu_keyboard(loc),
            )
            return

    # Horoscope / fate_card — no cards drawn, go straight to LLM.
    if reading_type == "horoscope":
        await message.answer(t(loc, "reading_processing"))
        try:
            text = await ai.horoscope(user.get("name"), user.get("zodiacSign"))
            await Queries.save_reading(
                user_id=user["id"],
                reading_type=reading_type,
                question=None,
                cards_json="[]",
                interpretation=text,
                cost=price,
            )
            await message.answer(text, reply_markup=main_menu_keyboard(user))
        except LLMError as e:
            log.warning("horoscope_llm_failed", extra={"err": str(e)})
            await _refund_and_apologise(message, user, loc, price, reading_type)
        return

    if reading_type == "fate_card":
        # Re-generate the fate card (post-onboarding).
        await message.answer(t(loc, "reading_processing"))
        try:
            text = await ai.fate_card(
                name=user.get("name"),
                zodiac=user.get("zodiacSign"),
                probing_answer="(повторный расклад)",
            )
            await Queries.save_reading(
                user_id=user["id"],
                reading_type=reading_type,
                question=None,
                cards_json="[]",
                interpretation=text,
                cost=price,
            )
            for chunk in _split_message(text, 4000):
                await message.answer(chunk)
            await message.answer(t(loc, "reading_done"), reply_markup=main_menu_keyboard(user))
        except LLMError as e:
            log.warning("fate_card_llm_failed", extra={"err": str(e)})
            await _refund_and_apologise(message, user, loc, price, reading_type)
        return

    # Tarot spreads — need user-supplied numbers (or random).
    if use_random:
        cards = draw_random_cards(spread.card_count, loc)
        await _finalize_reading(message, user, reading_type, cards, price)
        return

    # Ask the user for numbers.
    await Queries.set_user_state(user["telegramId"], "AWAIT_NUMBERS")
    # Store the chosen reading_type in lastTopicSummary temporarily so we can
    # pick it up in the message handler. (We don't use aiogram FSM memory
    # because we want the state to survive bot restarts.)
    await Queries.update_user(
        user["telegramId"],
        lastTopicSummary=f"__reading:{reading_type}:{price}",
    )
    await message.answer(
        t(loc, "reading_ask_numbers", count=spread.card_count),
        reply_markup=reading_numbers_keyboard(reading_type, loc),
    )


async def _finalize_reading(
    message: types.Message,
    user: Dict[str, Any],
    reading_type: str,
    cards: List[TarotCard],
    price: int,
) -> None:
    loc = user.get("language", "ru")
    spread = SPREADS[reading_type]
    # Attach positions.
    positioned_cards = [
        TarotCard(
            name=c.name,
            reversed=c.reversed,
            position=spread.positions[i] if i < len(spread.positions) else None,
        )
        for i, c in enumerate(cards)
    ]
    cards_with_positions = format_cards_for_prompt(positioned_cards, spread.positions, loc)
    await message.answer(t(loc, "reading_processing"))

    try:
        # Pull memory context for personalisation.
        from app.services.memory import build_context_for_llm
        memory_ctx = await build_context_for_llm(user, limit=8)

        interpretation = await ai.tarot_reading(
            name=user.get("name"),
            zodiac=user.get("zodiacSign"),
            spread_name=spread.type,
            cards_with_positions=cards_with_positions,
            memory_context=memory_ctx,
        )
        await Queries.save_reading(
            user_id=user["id"],
            reading_type=reading_type,
            question=None,
            cards_json=cards_to_json(positioned_cards),
            interpretation=interpretation,
            cost=price,
        )
        # Reset onboarding state.
        await Queries.update_user(
            user["telegramId"],
            onboardingStep="CONVERSATION",
            lastTopicSummary=reading_type,
        )
        # Show cards first, then interpretation.
        cards_str = "\n".join(
            f"🃏 {c.name}{' (перевёрнута)' if c.reversed else ''}"
            + (f" — {c.position}" if c.position else "")
            for c in positioned_cards
        )
        await message.answer(cards_str)
        for chunk in _split_message(interpretation, 4000):
            await message.answer(chunk)
        await message.answer(t(loc, "reading_done"), reply_markup=main_menu_keyboard(user))
    except LLMError as e:
        log.warning("tarot_llm_failed", extra={"err": str(e), "reading_type": reading_type})
        await _refund_and_apologise(message, user, loc, price, reading_type)


async def _refund_and_apologise(
    message: types.Message,
    user: Dict[str, Any],
    loc: str,
    price: int,
    reading_type: str,
) -> None:
    if price > 0:
        await crystal_service.refund_crystals(
            user_row=user, amount=price, description=f"Расклад {reading_type} (сбой)"
        )
    await Queries.update_user(user["telegramId"], onboardingStep="CONVERSATION")
    await message.answer(
        t(loc, "reading_refunded"),
        reply_markup=main_menu_keyboard(user),
    )


def _split_message(text: str, max_len: int = 4000) -> List[str]:
    if len(text) <= max_len:
        return [text]
    chunks = []
    current = ""
    for paragraph in text.split("\n\n"):
        if len(current) + len(paragraph) + 2 > max_len and current:
            chunks.append(current)
            current = paragraph
        else:
            current = (current + "\n\n" + paragraph) if current else paragraph
    if current:
        chunks.append(current)
    return chunks


# ---- Message handler: user typed card numbers ----

async def handle_reading_numbers_message(message: types.Message) -> bool:
    """Called for non-command text messages when user is in AWAIT_NUMBERS state."""
    if not message.from_user or not message.text:
        return False
    tg_id = str(message.from_user.id)
    user = await Queries.find_user_by_telegram_id(tg_id)
    if not user:
        return False
    if user.get("onboardingStep") != "AWAIT_NUMBERS":
        return False
    loc = user.get("language", "ru")

    # Parse reading_type from lastTopicSummary marker.
    topic = user.get("lastTopicSummary") or ""
    if not topic.startswith("__reading:"):
        return False
    parts = topic.split(":")
    if len(parts) < 3:
        return False
    reading_type = parts[1]
    try:
        price = int(parts[2])
    except ValueError:
        price = 0
    if reading_type not in SPREADS:
        await Queries.update_user(user["telegramId"], onboardingStep="CONVERSATION")
        return False

    spread = SPREADS[reading_type]
    numbers = parse_user_numbers(message.text, spread.card_count)
    if not numbers:
        await message.answer(
            t(loc, "reading_ask_numbers", count=spread.card_count),
            reply_markup=reading_numbers_keyboard(reading_type, loc),
        )
        return True

    # Draw cards from numbers.
    cards = [get_card_by_number(n, loc) for n in numbers]
    await _finalize_reading(message, user, reading_type, cards, price)
    return True


# ---- Message handler: dream interpretation ----

async def handle_dream_message(message: types.Message) -> bool:
    """Called when user is in DREAM state."""
    if not message.from_user or not message.text:
        return False
    tg_id = str(message.from_user.id)
    user = await Queries.find_user_by_telegram_id(tg_id)
    if not user:
        return False
    if user.get("onboardingStep") != "DREAM":
        return False
    loc = user.get("language", "ru")
    await Queries.save_conversation(user["id"], "user", message.text[:2000])
    await message.answer(t(loc, "reading_processing"))
    try:
        text = await ai.dream(
            name=user.get("name"),
            zodiac=user.get("zodiacSign"),
            dream=message.text,
        )
        await message.answer(text, reply_markup=main_menu_keyboard(user))
    except LLMError as e:
        log.warning("dream_llm_failed", extra={"err": str(e)})
        await message.answer(
            t(loc, "reading_refunded"),
            reply_markup=main_menu_keyboard(user),
        )
    await Queries.set_user_state(user["telegramId"], "CONVERSATION")
    return True
