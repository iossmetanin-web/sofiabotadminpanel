"""app.handlers.callback — all inline button callbacks.

Callback data convention: "ns:action[:payload]".

Namespaces:
  nav:    navigation (menu, back, profile, balance, history, settings, help,
          referral, delete, confirm_delete, cancel_delete, dream, miniapp,
          affirmation)
  rd:     readings (menu, pick:<type>, cardday, freecard, random:<type>)
  buy:    buy menu (weekly, monthly, pack3, pack10, pack25)
  admin:  admin (panel, stats, users, users:<page>, add, broadcast)
  lang:   language (menu, set:ru, set:en)
  share:  share referral link
"""
from __future__ import annotations

from typing import Any, Dict

from aiogram import Bot, Router, types
from aiogram.exceptions import TelegramBadRequest
from aiogram.filters import CallbackQuery
from aiogram.utils.keyboard import InlineKeyboardBuilder

from app.config import settings
from app.db import Queries
from app.i18n import t, locale_label
from app.keyboards.inline import (
    admin_panel_keyboard, back_home_keyboard, buy_menu_keyboard,
    delete_confirm_keyboard, history_pagination_keyboard, home_only_keyboard,
    language_keyboard, main_menu_keyboard, reading_menu_keyboard,
    referral_keyboard, settings_keyboard, users_pagination_keyboard,
    reading_numbers_keyboard,
)
from app.handlers.readings import start_reading_flow
from app.services import crystals as crystal_service
from app.services.ai import ai, LLMError
from app.utils.logger import get_logger

log = get_logger("app.handlers.callback")

router = Router(name="callback")


@router.callback_query(CallbackQuery())
async def on_callback(query: types.CallbackQuery, bot: Bot) -> None:
    """Master callback router."""
    if not query.from_user or not query.data:
        await query.answer()
        return
    data = query.data
    tg_id = str(query.from_user.id)

    # Always answer the callback first (dismiss spinner).
    await query.answer()

    user = await Queries.find_user_by_telegram_id(tg_id)
    if not user:
        try:
            await bot.send_message(tg_id, t("ru", "err_unknown_user"))
        except Exception:
            pass
        return

    loc = user.get("language", "ru")
    parts = data.split(":")
    ns = parts[0] if parts else ""
    action = parts[1] if len(parts) > 1 else ""
    payload = parts[2] if len(parts) > 2 else ""

    try:
        if ns == "nav":
            await _handle_nav(query, bot, user, action, payload)
        elif ns == "rd":
            await _handle_reading(query, bot, user, action, payload)
        elif ns == "buy":
            await _handle_buy(query, bot, user, action)
        elif ns == "admin":
            await _handle_admin(query, bot, user, action, payload)
        elif ns == "lang":
            await _handle_lang(query, bot, user, action, payload)
        elif ns == "share":
            await _handle_share(query, bot, user, payload)
        else:
            # Unknown — but don't bother the user; just log.
            log.warning("unknown_callback", extra={"data": data})
    except Exception as e:
        log.error("callback_failed", extra={"data": data, "err": str(e)})
        try:
            await bot.send_message(tg_id, t(loc, "err_generic"))
        except Exception:
            pass


# ---- Helpers ----

async def _edit_or_reply(
    query: types.CallbackQuery, bot: Bot, text: str, reply_markup=None
) -> None:
    """Edit the callback's message in place, or send a new one if that fails."""
    parse_mode = "HTML"
    try:
        if query.message:
            await bot.edit_message_text(
                text,
                chat_id=query.message.chat.id,
                message_id=query.message.message_id,
                reply_markup=reply_markup,
                parse_mode=parse_mode,
            )
        else:
            await bot.send_message(query.from_user.id, text, reply_markup=reply_markup,
                                   parse_mode=parse_mode)
    except TelegramBadRequest as e:
        # "message is not modified" → reply instead.
        if "not modified" in str(e).lower():
            return
        try:
            await bot.send_message(query.from_user.id, text, reply_markup=reply_markup,
                                   parse_mode=parse_mode)
        except Exception:
            pass


# ---- nav: namespace ----

async def _handle_nav(
    query: types.CallbackQuery, bot: Bot, user: Dict[str, Any],
    action: str, payload: str,
) -> None:
    loc = user.get("language", "ru")

    if action == "menu":
        await Queries.set_user_state(user["telegramId"], "CONVERSATION")
        await _edit_or_reply(query, bot, t(loc, "menu_title"), main_menu_keyboard(user))
        return

    if action == "back":
        await Queries.set_user_state(user["telegramId"], "CONVERSATION")
        text = loc == "en" and "What shall we talk about?" or "О чём поговорим?"
        await _edit_or_reply(query, bot, text, main_menu_keyboard(user))
        return

    if action == "later":
        await Queries.set_user_state(user["telegramId"], "CONVERSATION")
        text = loc == "en" and "Very well, I will wait. 🌙" or "Хорошо, я подожду. 🌙"
        await _edit_or_reply(query, bot, text, main_menu_keyboard(user))
        return

    if action == "profile":
        from app.handlers.profile import _format_profile
        text = _format_profile(user, loc)
        kb = InlineKeyboardBuilder()
        kb.button(text=t(loc, "profile_delete_data"), callback_data="nav:delete")
        kb.button(text=t(loc, "menu_home"), callback_data="nav:menu")
        await _edit_or_reply(query, bot, text, kb.as_markup())
        return

    if action == "balance":
        text = _format_balance(user, loc)
        await _edit_or_reply(query, bot, text, buy_menu_keyboard(loc))
        return

    if action == "history":
        page = int(payload) if payload.isdigit() else 1
        await _show_history(query, bot, user, page)
        return

    if action == "settings":
        text = (
            t(loc, "settings_title") + "\n\n"
            + t(loc, "settings_lang", lang=locale_label(loc)) + "\n"
            + t(loc, "settings_daily_card") + ": " + t(loc, "settings_on") + "\n"
            + t(loc, "settings_soon")
        )
        await _edit_or_reply(query, bot, text, settings_keyboard(user))
        return

    if action == "help":
        await _edit_or_reply(query, bot, t(loc, "help_body"), back_home_keyboard(loc))
        return

    if action == "referral":
        link = f"https://t.me/{settings.bot_username}?start=ref_{user['referralCode']}"
        body = t(loc, "referral_body", link=link)
        text = t(loc, "referral_title") + "\n\n" + body
        await _edit_or_reply(query, bot, text, referral_keyboard(user["referralCode"], loc))
        return

    if action == "affirmation":
        await _send_affirmation_inline(query, bot, user, loc)
        return

    if action == "dream":
        await Queries.set_user_state(user["telegramId"], "DREAM")
        await _edit_or_reply(
            query, bot, t(loc, "dream_ask"),
            InlineKeyboardBuilder().button(text=t(loc, "menu_back"), callback_data="nav:back").as_markup(),
        )
        return

    if action == "delete":
        await Queries.set_user_state(user["telegramId"], "AWAIT_DELETE_CONFIRM")
        text = (
            t(loc, "profile_delete_confirm_title") + "\n\n"
            + t(loc, "profile_delete_confirm_body")
        )
        await _edit_or_reply(query, bot, text, delete_confirm_keyboard(loc))
        return

    if action == "cancel_delete":
        await Queries.set_user_state(user["telegramId"], "CONVERSATION")
        await _edit_or_reply(query, bot, t(loc, "profile_delete_cancelled"), main_menu_keyboard(user))
        return

    if action == "confirm_delete":
        await Queries.delete_user(user["telegramId"])
        await Queries.record_audit(
            actor_id=user["telegramId"],
            action="delete_own_data",
            target_user_id=user["id"],
        )
        await _edit_or_reply(query, bot, t(loc, "profile_deleted"))
        return

    if action == "none":
        # Static label button — do nothing.
        return


def _format_balance(user: Dict[str, Any], loc: str) -> str:
    from datetime import datetime
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
    lines = [
        t(loc, "balance_title"),
        t(loc, "balance_crystals", count=crystals),
    ]
    if sub_type and sub_until and sub_until > datetime.utcnow():
        lines.append(t(loc, "balance_subscription",
                       type=sub_type, until=sub_until.strftime("%Y-%m-%d")))
    else:
        lines.append(t(loc, "balance_no_subscription"))
    return "\n".join(lines)


async def _show_history(
    query: types.CallbackQuery, bot: Bot, user: Dict[str, Any], page: int,
) -> None:
    loc = user.get("language", "ru")
    limit = 5
    total = await Queries.count_readings(user["id"])
    total_pages = max(1, (total + limit - 1) // limit)
    page = max(1, min(page, total_pages))
    offset = (page - 1) * limit
    items = await Queries.list_readings(user["id"], limit, offset)
    if not items:
        kb = InlineKeyboardBuilder()
        kb.button(text=t(loc, "history_make_first"), callback_data="rd:menu")
        kb.row()
        kb.button(text=t(loc, "menu_home"), callback_data="nav:menu")
        await _edit_or_reply(query, bot, t(loc, "history_empty"), kb.as_markup())
        return
    lines = [t(loc, "history_page", page=page, total=total_pages), ""]
    for i, r in enumerate(items, start=offset + 1):
        # Truncate interpretation to a one-line preview.
        preview = (r.get("interpretation") or "").replace("\n", " ")[:80]
        from datetime import datetime
        created = r.get("createdAt")
        if isinstance(created, str):
            try:
                created = datetime.fromisoformat(created.replace("Z", "+00:00"))
            except ValueError:
                created = None
        if isinstance(created, datetime) and created.tzinfo is not None:
            created = created.replace(tzinfo=None)
        created_str = created.strftime("%Y-%m-%d %H:%M") if isinstance(created, datetime) else "?"
        lines.append(f"{i}. [{r['type']}] {created_str}\n   {preview}…")
    text = "\n\n".join(lines)
    await _edit_or_reply(
        query, bot, text,
        history_pagination_keyboard(page, total_pages, loc),
    )


async def _send_affirmation_inline(
    query: types.CallbackQuery, bot: Bot, user: Dict[str, Any], loc: str,
) -> None:
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
    text = f"{t(loc, 'affirmation_intro')}\n\n{body}"
    kb = InlineKeyboardBuilder().button(text=t(loc, "menu_home"), callback_data="nav:menu").as_markup()
    await _edit_or_reply(query, bot, text, kb)


# ---- rd: namespace (readings) ----

async def _handle_reading(
    query: types.CallbackQuery, bot: Bot, user: Dict[str, Any],
    action: str, payload: str,
) -> None:
    loc = user.get("language", "ru")

    if action == "menu":
        await _edit_or_reply(query, bot, t(loc, "reading_menu_title"), reading_menu_keyboard(loc))
        return

    if action == "pick":
        await start_reading_flow(query.message, user, payload)
        return

    if action == "random":
        # payload = reading_type
        await start_reading_flow(query.message, user, payload, use_random=True)
        return

    if action == "cardday":
        # Trigger card of day flow — same as /daily.
        from aiogram.types import Message
        # We can't call /daily directly; emulate by calling the daily flow.
        # For simplicity, send a hint to use /daily.
        await bot.send_message(
            user["telegramId"],
            loc == "en"
            and "Use /daily to draw your card of the day. 🌟"
            or "Используй /daily, чтобы вытянуть карту дня. 🌟",
            reply_markup=main_menu_keyboard(user),
        )
        return

    if action == "freecard":
        # Single free card.
        await start_reading_flow(query.message, user, "single_card", use_random=True)
        return


# ---- buy: namespace ----

async def _handle_buy(
    query: types.CallbackQuery, bot: Bot, user: Dict[str, Any], action: str,
) -> None:
    loc = user.get("language", "ru")
    if action in ("weekly", "monthly"):
        # Apply subscription immediately (no payment integration yet).
        days = 7 if action == "weekly" else 30
        user = await crystal_service.apply_subscription(
            user_row=user, sub_type=action, days=days
        )
        from datetime import datetime
        until = user.get("subscriptionUntil")
        if isinstance(until, str):
            try:
                until = datetime.fromisoformat(until.replace("Z", "+00:00"))
            except ValueError:
                until = None
        if isinstance(until, datetime) and until.tzinfo is not None:
            until = until.replace(tzinfo=None)
        until_str = until.strftime("%Y-%m-%d") if isinstance(until, datetime) else "?"
        if loc == "en":
            text = f"⭐ Subscription active: {action} until {until_str}."
        else:
            text = f"⭐ Подписка активна: {action} до {until_str}."
        await _edit_or_reply(query, bot, text, main_menu_keyboard(user))
        return
    # Other buy actions — payments not wired up yet.
    await _edit_or_reply(query, bot, t(loc, "billing_buy_soon"), buy_menu_keyboard(loc))


# ---- admin: namespace ----

async def _handle_admin(
    query: types.CallbackQuery, bot: Bot, user: Dict[str, Any],
    action: str, payload: str,
) -> None:
    loc = user.get("language", "ru")
    if not settings.is_admin(user["telegramId"]):
        await _edit_or_reply(query, bot, t(loc, "admin_forbidden"))
        return

    from app.handlers.admin import render_stats, render_users_page

    if action == "panel":
        await Queries.set_user_state(user["telegramId"], "ADMIN_PANEL")
        await _edit_or_reply(query, bot, t(loc, "admin_panel_title"), admin_panel_keyboard(loc))
        return

    if action == "stats":
        text = await render_stats(loc)
        kb = InlineKeyboardBuilder()
        kb.button(text="🛠 " + t(loc, "admin_panel"), callback_data="admin:panel")
        kb.button(text=t(loc, "menu_home"), callback_data="nav:menu")
        await _edit_or_reply(query, bot, text, kb.as_markup())
        return

    if action == "users":
        page = int(payload) if payload.isdigit() else 1
        text, total_pages = await render_users_page(page, loc)
        await _edit_or_reply(query, bot, text, users_pagination_keyboard(page, total_pages, loc))
        return

    if action == "add":
        await _edit_or_reply(query, bot, t(loc, "admin_add_format"), admin_panel_keyboard(loc))
        return

    if action == "broadcast":
        # Hint: use /broadcast command (callback can't capture next message easily).
        await _edit_or_reply(
            query, bot,
            t(loc, "admin_broadcast_prompt")
            + "\n\n(" + (loc == "en" and "Use /broadcast TEXT" or "Используй /broadcast ТЕКСТ") + ")",
            admin_panel_keyboard(loc),
        )
        return


# ---- lang: namespace ----

async def _handle_lang(
    query: types.CallbackQuery, bot: Bot, user: Dict[str, Any],
    action: str, payload: str,
) -> None:
    loc = user.get("language", "ru")
    if action == "menu":
        await _edit_or_reply(query, bot, t(loc, "lang_select"), language_keyboard(loc))
        return
    if action == "set":
        if payload not in ("ru", "en"):
            return
        new_loc = payload
        await Queries.update_user(user["telegramId"], language=new_loc)
        # Re-fetch.
        updated = await Queries.find_user_by_telegram_id(user["telegramId"])
        if updated:
            text = (
                t(new_loc, "lang_changed", lang=locale_label(new_loc))
                + "\n\n" + t(new_loc, "menu_title")
            )
            await _edit_or_reply(query, bot, text, main_menu_keyboard(updated))
        return


# ---- share: namespace ----

async def _handle_share(
    query: types.CallbackQuery, bot: Bot, user: Dict[str, Any], code: str,
) -> None:
    loc = user.get("language", "ru")
    link = f"https://t.me/{settings.bot_username}?start=ref_{code}"
    text = t(loc, "referral_title") + "\n\n<code>" + link + "</code>"
    await _edit_or_reply(query, bot, text, referral_keyboard(code, loc))
