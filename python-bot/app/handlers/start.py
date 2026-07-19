"""app.handlers.start — /start command + onboarding FSM.

FSM states (stored in `User.onboardingStep` column, NOT in aiogram's memory —
so it survives bot restarts):
    START → ASK_NAME → ASK_BIRTH_DATE → ASK_BIRTH_TIME → ASK_BIRTH_PLACE
          → ASK_GENDER → ASK_AGE_GROUP → PROBING → FREE_READING → CONVERSATION
"""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Dict, Optional

from aiogram import Router, types
from aiogram.filters import CommandStart, CommandObject

from app.config import settings
from app.db import Queries, new_referral_code
from app.i18n import t
from app.keyboards.inline import (
    main_menu_keyboard, language_keyboard, reading_menu_keyboard, paid_hook_keyboard,
)
from app.services import crystals as crystal_service
from app.services.ai import ai, LLMError
from app.services.zodiac import (
    age_group_from_year, get_zodiac_from_iso, infer_gender, parse_birth_date,
)
from app.utils.logger import get_logger

log = get_logger("app.handlers.start")

router = Router(name="start")


# Onboarding step values (stored in `User.onboardingStep` column, NOT in
# aiogram's FSM memory — so state survives bot restarts):
#   START → ASK_NAME → ASK_BIRTH_DATE → ASK_BIRTH_TIME → ASK_BIRTH_PLACE
#         → ASK_GENDER → ASK_AGE_GROUP → PROBING → FREE_READING → CONVERSATION
# Additional transient states: AWAIT_NUMBERS, DREAM, AWAIT_DELETE_CONFIRM,
# BROADCAST, ADMIN_PANEL.

# Skip words for optional onboarding fields
SKIP_WORDS = {
    "пропустить", "пропуск", "skip", "не помню", "далее", "дальше",
    "don't remember", "dont remember", "next",
}


@router.message(CommandStart(deep_link=True))
@router.message(CommandStart())
async def cmd_start(message: types.Message, command: CommandObject) -> None:
    """Entry point. Handles first-time, returning, deep links."""
    if not message.from_user:
        return
    tg_id = str(message.from_user.id)
    args = (command.args or "").strip()
    loc = "ru"

    # Parse deep link: ref_<code> | card | affirmation | question | lang
    referral_code: Optional[str] = None
    deep_action: Optional[str] = None
    if args.startswith("ref_"):
        referral_code = args[4:]
    elif args in ("card", "affirmation", "question", "lang"):
        deep_action = args

    user = await Queries.find_user_by_telegram_id(tg_id)

    if not user:
        # First time — create user and start onboarding.
        user = await Queries.create_user(
            telegram_id=tg_id,
            username=message.from_user.username,
            first_name=message.from_user.first_name,
            referral_code=new_referral_code(),
            referred_by_referral_code=referral_code,
            welcome_crystals=settings.welcome_crystals,
            is_admin=settings.is_admin(tg_id),
        )
        log.info("new_user_created", extra={
            "telegram_id": tg_id,
            "referral_code": user["referralCode"],
            "referred_by": referral_code,
        })
        await Queries.set_user_state(tg_id, "ASK_NAME")
        await message.answer(t(loc, "onboarding_greeting"))
        return

    # Returning user.
    loc = user.get("language", "ru")

    # If user is blocked, refuse politely.
    if user.get("isBlocked"):
        await message.answer(t(loc, "err_blocked"))
        return

    now = datetime.utcnow()
    await Queries.update_user(
        tg_id,
        lastSeenAt=now,
        username=message.from_user.username or user.get("username"),
        isBlocked=False,
        rudenessCount=0,
    )

    # Update streak / daily bonus.
    user = await crystal_service.maybe_daily_bonus(user) or user

    # Handle deep-link actions for returning users.
    if deep_action:
        await Queries.set_user_state(tg_id, "CONVERSATION")
        if deep_action == "card":
            await message.answer(
                loc == "en" and "🃏 Let me draw a card for you. Choose a spread below."
                or "🃏 Я вытяну для тебя карту. Выбери расклад ниже.",
                reply_markup=reading_menu_keyboard(loc),
            )
            return
        if deep_action == "affirmation":
            await _send_affirmation(message, user, loc)
            return
        if deep_action == "question":
            await message.answer(
                loc == "en" and "🔮 Tell me — what is on your heart? Ask, and I will answer."
                or "🔮 Скажи мне — что у тебя на сердце? Спроси, и я отвечу.",
                reply_markup=main_menu_keyboard(user),
            )
            return
        if deep_action == "lang":
            await message.answer(t(loc, "lang_select"), reply_markup=language_keyboard(loc))
            return

    # Long absence — return greeting.
    last_seen = user.get("lastSeenAt")
    if isinstance(last_seen, str):
        try:
            last_seen = datetime.fromisoformat(last_seen.replace("Z", "+00:00"))
        except ValueError:
            last_seen = None
    if isinstance(last_seen, datetime) and last_seen.tzinfo is not None:
        last_seen = last_seen.replace(tzinfo=None)
    absence_hours = ((now - last_seen).total_seconds() / 3600) if last_seen else 0

    if not user.get("onboardingCompleted"):
        # Resume onboarding — re-send the prompt for the current step.
        await _resume_onboarding(message, user.get("onboardingStep", "START"), loc)
        return

    if absence_hours > settings.return_absence_hours and last_seen:
        try:
            reply = await ai.return_greeting(
                name=user.get("name"),
                zodiac=user.get("zodiacSign"),
                hours=int(absence_hours),
                last_topic=user.get("lastTopicSummary"),
            )
            await message.answer(reply, reply_markup=main_menu_keyboard(user))
            return
        except LLMError:
            pass  # fall through to default

    await Queries.set_user_state(tg_id, "CONVERSATION")
    name = user.get("name") or t(loc, "return_greeting_default")
    await message.answer(
        t(loc, "return_known", name=name),
        reply_markup=main_menu_keyboard(user),
    )


async def _resume_onboarding(message: types.Message, step: str, loc: str) -> None:
    """Re-send the prompt for the current onboarding step."""
    key_map = {
        "ASK_NAME": "onboarding_ask_name",
        "ASK_BIRTH_DATE": "onboarding_ask_birth_date",
        "ASK_BIRTH_TIME": "onboarding_ask_birth_time",
        "ASK_BIRTH_PLACE": "onboarding_ask_birth_place",
        "ASK_GENDER": "onboarding_ask_gender",
        "ASK_AGE_GROUP": "onboarding_ask_age_group",
        "PROBING": "onboarding_probing_resume",
    }
    key = key_map.get(step, "onboarding_unknown_step")
    await message.answer(t(loc, key))


async def _send_affirmation(message: types.Message, user: Dict[str, Any], loc: str) -> None:
    """Send a daily affirmation (LLM-generated with deterministic fallback)."""
    body = (
        loc == "en"
        and "Be like still water today. 🌙"
        or "Будь как тихая вода сегодня. 🌙"
    )
    try:
        text = await ai.affirmation(loc)
        if text:
            body = text
    except LLMError as e:
        log.warning("affirmation_llm_failed", extra={"err": str(e)})
    from app.keyboards.inline import home_only_keyboard
    await message.answer(
        f"{t(loc, 'affirmation_intro')}\n\n{body}",
        reply_markup=home_only_keyboard(loc),
    )


# ---- Onboarding message handlers (registered via main.py) ----


async def handle_onboarding_message(message: types.Message) -> bool:
    """Called for every non-command text message when user is in onboarding.

    Returns True if the message was handled here, False to fall through.
    """
    if not message.from_user or not message.text:
        return False
    tg_id = str(message.from_user.id)
    user = await Queries.find_user_by_telegram_id(tg_id)
    if not user:
        return False
    step = user.get("onboardingStep", "")
    if step == "ASK_NAME":
        return await _h_ask_name(message, user, message.text)
    if step == "ASK_BIRTH_DATE":
        return await _h_ask_birth_date(message, user, message.text)
    if step == "ASK_BIRTH_TIME":
        return await _h_ask_birth_time(message, user, message.text)
    if step == "ASK_BIRTH_PLACE":
        return await _h_ask_birth_place(message, user, message.text)
    if step == "ASK_GENDER":
        return await _h_ask_gender(message, user, message.text)
    if step == "ASK_AGE_GROUP":
        return await _h_ask_age_group(message, user, message.text)
    if step == "PROBING":
        return await _h_probing(message, user, message.text)
    return False


async def _h_ask_name(message: types.Message, user: Dict[str, Any], text: str) -> bool:
    loc = user.get("language", "ru")
    name = text.strip()[:100]
    if not name or len(name) < 2:
        await message.answer(t(loc, "onboarding_invalid_name"))
        return True
    gender = infer_gender(name)
    await Queries.update_user(user["telegramId"], name=name, gender=gender)
    await Queries.save_conversation(user["id"], "user", name)
    await Queries.set_user_state(user["telegramId"], "ASK_BIRTH_DATE")
    await message.answer(
        loc == "en"
        and f"{name}, a beautiful name. And when were you born? The day and month, or the full date."
        or f"{name}, красивое имя. А когда ты родился? День и месяц подскажи, или полную дату — так я лучше увижу твой знак."
    )
    return True


async def _h_ask_birth_date(message: types.Message, user: Dict[str, Any], text: str) -> bool:
    loc = user.get("language", "ru")
    parsed = parse_birth_date(text.strip())
    if not parsed:
        await message.answer(t(loc, "onboarding_invalid_date"))
        return True
    iso, year = parsed
    zodiac = get_zodiac_from_iso(iso)
    age_group = age_group_from_year(year)
    await Queries.update_user(
        user["telegramId"],
        birthDate=iso,
        zodiacSign=zodiac.name if zodiac else None,
        ageGroup=age_group,
    )
    await Queries.set_user_state(user["telegramId"], "ASK_BIRTH_TIME")
    zodiac_line = (
        loc == "en"
        and f"Your sign is {zodiac.emoji} {zodiac.name_en}. "
        or f"Знак твой — {zodiac.emoji} {zodiac.name}. "
    ) if zodiac else ""
    await message.answer(
        loc == "en"
        and f"{zodiac_line}And at what time were you born, if you remember? You can say \"skip\"."
        or f"{zodiac_line}А во сколько ты родился, если помнишь? Можно «пропустить» — это не главное."
    )
    return True


async def _h_ask_birth_time(message: types.Message, user: Dict[str, Any], text: str) -> bool:
    loc = user.get("language", "ru")
    lower = text.lower().strip()
    if lower in SKIP_WORDS:
        await Queries.set_user_state(user["telegramId"], "ASK_BIRTH_PLACE")
        await message.answer(
            loc == "en"
            and "Very well. And where were you born? You can say 'skip'."
            or "Хорошо. А где ты родился? Можно «пропустить»."
        )
        return True
    # Try to extract HH:MM.
    import re
    m = re.search(r"(\d{1,2})[:.](\d{2})", text)
    if m:
        await Queries.update_user(user["telegramId"], birthTime=f"{m.group(1)}:{m.group(2)}")
    await Queries.set_user_state(user["telegramId"], "ASK_BIRTH_PLACE")
    await message.answer(
        loc == "en"
        and "Remembered. And where were you born? You can say 'skip'."
        or "Запомнила. А где ты родился? Можно «пропустить»."
    )
    return True


async def _h_ask_birth_place(message: types.Message, user: Dict[str, Any], text: str) -> bool:
    loc = user.get("language", "ru")
    if text.strip().lower() not in SKIP_WORDS:
        await Queries.update_user(user["telegramId"], birthPlace=text.strip()[:200])
    await Queries.set_user_state(user["telegramId"], "ASK_GENDER")
    await message.answer(t(loc, "onboarding_ask_gender"))
    return True


async def _h_ask_gender(message: types.Message, user: Dict[str, Any], text: str) -> bool:
    loc = user.get("language", "ru")
    lower = text.lower().strip()
    if lower in SKIP_WORDS:
        await Queries.set_user_state(user["telegramId"], "ASK_AGE_GROUP")
        await message.answer(t(loc, "onboarding_ask_age_group"))
        return True
    if any(w in lower for w in ("муж", "male", "м", "m")):
        gender = "male"
    elif any(w in lower for w in ("жен", "female", "ж", "f")):
        gender = "female"
    else:
        gender = None
    if gender:
        await Queries.update_user(user["telegramId"], gender=gender)
    await Queries.set_user_state(user["telegramId"], "ASK_AGE_GROUP")
    await message.answer(t(loc, "onboarding_ask_age_group"))
    return True


async def _h_ask_age_group(message: types.Message, user: Dict[str, Any], text: str) -> bool:
    loc = user.get("language", "ru")
    lower = text.lower().strip()
    if lower in SKIP_WORDS:
        await Queries.set_user_state(user["telegramId"], "PROBING")
        await _ask_probing_question(message, user)
        return True
    # Try to extract a number, or a range.
    import re
    m = re.search(r"\d+", lower)
    if m:
        age = int(m.group())
        if age < 18:
            group = "young"
        elif age < 25:
            group = "young_adult"
        elif age < 40:
            group = "adult"
        elif age < 60:
            group = "mature"
        else:
            group = "senior"
        await Queries.update_user(user["telegramId"], ageGroup=group)
    else:
        # Try to match ranges / Russian words.
        if "18" in lower and "25" in lower:
            await Queries.update_user(user["telegramId"], ageGroup="young_adult")
        elif "25" in lower and "40" in lower:
            await Queries.update_user(user["telegramId"], ageGroup="adult")
        elif "40" in lower and "60" in lower:
            await Queries.update_user(user["telegramId"], ageGroup="mature")
        elif "60" in lower:
            await Queries.update_user(user["telegramId"], ageGroup="senior")
    await Queries.set_user_state(user["telegramId"], "PROBING")
    await _ask_probing_question(message, user)
    return True


async def _ask_probing_question(message: types.Message, user: Dict[str, Any]) -> None:
    loc = user.get("language", "ru")
    await message.answer(t(loc, "onboarding_completed"))
    try:
        q = await ai.probing_question(user.get("name"), user.get("zodiacSign"))
        await message.answer(q)
    except LLMError as e:
        log.warning("probing_llm_failed", extra={"err": str(e)})
        fallback = (
            loc == "en"
            and "What brings you to me today? I want to hear."
            or "Что привело тебя ко мне сегодня? Я хочу услышать."
        )
        await message.answer(fallback)


async def _h_probing(message: types.Message, user: Dict[str, Any], text: str) -> bool:
    """User answered the probing question → deliver the fate card."""
    loc = user.get("language", "ru")
    await Queries.save_conversation(user["id"], "user", text[:2000])
    await Queries.set_user_state(user["telegramId"], "FREE_READING")
    await _deliver_fate_card(message, user, text)
    return True


async def _deliver_fate_card(
    message: types.Message, user: Dict[str, Any], probing_answer: str
) -> None:
    """Generate the 4-part fate card via LLM. Saves a Reading row."""
    loc = user.get("language", "ru")
    await message.answer(t(loc, "reading_processing"))
    try:
        content = await ai.fate_card(
            name=user.get("name"),
            zodiac=user.get("zodiacSign"),
            probing_answer=probing_answer,
        )
        from app.services.tarot import cards_to_json
        from app.db import new_id
        # Fate card has no specific cards drawn — store empty JSON.
        await Queries.save_reading(
            user_id=user["id"],
            reading_type="fate_card",
            question=None,
            cards_json="[]",
            interpretation=content,
            cost=0,
        )
        await Queries.update_user(
            user["telegramId"],
            onboardingCompleted=True,
            lastTopicSummary=(loc == "en" and "fate card" or "карта судьбы"),
        )
        await Queries.set_user_state(user["telegramId"], "CONVERSATION")

        # Split long messages (Telegram limit ~4096 chars).
        for chunk in _split_message(content, 4000):
            await message.answer(chunk)

        hook = (
            loc == "en"
            and "There is another side to your card… shall I open it?"
            or "В твоей карте есть ещё одна сторона… хочешь, приоткрою?"
        )
        await message.answer(hook, reply_markup=paid_hook_keyboard(loc))
    except LLMError as e:
        log.warning("fate_card_llm_failed", extra={"err": str(e)})
        await message.answer(
            loc == "en"
            and "The mist is thick today, dear. The card doesn't want to open fully. Drop by later. 🌙"
            or "Туман сегодня густой, милый. Карта не хочет открываться полностью. Загляни чуть позже. 🌙"
        )
        await Queries.update_user(user["telegramId"], onboardingCompleted=True)
        await Queries.set_user_state(user["telegramId"], "CONVERSATION")


def _split_message(text: str, max_len: int = 4000) -> list:
    """Split long text on paragraph boundaries."""
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
