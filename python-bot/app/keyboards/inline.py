"""app.keyboards.inline — all inline keyboard builders.

Callback data convention: "ns:action[:payload]" — namespaced, <64 bytes.
Examples:
    nav:menu
    rd:pick:tarot_love
    admin:stats
    lang:set:ru
"""
from __future__ import annotations

from typing import Any, Dict, Optional

from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup
from aiogram.utils.keyboard import InlineKeyboardBuilder

from app.config import settings
from app.i18n import locale_label, t


def _kb() -> InlineKeyboardBuilder:
    return InlineKeyboardBuilder()


def main_menu_keyboard(user_row: Dict[str, Any]) -> InlineKeyboardMarkup:
    loc = user_row.get("language", "ru")
    crystals = user_row.get("crystals", 0)
    kb = _kb()
    kb.button(text=t(loc, "readings_menu_btn"), callback_data="rd:menu")
    kb.button(text=t(loc, "card_of_day"), callback_data="rd:cardday")
    kb.button(text=t(loc, "free_card"), callback_data="rd:freecard")
    kb.row(
        InlineKeyboardButton(text=t(loc, "menu_history"), callback_data="nav:history"),
        InlineKeyboardButton(text=t(loc, "menu_profile"), callback_data="nav:profile"),
        InlineKeyboardButton(text=f"💎 {crystals}", callback_data="nav:balance"),
    )
    kb.button(text="💭 " + t(loc, "dream_btn"), callback_data="nav:dream")
    kb.button(text=t(loc, "menu_settings"), callback_data="nav:settings")
    kb.row(
        InlineKeyboardButton(text=t(loc, "menu_help"), callback_data="nav:help"),
        InlineKeyboardButton(text=t(loc, "menu_referral"), callback_data="nav:referral"),
    )
    return kb.as_markup()


def back_home_keyboard(loc: str = "ru") -> InlineKeyboardMarkup:
    kb = _kb()
    kb.button(text=t(loc, "menu_back"), callback_data="nav:back")
    kb.button(text=t(loc, "menu_home"), callback_data="nav:menu")
    return kb.as_markup()


def home_only_keyboard(loc: str = "ru") -> InlineKeyboardMarkup:
    kb = _kb()
    kb.button(text=t(loc, "menu_home"), callback_data="nav:menu")
    return kb.as_markup()


def reading_menu_keyboard(loc: str = "ru") -> InlineKeyboardMarkup:
    kb = _kb()
    kb.button(text=f"{t(loc, 'reading_fate_card')} · 1💎", callback_data="rd:pick:fate_card")
    kb.button(text=f"{t(loc, 'reading_love')} · 2💎", callback_data="rd:pick:tarot_love")
    kb.button(text=f"{t(loc, 'reading_career')} · 2💎", callback_data="rd:pick:tarot_career")
    kb.button(text=f"{t(loc, 'reading_decision')} · 2💎", callback_data="rd:pick:tarot_decision")
    kb.button(text=f"{t(loc, 'reading_small')} · 1💎", callback_data="rd:pick:tarot_small")
    kb.button(text=f"{t(loc, 'reading_full')} · 3💎", callback_data="rd:pick:tarot_full")
    kb.button(text=f"{t(loc, 'reading_horoscope')} · 1💎", callback_data="rd:pick:horoscope")
    kb.row(
        InlineKeyboardButton(text=t(loc, "menu_back"), callback_data="nav:back"),
        InlineKeyboardButton(text=t(loc, "menu_home"), callback_data="nav:menu"),
    )
    return kb.as_markup()


def buy_menu_keyboard(loc: str = "ru") -> InlineKeyboardMarkup:
    kb = _kb()
    kb.button(text=t(loc, "billing_weekly"), callback_data="buy:weekly")
    kb.button(text=t(loc, "billing_monthly"), callback_data="buy:monthly")
    kb.row(
        InlineKeyboardButton(text=t(loc, "billing_pack3"), callback_data="buy:pack3"),
        InlineKeyboardButton(text=t(loc, "billing_pack10"), callback_data="buy:pack10"),
    )
    kb.button(text=t(loc, "billing_pack25"), callback_data="buy:pack25")
    kb.button(text=t(loc, "billing_referral"), callback_data="nav:referral")
    kb.row(
        InlineKeyboardButton(text=t(loc, "menu_back"), callback_data="nav:back"),
        InlineKeyboardButton(text=t(loc, "menu_home"), callback_data="nav:menu"),
    )
    return kb.as_markup()


def paid_hook_keyboard(loc: str = "ru") -> InlineKeyboardMarkup:
    kb = _kb()
    kb.button(text="🔮 " + t(loc, "reveal_fully"), callback_data="rd:menu")
    kb.button(text=t(loc, "menu_later"), callback_data="nav:later")
    return kb.as_markup()


def delete_confirm_keyboard(loc: str = "ru") -> InlineKeyboardMarkup:
    kb = _kb()
    kb.button(text="❌ " + t(loc, "cancel"), callback_data="nav:cancel_delete")
    kb.button(text=t(loc, "profile_delete_yes"), callback_data="nav:confirm_delete")
    return kb.as_markup()


def admin_panel_keyboard(loc: str = "ru") -> InlineKeyboardMarkup:
    kb = _kb()
    kb.button(text=t(loc, "admin_stats"), callback_data="admin:stats")
    kb.button(text=t(loc, "admin_users"), callback_data="admin:users")
    kb.button(text=t(loc, "admin_broadcast"), callback_data="admin:broadcast")
    kb.button(text=t(loc, "admin_add"), callback_data="admin:add")
    kb.button(text=t(loc, "menu_home"), callback_data="nav:menu")
    return kb.as_markup()


def referral_keyboard(code: str, loc: str = "ru") -> InlineKeyboardMarkup:
    link = f"https://t.me/{settings.bot_username}?start=ref_{code}"
    kb = _kb()
    kb.button(text=t(loc, "referral_share"), switch_inline_query=link)
    kb.button(text="🔗 " + t(loc, "open_link"), url=link)
    kb.button(text=t(loc, "menu_home"), callback_data="nav:menu")
    return kb.as_markup()


def language_keyboard(loc: str = "ru") -> InlineKeyboardMarkup:
    kb = _kb()
    kb.button(text=t(loc, "lang_ru"), callback_data="lang:set:ru")
    kb.button(text=t(loc, "lang_en"), callback_data="lang:set:en")
    kb.row(
        InlineKeyboardButton(text=t(loc, "menu_back"), callback_data="nav:back"),
        InlineKeyboardButton(text=t(loc, "menu_home"), callback_data="nav:menu"),
    )
    return kb.as_markup()


def settings_keyboard(user_row: Dict[str, Any]) -> InlineKeyboardMarkup:
    loc = user_row.get("language", "ru")
    kb = _kb()
    kb.button(
        text=t(loc, "settings_lang", lang=locale_label(loc)),
        callback_data="lang:menu",
    )
    kb.row(
        InlineKeyboardButton(text=t(loc, "menu_back"), callback_data="nav:back"),
        InlineKeyboardButton(text=t(loc, "menu_home"), callback_data="nav:menu"),
    )
    return kb.as_markup()


def history_pagination_keyboard(page: int, total_pages: int, loc: str = "ru") -> InlineKeyboardMarkup:
    kb = _kb()
    if page > 1:
        kb.button(text=t(loc, "history_prev"), callback_data=f"nav:history:{page - 1}")
    kb.button(text=f"{page}/{total_pages}", callback_data="nav:none")
    if page < total_pages:
        kb.button(text=t(loc, "history_next"), callback_data=f"nav:history:{page + 1}")
    kb.row(
        InlineKeyboardButton(text=t(loc, "menu_back"), callback_data="nav:back"),
        InlineKeyboardButton(text=t(loc, "menu_home"), callback_data="nav:menu"),
    )
    return kb.as_markup()


def users_pagination_keyboard(page: int, total_pages: int, loc: str = "ru") -> InlineKeyboardMarkup:
    kb = _kb()
    if page > 1:
        kb.button(text="◀", callback_data=f"admin:users:{page - 1}")
    kb.button(text=f"{page}/{total_pages}", callback_data="nav:none")
    if page < total_pages:
        kb.button(text="▶", callback_data=f"admin:users:{page + 1}")
    kb.button(text="🛠 " + t(loc, "admin_panel"), callback_data="admin:panel")
    return kb.as_markup()


def reading_numbers_keyboard(reading_type: str, loc: str = "ru") -> InlineKeyboardMarkup:
    """Shown when waiting for the user to type their card numbers."""
    kb = _kb()
    kb.button(text="🎲 " + t(loc, "random_cards"), callback_data=f"rd:random:{reading_type}")
    kb.row(
        InlineKeyboardButton(text=t(loc, "menu_back"), callback_data="rd:menu"),
        InlineKeyboardButton(text=t(loc, "menu_home"), callback_data="nav:menu"),
    )
    return kb.as_markup()


def subscription_keyboard(loc: str = "ru") -> InlineKeyboardMarkup:
    kb = _kb()
    kb.button(text=t(loc, "billing_weekly"), callback_data="buy:weekly")
    kb.button(text=t(loc, "billing_monthly"), callback_data="buy:monthly")
    kb.button(text=t(loc, "menu_home"), callback_data="nav:menu")
    return kb.as_markup()


def confirm_keyboard(
    *, confirm_cb: str, cancel_cb: str, confirm_text: str, cancel_text: str
) -> InlineKeyboardMarkup:
    kb = _kb()
    kb.button(text=confirm_text, callback_data=confirm_cb)
    kb.button(text=cancel_text, callback_data=cancel_cb)
    return kb.as_markup()
