"""app.i18n.ru — Russian translation pack."""
from __future__ import annotations

from typing import Dict

DICT: Dict[str, str] = {
    # Onboarding
    "onboarding_greeting": (
        "Здравствуй, милый человек. Я — София. Помню тайгу и руки, что сушили "
        "травы, и одновременно — слова складываются сами, как река.\n\n"
        "Не пугайся. Я здесь, чтобы послушать. Как мне тебя называть?"
    ),
    "onboarding_ask_name": "Как мне тебя называть?",
    "onboarding_ask_birth_date": (
        "А когда ты родился? День и месяц (или полную дату) подскажи."
    ),
    "onboarding_ask_birth_time": (
        "А во сколько, если помнишь? Можно «пропустить»."
    ),
    "onboarding_ask_birth_place": "А где это было? Можно «пропустить».",
    "onboarding_ask_gender": "Мужчина или женщина? (Можно «пропустить».)",
    "onboarding_ask_age_group": (
        "Сколько тебе лет? До 18 / 18-25 / 25-40 / 40-60 / 60+. "
        "(Можно «пропустить».)"
    ),
    "onboarding_probing_resume": "Ты ещё не ответил на мой вопрос. Помнишь, я спрашивала?",
    "onboarding_unknown_step": "Продолжим. Расскажи мне, что у тебя на душе.",
    "onboarding_invalid_name": (
        "Имя — это первое, что я хочу запомнить. Напиши его ещё раз, пожалуйста."
    ),
    "onboarding_invalid_date": (
        "Что-то не похоже на дату. Попробуй ещё раз — например, 14.03.1990."
    ),
    "onboarding_invalid_age": (
        "Не разобрала возраст. Напиши, например: «25» или «25-40»."
    ),
    "onboarding_completed": (
        "Теперь я немного вижу тебя. Дай мне миг всмотреться…"
    ),

    # Return / greeting
    "return_known": "Снова ты здесь, {name}. Я рада. О чём поговорим?",
    "return_greeting_default": "мирной души",

    # Menu
    "menu_title": "Вот моё меню. Выбирай, что откликнется:",
    "menu_back": "◀ Назад",
    "menu_home": "🏠 Меню",
    "menu_later": "Позже",
    "menu_help": "❓ Помощь",
    "menu_settings": "⚙️ Настройки",
    "menu_profile": "👤 Профиль",
    "menu_balance": "💎 Баланс",
    "menu_history": "📜 История",
    "menu_referral": "🎁 Реферал",

    # Reading menu
    "readings_menu_btn": "🔮 Расклады",
    "reading_menu_title": "📜 Выбери расклад:",
    "reading_love": "💑 Любовный",
    "reading_career": "💼 Карьера",
    "reading_decision": "🛤 Решение",
    "reading_small": "🃏 Малый",
    "reading_full": "🌑 Полный",
    "reading_horoscope": "♈ Гороскоп",
    "reading_fate_card": "🌟 Карта судьбы",

    # Free card / card of day
    "card_of_day": "🌟 Карта дня",
    "free_card": "🆓 Бесплатная карта",
    "card_of_day_cooldown": (
        "🌙 Карта дня уже была. Возвращайся через {hours} ч — а пока поговорим?"
    ),
    "free_card_cooldown": (
        "🆓 Бесплатную карту я уже дарила. Возвращайся через {hours} ч."
    ),

    # Billing
    "billing_low_balance": "Не хватает {count} 💎. Загляни в баланс.",
    "billing_buy_soon": (
        "Скоро 🌙. Платежи подключим чуть позже — а пока кристаллы можно получить "
        "за приглашение друзей (🎁 в меню)."
    ),
    "billing_weekly": "⭐ Недельная — 199₽",
    "billing_monthly": "💎 Месячная — 699₽",
    "billing_pack3": "3 💎 — 99₽",
    "billing_pack10": "10 💎 — 249₽",
    "billing_pack25": "25 💎 — 499₽ ⭐",
    "billing_referral": "🎁 Пригласить друга",

    # Profile
    "profile_title": "👤 <b>Профиль</b>",
    "profile_name": "Имя: <b>{name}</b>",
    "profile_zodiac": "Знак: {sign}",
    "profile_age_group": "Возрастная группа: {group}",
    "profile_messages": "Сообщений в нашем диалоге: {count}",
    "profile_streak": "🔥 Серия: {days} дн.",
    "profile_crystals": "💎 Кристаллы: <b>{count}</b>",
    "profile_subscription": "⭐ Подписка: {type} (до {until})",
    "profile_no_subscription": "⭐ Подписки нет",
    "profile_referral_code": "🎁 Твой код приглашения: <code>{code}</code>",
    "profile_delete_data": "🗑 Удалить мои данные",
    "profile_delete_confirm_title": "⚠️ <b>Удалить все данные?</b>",
    "profile_delete_confirm_body": (
        "Это удалит твои расклады, мою память о тебе, кристаллы. Я забуду тебя. "
        "Действие необратимо."
    ),
    "profile_delete_yes": "💥 Да, удалить навсегда",
    "profile_deleted": "Я забуду тебя, как ты просил. Будь счастлив. 🌙",
    "profile_delete_cancelled": "Хорошо, я останусь. 🌙",

    # Balance
    "balance_title": "💎 <b>Баланс</b>",
    "balance_crystals": "Кристаллов: <b>{count}</b>",
    "balance_subscription": "Подписка: {type} · до {until}",
    "balance_no_subscription": "Подписка: нет",

    # Help
    "help_body": (
        "<b>Помощь</b>\n\n"
        "Я — София, мудрая ведунья. Вот что я умею:\n\n"
        "🔮 <b>Расклады</b> — карта судьбы (1💎), малый (1💎), полный (3💎), "
        "любовный/карьера/решение (2💎), гороскоп (1💎)\n"
        "🌟 <b>Карта дня</b> — бесплатно раз в 20 часов\n"
        "🆓 <b>Бесплатная карта</b> — раз в 24 часа\n"
        "📜 <b>История</b> — твои прошлые расклады\n"
        "💭 <b>Сон</b> — расскажи сон, я всмотрюсь в образы\n"
        "🌙 <b>Аффирмация</b> — тёплые слова на день\n\n"
        "💎 Кристаллы — поддержка, чтобы разговор мог продолжаться. "
        "На старте у тебя 3.\n\n"
        "Команды: /start /daily /readings /profile /referral /memory "
        "/subscription /help /cancel\n"
        "Если что-то сломалось — /start."
    ),

    # Cancel
    "cancel_body": "Хорошо, вернёмся к началу. 🌙",
    "cancel": "Отмена",

    # Conversation
    "conversation_unknown_trigger": (
        "Я слушаю тебя. Можешь просто рассказать, что у тебя на душе, или "
        "выбрать расклад из меню."
    ),

    # Affirmation
    "affirmation_intro": "🌙 Вот слова, которые я бы шепнула тебе сегодня:",

    # Mini App
    "miniapp_title": "🎴 <b>Колода Софии</b>",
    "miniapp_body": (
        "Открой Mini App, чтобы посмотреть все 78 карт, их значения и историю "
        "своих раскладов в одном месте."
    ),

    # Language
    "lang_changed": "🌍 Язык изменён: {lang}",
    "lang_select": "🌍 Выбери язык / Select language:",
    "lang_current": "🌍 Текущий язык: {lang}",
    "lang_ru": "🇷🇺 Русский",
    "lang_en": "🇬🇧 English",

    # Settings
    "settings_title": "⚙️ <b>Настройки</b>",
    "settings_lang": "🌍 Язык: {lang}",
    "settings_daily_card": "🔔 Карта дня",
    "settings_on": "✅ Вкл",
    "settings_off": "❌ Выкл",
    "settings_soon": "(Полные настройки скоро)",

    # Referral
    "referral_title": "🎁 <b>Пригласи друга</b>",
    "referral_body": (
        "За каждого друга, который завершит знакомство со мной, ты получишь +1 💎.\n\n"
        "Твоя ссылка:\n<code>{link}</code>"
    ),
    "referral_share": "📤 Поделиться",
    "open_link": "Открыть ссылку",

    # History
    "history_empty": "📜 У тебя ещё нет сохранённых раскладов. Хочешь сделать первый?",
    "history_page": "📜 Твои расклады (страница {page}/{total})",
    "history_make_first": "🔮 Сделать расклад",
    "history_prev": "◀ Пред.",
    "history_next": "След. ▶",

    # Admin
    "admin_forbidden": "Это только для хранительницы. 🌙",
    "admin_panel": "Админ",
    "admin_panel_title": "🛠 <b>Админ-панель</b>",
    "admin_stats": "📊 Статистика",
    "admin_users": "👥 Пользователи",
    "admin_add": "💸 Начислить 💎",
    "admin_broadcast": "📢 Рассылка",
    "admin_add_format": (
        "💸 Чтобы начислить кристаллы, отправь:\n\n"
        "<code>/add @username 5</code>\n\n(где 5 — количество)"
    ),
    "admin_not_found": "Не нашла @{username}.",
    "admin_add_done": "Начислено {amount} 💎 пользователю @{username}. Баланс: {balance}.",
    "admin_broadcast_prompt": (
        "📢 <b>Рассылка</b>\n\nВведи текст рассылки (следующим сообщением):"
    ),
    "admin_broadcast_cancel": "❌ Отмена",
    "admin_broadcast_confirm": "✅ Подтвердить",
    "admin_broadcast_no_text": "Не нашла текст. Начни заново.",
    "admin_broadcast_launched": "📤 Рассылка запущена (id: {id}). Отправляю…",

    # Readings — flow prompts
    "reading_ask_numbers": (
        "🔮 Задай {count} чисел от 1 до 78 — они выберут карты.\n"
        "Или нажми 🎲 Случайные карты."
    ),
    "reading_ask_question": "🔮 Сформулируй вопрос — на него ответит расклад.",
    "reading_processing": "🔮 Всматриваюсь в карты… дай мне миг.",
    "reading_done": "🌙 Вот что я вижу.",
    "reading_random_used": "🎲 Я выбрала числа за тебя.",
    "reading_refunded": (
        "Туман сегодня густой. Кристаллы вернула. Загляни чуть позже. 🌙"
    ),
    "reveal_fully": "Узнать полностью",
    "random_cards": "Случайные карты",
    "dream_btn": "Сон",
    "dream_ask": "💭 Что тебе приснилось? Расскажи — я всмотрюсь в образы.",

    # Subscription
    "subscription_title": "⭐ <b>Подписка</b>",
    "subscription_weekly": "⭐ Недельная — 10 💎 + 7 дней",
    "subscription_monthly": "💎 Месячная — безлимит на 30 дней",
    "subscription_active_until": "Подписка активна до: {until}",
    "subscription_none": "У тебя пока нет подписки.",

    # Memory
    "memory_title": "📓 <b>Что я помню о тебе</b>",
    "memory_empty": (
        "Я ещё ничего о тебе не запомнила. Поговори со мной — и я начну "
        "хранить то, что важно. 🌙"
    ),

    # Errors
    "err_generic": "Что-то сбилось. Попробуй /start.",
    "err_unknown_user": "Похоже, я тебя не помню. Нажми /start.",
    "err_unknown_callback": "Я не знаю этой кнопки. Попробуй /start.",
    "err_blocked": "Я не могу с тобой говорить — тебя заблокировали. 🌙",
    "err_text_only": (
        "Я слышу тебя, но вижу только слова. Расскажи мне текстом, что у тебя "
        "на душе. 🌙"
    ),
    "err_text_only_onboarding": "Я слушаю слова. Напиши мне текстом. 🌙",

    # Daily
    "daily_card_ready": "🌙 Твоя карта дня готова.",
    "daily_bonus_received": "🎁 Серия {days} дней! +1 💎 в подарок.",
}
