"""app.i18n.en — English translation pack."""
from __future__ import annotations

from typing import Dict

DICT: Dict[str, str] = {
    # Onboarding
    "onboarding_greeting": (
        "Hello, dear soul. I am Sofia. I remember the taiga and the hands that "
        "dried herbs, and at once — the words just come, like a river.\n\n"
        "Don't be afraid. I am here to listen. What shall I call you?"
    ),
    "onboarding_ask_name": "What shall I call you?",
    "onboarding_ask_birth_date": (
        "When were you born? Tell me the day and month (or the full date)."
    ),
    "onboarding_ask_birth_time": (
        "And at what time, if you remember? You can say \"skip\"."
    ),
    "onboarding_ask_birth_place": "And where was it? You can say \"skip\".",
    "onboarding_ask_gender": "Male or female? (Or \"skip\".)",
    "onboarding_ask_age_group": (
        "How old are you? Under 18 / 18-25 / 25-40 / 40-60 / 60+. (Or \"skip\".)"
    ),
    "onboarding_probing_resume": (
        "You haven't answered my question yet. Do you remember what I asked?"
    ),
    "onboarding_unknown_step": "Let's continue. Tell me what is on your heart.",
    "onboarding_invalid_name": (
        "Your name is the first thing I wish to remember. Please write it once more."
    ),
    "onboarding_invalid_date": (
        "That doesn't look like a date. Try again — for example, 1990-03-14."
    ),
    "onboarding_invalid_age": (
        "I didn't catch the age. Try something like \"25\" or \"25-40\"."
    ),
    "onboarding_completed": "Now I see you a little. Give me a moment to look closer…",

    # Return / greeting
    "return_known": "Here you are again, {name}. I am glad. What shall we talk about?",
    "return_greeting_default": "dear soul",

    # Menu
    "menu_title": "Here is my menu. Choose what calls to you:",
    "menu_back": "◀ Back",
    "menu_home": "🏠 Menu",
    "menu_later": "Later",
    "menu_help": "❓ Help",
    "menu_settings": "⚙️ Settings",
    "menu_profile": "👤 Profile",
    "menu_balance": "💎 Balance",
    "menu_history": "📜 History",
    "menu_referral": "🎁 Referral",

    # Reading menu
    "readings_menu_btn": "🔮 Readings",
    "reading_menu_title": "📜 Choose a spread:",
    "reading_love": "💑 Love",
    "reading_career": "💼 Career",
    "reading_decision": "🛤 Decision",
    "reading_small": "🃏 Small",
    "reading_full": "🌑 Full",
    "reading_horoscope": "♈ Horoscope",
    "reading_fate_card": "🌟 Fate card",

    # Free card / card of day
    "card_of_day": "🌟 Card of the day",
    "free_card": "🆓 Free card",
    "card_of_day_cooldown": (
        "🌙 The card of the day has already been drawn. Come back in {hours}h — "
        "until then, shall we talk?"
    ),
    "free_card_cooldown": (
        "🆓 I have already given you a free card. Come back in {hours}h."
    ),

    # Billing
    "billing_low_balance": "You are short {count} 💎. Check your balance.",
    "billing_buy_soon": (
        "Soon 🌙. We will wire up payments shortly — for now you can earn "
        "crystals by inviting friends (🎁 in the menu)."
    ),
    "billing_weekly": "⭐ Weekly — 199₽",
    "billing_monthly": "💎 Monthly — 699₽",
    "billing_pack3": "3 💎 — 99₽",
    "billing_pack10": "10 💎 — 249₽",
    "billing_pack25": "25 💎 — 499₽ ⭐",
    "billing_referral": "🎁 Invite a friend",

    # Profile
    "profile_title": "👤 <b>Profile</b>",
    "profile_name": "Name: <b>{name}</b>",
    "profile_zodiac": "Sign: {sign}",
    "profile_age_group": "Age group: {group}",
    "profile_messages": "Messages in our dialogue: {count}",
    "profile_streak": "🔥 Streak: {days} days",
    "profile_crystals": "💎 Crystals: <b>{count}</b>",
    "profile_subscription": "⭐ Subscription: {type} (until {until})",
    "profile_no_subscription": "⭐ No subscription",
    "profile_referral_code": "🎁 Your invite code: <code>{code}</code>",
    "profile_delete_data": "🗑 Delete my data",
    "profile_delete_confirm_title": "⚠️ <b>Delete all data?</b>",
    "profile_delete_confirm_body": (
        "This will delete your readings, my memory of you, your crystals. "
        "I will forget you. This cannot be undone."
    ),
    "profile_delete_yes": "💥 Yes, delete forever",
    "profile_deleted": "I will forget you, as you asked. Be well. 🌙",
    "profile_delete_cancelled": "Very well, I will stay. 🌙",

    # Balance
    "balance_title": "💎 <b>Balance</b>",
    "balance_crystals": "Crystals: <b>{count}</b>",
    "balance_subscription": "Subscription: {type} · until {until}",
    "balance_no_subscription": "Subscription: none",

    # Help
    "help_body": (
        "<b>Help</b>\n\n"
        "I am Sofia, a wise keeper. Here is what I can do:\n\n"
        "🔮 <b>Readings</b> — fate card (1💎), small (1💎), full (3💎), "
        "love/career/decision (2💎), horoscope (1💎)\n"
        "🌟 <b>Card of the day</b> — free, once every 20 hours\n"
        "🆓 <b>Free card</b> — once every 24 hours\n"
        "📜 <b>History</b> — your past readings\n"
        "💭 <b>Dream</b> — tell me a dream, I will gaze into the images\n"
        "🌙 <b>Affirmation</b> — warm words for the day\n\n"
        "💎 Crystals keep the conversation going. You start with 3.\n\n"
        "Commands: /start /daily /readings /profile /referral /memory "
        "/subscription /help /cancel\n"
        "If something breaks — /start."
    ),

    # Cancel
    "cancel_body": "Very well, let's go back to the start. 🌙",
    "cancel": "Cancel",

    # Conversation
    "conversation_unknown_trigger": (
        "I am listening. You can simply tell me what is on your heart, or pick "
        "a spread from the menu."
    ),

    # Affirmation
    "affirmation_intro": "🌙 Here are the words I would whisper to you today:",

    # Mini App
    "miniapp_title": "🎴 <b>Sofia's Deck</b>",
    "miniapp_body": (
        "Open the Mini App to browse all 78 cards, their meanings, and your "
        "reading history in one place."
    ),

    # Language
    "lang_changed": "🌍 Language changed: {lang}",
    "lang_select": "🌍 Choose language / Выбери язык:",
    "lang_current": "🌍 Current language: {lang}",
    "lang_ru": "🇷🇺 Русский",
    "lang_en": "🇬🇧 English",

    # Settings
    "settings_title": "⚙️ <b>Settings</b>",
    "settings_lang": "🌍 Language: {lang}",
    "settings_daily_card": "🔔 Daily card",
    "settings_on": "✅ On",
    "settings_off": "❌ Off",
    "settings_soon": "(Full settings coming soon)",

    # Referral
    "referral_title": "🎁 <b>Invite a friend</b>",
    "referral_body": (
        "For every friend who completes their first meeting with me, you will "
        "receive +1 💎.\n\nYour link:\n<code>{link}</code>"
    ),
    "referral_share": "📤 Share",
    "open_link": "Open link",

    # History
    "history_empty": "📜 You don't have any saved readings yet. Would you like to draw your first one?",
    "history_page": "📜 Your readings (page {page}/{total})",
    "history_make_first": "🔮 Draw a reading",
    "history_prev": "◀ Prev.",
    "history_next": "Next ▶",

    # Admin
    "admin_forbidden": "This is for the keeper only. 🌙",
    "admin_panel": "Admin",
    "admin_panel_title": "🛠 <b>Admin panel</b>",
    "admin_stats": "📊 Stats",
    "admin_users": "👥 Users",
    "admin_add": "💸 Add 💎",
    "admin_broadcast": "📢 Broadcast",
    "admin_add_format": (
        "💸 To add crystals, send:\n\n"
        "<code>/add @username 5</code>\n\n(where 5 is the amount)"
    ),
    "admin_not_found": "Could not find @{username}.",
    "admin_add_done": "Added {amount} 💎 to @{username}. Balance: {balance}.",
    "admin_broadcast_prompt": "📢 <b>Broadcast</b>\n\nType the broadcast text (in the next message):",
    "admin_broadcast_cancel": "❌ Cancel",
    "admin_broadcast_confirm": "✅ Confirm",
    "admin_broadcast_no_text": "I couldn't find the text. Start again.",
    "admin_broadcast_launched": "📤 Broadcast launched (id: {id}). Sending…",

    # Readings — flow prompts
    "reading_ask_numbers": (
        "🔮 Pick {count} numbers from 1 to 78 — they will choose the cards.\n"
        "Or tap 🎲 Random cards."
    ),
    "reading_ask_question": "🔮 Form a question — the reading will answer it.",
    "reading_processing": "🔮 Gazing into the cards… give me a moment.",
    "reading_done": "🌙 Here is what I see.",
    "reading_random_used": "🎲 I picked the numbers for you.",
    "reading_refunded": (
        "The mist is thick today. I returned your crystals. Drop by later. 🌙"
    ),
    "reveal_fully": "Reveal fully",
    "random_cards": "Random cards",
    "dream_btn": "Dream",
    "dream_ask": "💭 What did you dream? Tell me — I will gaze into the images.",

    # Subscription
    "subscription_title": "⭐ <b>Subscription</b>",
    "subscription_weekly": "⭐ Weekly — 10 💎 + 7 days",
    "subscription_monthly": "💎 Monthly — unlimited for 30 days",
    "subscription_active_until": "Subscription active until: {until}",
    "subscription_none": "You don't have a subscription yet.",

    # Memory
    "memory_title": "📓 <b>What I remember about you</b>",
    "memory_empty": (
        "I don't remember anything about you yet. Talk to me — and I will "
        "begin to keep what matters. 🌙"
    ),

    # Errors
    "err_generic": "Something slipped. Try /start.",
    "err_unknown_user": "It seems I don't remember you. Tap /start.",
    "err_unknown_callback": "I don't know this button. Try /start.",
    "err_blocked": "I cannot speak with you — you have been blocked. 🌙",
    "err_text_only": (
        "I hear you, but I can only see words. Tell me in text what is on your heart. 🌙"
    ),
    "err_text_only_onboarding": "I listen to words. Write to me in text. 🌙",

    # Daily
    "daily_card_ready": "🌙 Your card of the day is ready.",
    "daily_bonus_received": "🎁 {days}-day streak! +1 💎 as a gift.",
}
