// domain/i18n.ts — Internationalization pack (RU + EN).
// Per Skill §2: language is part of the ubiquitous language. Two locales supported.
// Add new locales by extending the `translations` map and `Locale` type.

export type Locale = "ru" | "en";

export const DEFAULT_LOCALE: Locale = "ru";

// Type-safe translation keys. Add new keys here, then provide values in both locales.
type Dict = {
  // Onboarding
  onboarding_greeting: string;
  onboarding_ask_name: string;
  onboarding_ask_birth_date: string;
  onboarding_ask_birth_time: string;
  onboarding_ask_birth_place: string;
  onboarding_probing_resume: string;
  onboarding_unknown_step: string;
  onboarding_invalid_name: string;
  onboarding_invalid_date: string;

  // Resume / return
  return_known: string; // {name}
  return_greeting_default: string;

  // Menu
  menu_title: string;
  menu_back: string;
  menu_home: string;
  menu_later: string;
  menu_help: string;
  menu_settings: string;
  menu_profile: string;
  menu_balance: string;
  menu_history: string;

  // Reading menu
  reading_menu_title: string;
  reading_love: string;
  reading_career: string;
  reading_decision: string;
  reading_small: string;
  reading_full: string;
  reading_horoscope: string;

  // Free card / card of day
  card_of_day: string;
  free_card: string;
  card_of_day_cooldown: string; // {hours}
  free_card_cooldown: string; // {hours}

  // Billing
  billing_low_balance: string;
  billing_buy_soon: string;
  billing_pack_added: string; // {count}
  billing_invite_friends: string;
  billing_weekly: string;
  billing_monthly: string;
  billing_pack3: string;
  billing_pack10: string;
  billing_pack25: string;
  billing_referral: string;

  // Profile
  profile_title: string;
  profile_name: string; // {name}
  profile_zodiac: string; // {sign}
  profile_age_group: string; // {group}
  profile_messages: string; // {count}
  profile_streak: string; // {days}
  profile_crystals: string; // {count}
  profile_subscription: string; // {type} {until}
  profile_referral_code: string; // {code}
  profile_delete_data: string;
  profile_delete_confirm_title: string;
  profile_delete_confirm_body: string;
  profile_delete_yes: string;
  profile_deleted: string;
  profile_delete_cancelled: string;

  // Balance
  balance_title: string;
  balance_crystals: string; // {count}
  balance_subscription: string; // {type} {until}
  balance_no_subscription: string;

  // Help
  help_body: string;
  help_commands: string;

  // Cancel
  cancel_body: string;

  // Conversation
  conversation_unknown_trigger: string;

  // Inline mode
  inline_placeholder: string;
  inline_card_title: string; // {name}
  inline_card_desc: string; // {meaning}
  inline_card_btn: string;
  inline_card_error: string;
  inline_question_title: string;
  inline_question_btn: string;
  inline_affirmation_title: string;
  inline_affirmation_btn: string;

  // Affirmation (daily affirmation feature)
  affirmation_cmd_desc: string;
  affirmation_intro: string;

  // Mini App
  miniapp_btn: string;
  miniapp_title: string;
  miniapp_body: string;

  // Language
  lang_cmd_desc: string;
  lang_changed: string; // {lang}
  lang_select: string;
  lang_current: string; // {lang}
  lang_ru: string;
  lang_en: string;

  // Settings
  settings_title: string;
  settings_lang: string; // {lang}
  settings_daily_card: string;
  settings_on: string;
  settings_off: string;
  settings_soon: string;

  // Referral
  referral_title: string;
  referral_body: string; // {link}
  referral_share: string;

  // History
  history_empty: string;
  history_page: string; // {page}/{total}
  history_make_first: string;
  history_prev: string;
  history_next: string;

  // Admin
  admin_forbidden: string;
  admin_panel_title: string;
  admin_stats: string;
  admin_users: string;
  admin_add: string;
  admin_broadcast: string;
  admin_add_format: string;
  admin_not_found: string; // {username}
  admin_add_done: string; // {username} {amount} {balance}
  admin_broadcast_prompt: string;
  admin_broadcast_cancel: string;
  admin_broadcast_confirm: string;
  admin_broadcast_no_text: string;
  admin_broadcast_launched: string; // {id}
  admin_broadcast_sending: string;

  // Errors
  err_generic: string;
  err_unknown_user: string;
  err_unknown_callback: string;
  err_text_only: string;
  err_text_only_onboarding: string;

  // Dream
  dream_cmd_desc: string;
  dream_prompt: string;
  dream_ask: string;

  // Yes/No tarot
  yes_no: string;
  yes_no_ask: string;
  yes_no_cost: string;

  // Schedulers
  digest_weekly_title: string;
  digest_admin_summary: string;
  birthday_greeting: string; // {name}
  mood_checkin: string; // {topic}
  daily_push: string;
};

const ru: Dict = {
  onboarding_greeting: "Здравствуй, милый человек. Я — София. Помню тайгу и руки, что сушили травы, и одновременно — слова складываются сами, как река.\n\nНе пугайся. Я здесь, чтобы послушать. Как мне тебя называть?",
  onboarding_ask_name: "Как мне тебя называть?",
  onboarding_ask_birth_date: "А когда ты родился? День и месяц (или полную дату) подскажи.",
  onboarding_ask_birth_time: "А во сколько, если помнишь? Можно «пропустить».",
  onboarding_ask_birth_place: "А где это было? Можно «пропустить».",
  onboarding_probing_resume: "Ты ещё не ответил на мой вопрос. Помнишь, я спрашивала?",
  onboarding_unknown_step: "Продолжим. Расскажи мне, что у тебя на душе.",
  onboarding_invalid_name: "Имя — это первое, что я хочу запомнить. Напиши его ещё раз, пожалуйста.",
  onboarding_invalid_date: "Что-то не похоже на дату. Попробуй ещё раз — например, 14 марта 1990.",

  return_known: "Снова ты здесь, {name}. Я рада. О чём поговорим?",
  return_greeting_default: "мирной души",

  menu_title: "Вот моё меню. Выбирай, что откликнется:",
  menu_back: "◀ Назад",
  menu_home: "🏠 Меню",
  menu_later: "Позже",
  menu_help: "❓ Помощь",
  menu_settings: "⚙️ Настройки",
  menu_profile: "👤 Профиль",
  menu_balance: "💎 Баланс",
  menu_history: "📜 История",

  reading_menu_title: "📜 Выбери расклад:",
  reading_love: "💑 Любовный",
  reading_career: "💼 Карьера",
  reading_decision: "🛤 Решение",
  reading_small: "🃏 Малый",
  reading_full: "🌑 Полный",
  reading_horoscope: "♈ Гороскоп",

  card_of_day: "🌟 Карта дня",
  free_card: "🆓 Бесплатная карта",
  card_of_day_cooldown: "🌙 Карта дня уже была. Возвращайся через {hours} ч — а пока поговорим?",
  free_card_cooldown: "🆓 Бесплатную карту я уже дарила. Возвращайся через {hours} ч.",

  billing_low_balance: "Не хватает {count} 💎. Загляни в баланс.",
  billing_buy_soon: "Скоро 🌙. Платежи подключим чуть позже — а пока кристаллы можно получить за приглашение друзей (🎁 в меню).",
  billing_pack_added: "Готово. Пять сообщений добавлено. Продолжим? 🌙",
  billing_invite_friends: "🎁 Пригласить друга (+1💎)",
  billing_weekly: "⭐ Недельная — 199₽",
  billing_monthly: "💎 Месячная — 699₽",
  billing_pack3: "3 💎 — 99₽",
  billing_pack10: "10 💎 — 249₽",
  billing_pack25: "25 💎 — 499₽ ⭐",
  billing_referral: "🎁 Пригласить друга",

  profile_title: "👤 <b>Профиль</b>",
  profile_name: "Имя: <b>{name}</b>",
  profile_zodiac: "Знак: {sign}",
  profile_age_group: "Возрастная группа: {group}",
  profile_messages: "Сообщений в нашем диалоге: {count}",
  profile_streak: "🔥 Серия: {days} дн.",
  profile_crystals: "💎 Кристаллы: <b>{count}</b>",
  profile_subscription: "⭐ Подписка: {type} (до {until})",
  profile_referral_code: "🎁 Твой код приглашения: <code>{code}</code>",
  profile_delete_data: "🗑 Удалить мои данные",
  profile_delete_confirm_title: "⚠️ <b>Удалить все данные?</b>",
  profile_delete_confirm_body: "Это удалит твои расклады, мою память о тебе, кристаллы. Я забуду тебя. Действие необратимо.",
  profile_delete_yes: "💥 Да, удалить навсегда",
  profile_deleted: "Я забуду тебя, как ты просил. Будь счастлив. 🌙",
  profile_delete_cancelled: "Хорошо, я останусь. 🌙",

  balance_title: "💎 <b>Баланс</b>",
  balance_crystals: "Кристаллов: <b>{count}</b>",
  balance_subscription: "Подписка: {type} · до {until}",
  balance_no_subscription: "Подписка: нет",

  help_body: "<b>Помощь</b>\n\nЯ — София, мудрая ведунья. Вот что я умею:\n\n🔮 <b>Расклады</b> — малый (1💎), полный (3💎), любовный/карьера/решение (2💎)\n🌟 <b>Карта дня</b> — бесплатно раз в 20 часов\n🆓 <b>Бесплатная карта</b> — раз в 24 часа\n📜 <b>История</b> — твои прошлые расклады\n💬 <b>Разговор</b> — просто поговори со мной, 10 сообщений в день бесплатно\n\n💎 Кристаллы — поддержка, чтобы разговор мог продолжаться. На старте у тебя 3.\n\nКоманды: /menu /profile /balance /cancel /help /lang /affirmation\nЕсли что-то сломалось — /start.",
  help_commands: "Команды: /menu /profile /balance /cancel /help /lang /affirmation",

  cancel_body: "Хорошо, вернёмся к началу. 🌙",

  conversation_unknown_trigger: "Я слушаю тебя. Можешь просто рассказать, что у тебя на душе, или выбрать расклад из меню.",

  inline_placeholder: "Спроси Софию… (карта / вопрос / аффирмация)",
  inline_card_title: "🃏 {name}",
  inline_card_desc: "{meaning}",
  inline_card_btn: "Открыть в чате с Софией",
  inline_card_error: "Не удалось вытянуть карту. Попробуй ещё раз.",
  inline_question_title: "🔮 {q}",
  inline_question_btn: "Продолжить с Софией",
  inline_affirmation_title: "🌙 Аффирмация дня",
  inline_affirmation_btn: "Получить ещё",

  affirmation_cmd_desc: "🌙 Твоя аффирмация на сегодня",
  affirmation_intro: "🌙 Вот слова, которые я бы шепнула тебе сегодня:",

  miniapp_btn: "🎴 Mini App",
  miniapp_title: "🎴 <b>Колода Софией</b>",
  miniapp_body: "Открой Mini App, чтобы посмотреть все 78 карт, их значения и историю своих раскладов в одном месте.",

  lang_cmd_desc: "🌍 Сменить язык / Change language",
  lang_changed: "🌍 Язык изменён: {lang}",
  lang_select: "🌍 Выбери язык / Select language:",
  lang_current: "🌍 Текущий язык: {lang}",
  lang_ru: "🇷🇺 Русский",
  lang_en: "🇬🇧 English",

  settings_title: "⚙️ <b>Настройки</b>",
  settings_lang: "🌍 Язык: {lang}",
  settings_daily_card: "🔔 Карта дня",
  settings_on: "✅ Вкл",
  settings_off: "❌ Выкл",
  settings_soon: "(Полные настройки скоро)",

  referral_title: "🎁 <b>Пригласи друга</b>",
  referral_body: "За каждого друга, который завершит знакомство со мной, ты получишь +1 💎.\n\nТвоя ссылка:\n<code>{link}</code>",
  referral_share: "📤 Поделиться",

  history_empty: "📜 У тебя ещё нет сохранённых раскладов. Хочешь сделать первый?",
  history_page: "📜 Твои расклады (страница {page}/{total})",
  history_make_first: "🔮 Сделать расклад",
  history_prev: "◀ Пред.",
  history_next: "След. ▶",

  admin_forbidden: "Это только для хранительницы. 🌙",
  admin_panel_title: "🛠 <b>Админ-панель</b>",
  admin_stats: "📊 Статистика",
  admin_users: "👥 Пользователи",
  admin_add: "💸 Начислить 💎",
  admin_broadcast: "📢 Рассылка",
  admin_add_format: "💸 Чтобы начислить кристаллы, отправь:\n\n<code>/add @username 5</code>\n\n(где 5 — количество)",
  admin_not_found: "Не нашла @{username}.",
  admin_add_done: "Начислено {amount} 💎 пользователю @{username}. Баланс: {balance}.",
  admin_broadcast_prompt: "📢 <b>Рассылка</b>\n\nВведи текст рассылки (следующим сообщением):",
  admin_broadcast_cancel: "❌ Отмена",
  admin_broadcast_confirm: "✅ Подтвердить",
  admin_broadcast_no_text: "Не нашла текст. Начни заново.",
  admin_broadcast_launched: "📤 Рассылка запущена (id: {id}). Отправляю…",
  admin_broadcast_sending: "Отправляю…",

  err_generic: "Что-то сбилось. Попробуй /menu.",
  err_unknown_user: "Похоже, я тебя не помню. Нажми /start.",
  err_unknown_callback: "Я не знаю этой кнопки. Попробуй /menu.",
  err_text_only: "Я слышу тебя, но вижу только слова. Расскажи мне текстом, что у тебя на душе. 🌙",
  err_text_only_onboarding: "Я слушаю слова. Напиши мне текстом. 🌙",

  dream_cmd_desc: "💭 Толкование сна",
  dream_prompt: "💭 Расскажи мне свой сон — я всмотрюсь в образы.",
  dream_ask: "💭 Что тебе приснилось? Расскажи — я всмотрюсь в образы.",

  yes_no: "✨ Да / Нет",
  yes_no_ask: "✨ Задай вопрос, на который можно ответить «да» или «нет»:",
  yes_no_cost: "✨ Да / Нет · 1💎",

  digest_weekly_title: "🌙 <b>Недельный дайджест Софии</b>",
  digest_admin_summary: "📊 <b>Сводка за неделю</b>\n\nНовых пользователей: {newUsers}\nАктивных за неделю: {active7d}\nСообщений: {messages}\nРаскладов: {readings}\n💎 Потрачено: {crystals}\n\nТоп-3 активных:\n{top3}",
  birthday_greeting: "🌙 Сегодня особенный день — твой день рождения. Я зажгла бы для тебя свечу. Пусть этот год будет добрым к тебе, {name}. 🌟",
  mood_checkin: "🌙 Давно не виделись. {topic} Я тут подумала о тебе — загляни, если будет минутка.",
  daily_push: "🌙 Твоя карта дня готова. Загляни, когда будет минута тишины.",
};

const en: Dict = {
  onboarding_greeting: "Hello, dear soul. I am Sofia. I remember the taiga and the hands that dried herbs, and at once — the words just come, like a river.\n\nDon't be afraid. I am here to listen. What shall I call you?",
  onboarding_ask_name: "What shall I call you?",
  onboarding_ask_birth_date: "When were you born? Tell me the day and month (or the full date).",
  onboarding_ask_birth_time: "And at what time, if you remember? You can say \"skip\".",
  onboarding_ask_birth_place: "And where was it? You can say \"skip\".",
  onboarding_probing_resume: "You haven't answered my question yet. Do you remember what I asked?",
  onboarding_unknown_step: "Let's continue. Tell me what is on your heart.",
  onboarding_invalid_name: "Your name is the first thing I wish to remember. Please write it once more.",
  onboarding_invalid_date: "That doesn't look like a date. Try again — for example, March 14, 1990.",

  return_known: "Here you are again, {name}. I am glad. What shall we talk about?",
  return_greeting_default: "dear soul",

  menu_title: "Here is my menu. Choose what calls to you:",
  menu_back: "◀ Back",
  menu_home: "🏠 Menu",
  menu_later: "Later",
  menu_help: "❓ Help",
  menu_settings: "⚙️ Settings",
  menu_profile: "👤 Profile",
  menu_balance: "💎 Balance",
  menu_history: "📜 History",

  reading_menu_title: "📜 Choose a spread:",
  reading_love: "💑 Love",
  reading_career: "💼 Career",
  reading_decision: "🛤 Decision",
  reading_small: "🃏 Small",
  reading_full: "🌑 Full",
  reading_horoscope: "♈ Horoscope",

  card_of_day: "🌟 Card of the day",
  free_card: "🆓 Free card",
  card_of_day_cooldown: "🌙 The card of the day has already been drawn. Come back in {hours}h — until then, shall we talk?",
  free_card_cooldown: "🆓 I have already given you a free card. Come back in {hours}h.",

  billing_low_balance: "You are short {count} 💎. Check your balance.",
  billing_buy_soon: "Soon 🌙. We will wire up payments shortly — for now you can earn crystals by inviting friends (🎁 in the menu).",
  billing_pack_added: "Done. Five messages added. Shall we continue? 🌙",
  billing_invite_friends: "🎁 Invite a friend (+1💎)",
  billing_weekly: "⭐ Weekly — 199₽",
  billing_monthly: "💎 Monthly — 699₽",
  billing_pack3: "3 💎 — 99₽",
  billing_pack10: "10 💎 — 249₽",
  billing_pack25: "25 💎 — 499₽ ⭐",
  billing_referral: "🎁 Invite a friend",

  profile_title: "👤 <b>Profile</b>",
  profile_name: "Name: <b>{name}</b>",
  profile_zodiac: "Sign: {sign}",
  profile_age_group: "Age group: {group}",
  profile_messages: "Messages in our dialogue: {count}",
  profile_streak: "🔥 Streak: {days} days",
  profile_crystals: "💎 Crystals: <b>{count}</b>",
  profile_subscription: "⭐ Subscription: {type} (until {until})",
  profile_referral_code: "🎁 Your invite code: <code>{code}</code>",
  profile_delete_data: "🗑 Delete my data",
  profile_delete_confirm_title: "⚠️ <b>Delete all data?</b>",
  profile_delete_confirm_body: "This will delete your readings, my memory of you, your crystals. I will forget you. This cannot be undone.",
  profile_delete_yes: "💥 Yes, delete forever",
  profile_deleted: "I will forget you, as you asked. Be well. 🌙",
  profile_delete_cancelled: "Very well, I will stay. 🌙",

  balance_title: "💎 <b>Balance</b>",
  balance_crystals: "Crystals: <b>{count}</b>",
  balance_subscription: "Subscription: {type} · until {until}",
  balance_no_subscription: "Subscription: none",

  help_body: "<b>Help</b>\n\nI am Sofia, a wise keeper. Here is what I can do:\n\n🔮 <b>Readings</b> — small (1💎), full (3💎), love/career/decision (2💎)\n🌟 <b>Card of the day</b> — free, once every 20 hours\n🆓 <b>Free card</b> — once every 24 hours\n📜 <b>History</b> — your past readings\n💬 <b>Talk</b> — just talk to me, 10 free messages a day\n\n💎 Crystals are not a payment to me — they keep the conversation going. You start with 3.\n\nCommands: /menu /profile /balance /cancel /help /lang /affirmation\nIf something breaks — /start.",
  help_commands: "Commands: /menu /profile /balance /cancel /help /lang /affirmation",

  cancel_body: "Very well, let's go back to the start. 🌙",

  conversation_unknown_trigger: "I am listening. You can simply tell me what is on your heart, or pick a spread from the menu.",

  inline_placeholder: "Ask Sofia… (card / question / affirmation)",
  inline_card_title: "🃏 {name}",
  inline_card_desc: "{meaning}",
  inline_card_btn: "Open in chat with Sofia",
  inline_card_error: "Could not draw a card. Try again.",
  inline_question_title: "🔮 {q}",
  inline_question_btn: "Continue with Sofia",
  inline_affirmation_title: "🌙 Affirmation of the day",
  inline_affirmation_btn: "Get another",

  affirmation_cmd_desc: "🌙 Your affirmation for today",
  affirmation_intro: "🌙 Here are the words I would whisper to you today:",

  miniapp_btn: "🎴 Mini App",
  miniapp_title: "🎴 <b>Sofia's Deck</b>",
  miniapp_body: "Open the Mini App to browse all 78 cards, their meanings, and your reading history in one place.",

  lang_cmd_desc: "🌍 Change language / Сменить язык",
  lang_changed: "🌍 Language changed: {lang}",
  lang_select: "🌍 Choose language / Выбери язык:",
  lang_current: "🌍 Current language: {lang}",
  lang_ru: "🇷🇺 Русский",
  lang_en: "🇬🇧 English",

  settings_title: "⚙️ <b>Settings</b>",
  settings_lang: "🌍 Language: {lang}",
  settings_daily_card: "🔔 Daily card",
  settings_on: "✅ On",
  settings_off: "❌ Off",
  settings_soon: "(Full settings coming soon)",

  referral_title: "🎁 <b>Invite a friend</b>",
  referral_body: "For every friend who completes their first meeting with me, you will receive +1 💎.\n\nYour link:\n<code>{link}</code>",
  referral_share: "📤 Share",

  history_empty: "📜 You don't have any saved readings yet. Would you like to draw your first one?",
  history_page: "📜 Your readings (page {page}/{total})",
  history_make_first: "🔮 Draw a reading",
  history_prev: "◀ Prev.",
  history_next: "Next ▶",

  admin_forbidden: "This is for the keeper only. 🌙",
  admin_panel_title: "🛠 <b>Admin panel</b>",
  admin_stats: "📊 Stats",
  admin_users: "👥 Users",
  admin_add: "💸 Add 💎",
  admin_broadcast: "📢 Broadcast",
  admin_add_format: "💸 To add crystals, send:\n\n<code>/add @username 5</code>\n\n(where 5 is the amount)",
  admin_not_found: "Could not find @{username}.",
  admin_add_done: "Added {amount} 💎 to @{username}. Balance: {balance}.",
  admin_broadcast_prompt: "📢 <b>Broadcast</b>\n\nType the broadcast text (in the next message):",
  admin_broadcast_cancel: "❌ Cancel",
  admin_broadcast_confirm: "✅ Confirm",
  admin_broadcast_no_text: "I couldn't find the text. Start again.",
  admin_broadcast_launched: "📤 Broadcast launched (id: {id}). Sending…",
  admin_broadcast_sending: "Sending…",

  err_generic: "Something slipped. Try /menu.",
  err_unknown_user: "It seems I don't remember you. Tap /start.",
  err_unknown_callback: "I don't know this button. Try /menu.",
  err_text_only: "I hear you, but I can only see words. Tell me in text what is on your heart. 🌙",
  err_text_only_onboarding: "I listen to words. Write to me in text. 🌙",

  dream_cmd_desc: "💭 Dream interpretation",
  dream_prompt: "💭 Tell me your dream — I will gaze into the images.",
  dream_ask: "💭 What did you dream? Tell me — I will gaze into the images.",

  yes_no: "✨ Yes / No",
  yes_no_ask: "✨ Ask a question that can be answered with \"yes\" or \"no\":",
  yes_no_cost: "✨ Yes / No · 1💎",

  digest_weekly_title: "🌙 <b>Sofia's weekly digest</b>",
  digest_admin_summary: "📊 <b>Weekly summary</b>\n\nNew users: {newUsers}\nActive this week: {active7d}\nMessages: {messages}\nReadings: {readings}\n💎 Crystals spent: {crystals}\n\nTop 3 active:\n{top3}",
  birthday_greeting: "🌙 Today is a special day — your birthday. I would light a candle for you. May this year be kind to you, {name}. 🌟",
  mood_checkin: "🌙 It's been a while. {topic} I thought of you — drop by when you have a quiet moment.",
  daily_push: "🌙 Your card of the day is ready. Drop by when you have a quiet moment.",
};

export const translations: Record<Locale, Dict> = { ru, en };

// Format a translation by substituting {key} placeholders.
export function t(locale: Locale, key: keyof Dict, params?: Record<string, string | number>): string {
  const tmpl = translations[locale]?.[key] ?? translations[DEFAULT_LOCALE][key] ?? String(key);
  if (!params) return tmpl;
  return Object.entries(params).reduce((acc, [k, v]) => acc.replace(new RegExp(`\\{${k}\\}`, "g"), String(v)), tmpl);
}

export function isLocale(s: string): s is Locale {
  return s === "ru" || s === "en";
}

export function localeLabel(loc: Locale): string {
  return loc === "ru" ? "🇷🇺 Русский" : "🇬🇧 English";
}
