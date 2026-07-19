// i18n — RU + EN strings for the Sofia bot.
// Ported from python-bot/app/i18n/{ru,en}.py.
//
// `t(key, locale, params?)` interpolates {placeholders}.

export type Locale = 'ru' | 'en';

export const STRINGS: Record<string, Record<Locale, string>> = {
  // ── errors ──────────────────────────────────────────────────────────
  err_unknown_user: {
    ru: 'Я тебя не узнаю. Напиши /start — познакомимся.',
    en: "I don't recognize you. Send /start so we can meet.",
  },
  err_blocked: {
    ru: 'Ты пока не можешь писать мне. Если это ошибка — напиши администратору.',
    en: 'You cannot write to me right now. If this is a mistake, contact the admin.',
  },
  err_generic: {
    ru: 'Туман сегодня густой. Попробуй ещё раз чуть позже. 🌙',
    en: 'The mist is thick today. Try again a little later. 🌙',
  },
  err_unknown_callback: {
    ru: 'Не пойму, что ты выбрал. Попробуй ещё раз.',
    en: "I'm not sure what you picked. Try again.",
  },

  // ── onboarding ──────────────────────────────────────────────────────
  onboarding_greeting: {
    ru: 'Привет, милый. Я — София. Зовут тебя как?',
    en: 'Hello, dear. I am Sofia. What is your name?',
  },
  onboarding_ask_name: {
    ru: 'Назови своё имя — так мне будет проще с тобой говорить.',
    en: 'Tell me your name — it helps me speak with you.',
  },
  onboarding_invalid_name: {
    ru: 'Имя слишком короткое. Назови, как тебя зовут?',
    en: "That's too short. What is your name?",
  },
  onboarding_ask_birth_date: {
    ru: 'А когда ты родился? День и месяц подскажи, или полную дату — так я лучше увижу твой знак.',
    en: 'When were you born? The day and month, or the full date — it helps me see your sign.',
  },
  onboarding_invalid_date: {
    ru: 'Не разберу дату. Попробуй так: 14.03.1990 — день, месяц, год.',
    en: "I can't parse that. Try: 14.03.1990 — day, month, year.",
  },
  onboarding_ask_birth_time: {
    ru: 'А во сколько ты родился, если помнишь? Можно «пропустить» — это не главное.',
    en: 'And at what time were you born, if you remember? You can say "skip".',
  },
  onboarding_ask_birth_place: {
    ru: 'А где ты родился? Можно «пропустить».',
    en: 'And where were you born? You can say "skip".',
  },
  onboarding_ask_gender: {
    ru: 'Мужчина или женщина? Если не хочешь говорить — «пропустить».',
    en: 'Man or woman? You can say "skip".',
  },
  onboarding_ask_age_group: {
    ru: 'Сколько тебе лет? Или просто «пропустить».',
    en: 'How old are you? Or just "skip".',
  },
  onboarding_probing_resume: {
    ru: 'Я ждала твой ответ. Что у тебя на сердце?',
    en: 'I was waiting for your answer. What is on your heart?',
  },
  onboarding_unknown_step: {
    ru: 'Что-то сбилось. Напиши /start — продолжим.',
    en: 'Something slipped. Send /start — we will continue.',
  },
  onboarding_completed: {
    ru: 'Вот и славно. Теперь расскажи — что привело тебя ко мне сегодня?',
    en: 'There we are. Now tell me — what brings you to me today?',
  },

  // ── menu / nav ──────────────────────────────────────────────────────
  menu_title: {
    ru: 'О чём поговорим?',
    en: 'What shall we talk about?',
  },
  menu_home: {
    ru: '🏠 Домой',
    en: '🏠 Home',
  },
  menu_back: {
    ru: '← Назад',
    en: '← Back',
  },
  menu_readings: {
    ru: '🔮 Расклады',
    en: '🔮 Readings',
  },
  menu_profile: {
    ru: '👤 Профиль',
    en: '👤 Profile',
  },
  menu_memory: {
    ru: '📓 Память',
    en: '📓 Memory',
  },
  menu_referral: {
    ru: '🎁 Пригласить друга',
    en: '🎁 Invite a friend',
  },
  menu_subscription: {
    ru: '⭐ Подписка',
    en: '⭐ Subscription',
  },
  menu_daily: {
    ru: '🌟 Карта дня',
    en: '🌟 Card of the day',
  },
  menu_help: {
    ru: '❓ Помощь',
    en: '❓ Help',
  },
  menu_admin: {
    ru: '🛠 Админ-панель',
    en: '🛠 Admin',
  },
  menu_balance: {
    ru: '💎 Кристаллы',
    en: '💎 Crystals',
  },

  // ── reading menu ────────────────────────────────────────────────────
  reading_menu_title: {
    ru: 'Выбери расклад. Карты сами подберут, что тебе нужно услышать.',
    en: 'Pick a spread. The cards will find what you need to hear.',
  },
  reading_fate_card: { ru: '🌟 Карта судьбы (1 💎)', en: '🌟 Fate card (1 💎)' },
  reading_tarot_small: { ru: '🃏 Малый расклад — 5 карт (1 💎)', en: '🃏 Small spread — 5 cards (1 💎)' },
  reading_tarot_full: { ru: '🃏 Полный расклад — 20 карт (3 💎)', en: '🃏 Full spread — 20 cards (3 💎)' },
  reading_tarot_love: { ru: '❤️ Расклад на любовь — 3 карты (2 💎)', en: '❤️ Love spread — 3 cards (2 💎)' },
  reading_tarot_career: { ru: '💼 Расклад на дело — 5 карт (2 💎)', en: '💼 Career spread — 5 cards (2 💎)' },
  reading_tarot_decision: { ru: '⚖️ Расклад на выбор — 3 карты (2 💎)', en: '⚖️ Decision spread — 3 cards (2 💎)' },
  reading_horoscope: { ru: '🌠 Гороскоп (1 💎)', en: '🌠 Horoscope (1 💎)' },
  reading_random: { ru: '🎲 Вытянуть случайно', en: '🎲 Draw random' },
  reading_cancel: { ru: '✖ Отмена', en: '✖ Cancel' },

  reading_ask_numbers: {
    ru: 'Загадай {count} чисел от 1 до 78 — они выберут карты. Или нажми «случайно».',
    en: 'Pick {count} numbers from 1 to 78 — they will choose the cards. Or press "random".',
  },
  reading_processing: {
    ru: 'Тише... я смотрю. 🌙',
    en: 'Quiet now... I am looking. 🌙',
  },
  reading_done: {
    ru: '🌙 Карты сказали. Если хочешь — спроси ещё.',
    en: '🌙 The cards have spoken. Ask again if you wish.',
  },
  reading_refunded: {
    ru: 'Туман сегодня густой. Я вернула тебе кристаллы. Загляни позже. 🌙',
    en: 'The mist is thick today. I returned your crystals. Come back later. 🌙',
  },

  // ── daily ───────────────────────────────────────────────────────────
  card_of_day_cooldown: {
    ru: 'Карта дня уже была. Приходи через {hours} ч. 🌙',
    en: 'You already drew the card of the day. Come back in {hours}h. 🌙',
  },
  daily_bonus_received: {
    ru: '🌟 Серия {days} дней — держи кристалл в благодарность.',
    en: '🌟 {days}-day streak — a crystal in gratitude.',
  },

  // ── profile ─────────────────────────────────────────────────────────
  profile_title: { ru: '👤 <b>Твой профиль</b>', en: '👤 <b>Your profile</b>' },
  profile_name: { ru: 'Имя: {name}', en: 'Name: {name}' },
  profile_zodiac: { ru: 'Знак: {sign}', en: 'Sign: {sign}' },
  profile_age_group: { ru: 'Возрастная группа: {group}', en: 'Age group: {group}' },
  profile_messages: { ru: 'Сообщений: {count}', en: 'Messages: {count}' },
  profile_streak: { ru: 'Серия дней: {days}', en: 'Day streak: {days}' },
  profile_crystals: { ru: 'Кристаллов: {count} 💎', en: 'Crystals: {count} 💎' },
  profile_subscription: {
    ru: 'Подписка: {type} до {until}',
    en: 'Subscription: {type} until {until}',
  },
  profile_no_subscription: {
    ru: 'Подписка: нет',
    en: 'Subscription: none',
  },
  profile_referral_code: {
    ru: 'Реферальный код: <code>{code}</code>',
    en: 'Referral code: <code>{code}</code>',
  },
  profile_delete_data: {
    ru: '🗑 Удалить мои данные',
    en: '🗑 Delete my data',
  },
  profile_delete_confirm_title: {
    ru: 'Точно удалить всё?',
    en: 'Delete everything for sure?',
  },
  profile_delete_confirm_body: {
    ru: 'Я забуду твоё имя, знак, память, расклады. Это навсегда.',
    en: 'I will forget your name, sign, memory, readings. Forever.',
  },
  profile_delete_cancelled: {
    ru: 'Хорошо, я подожду. 🌙',
    en: 'Very well, I will wait. 🌙',
  },
  profile_deleted: {
    ru: 'Я всё забыла. Если вернёшься — начнём сначала. 🌙',
    en: 'I have forgotten it all. If you return, we start anew. 🌙',
  },

  // ── balance ─────────────────────────────────────────────────────────
  balance_title: { ru: '💎 <b>Кристаллы</b>', en: '💎 <b>Crystals</b>' },
  balance_crystals: {
    ru: 'У тебя {count} 💎',
    en: 'You have {count} 💎',
  },
  balance_subscription: {
    ru: 'Подписка: {type} до {until}',
    en: 'Subscription: {type} until {until}',
  },
  balance_no_subscription: {
    ru: 'Подписки нет.',
    en: 'No subscription.',
  },

  // ── billing ─────────────────────────────────────────────────────────
  billing_low_balance: {
    ru: 'Не хватает кристаллов — нужно {count} 💎. Может, подпишешься?',
    en: 'Not enough crystals — need {count} 💎. Want to subscribe?',
  },
  billing_buy_soon: {
    ru: 'Покупка кристаллов скоро появится. А пока — подписка.',
    en: 'Crystal packs are coming soon. For now — subscription.',
  },

  // ── subscription ────────────────────────────────────────────────────
  subscription_title: {
    ru: '⭐ <b>Подписка</b>',
    en: '⭐ <b>Subscription</b>',
  },
  subscription_active_until: {
    ru: 'Подписка активна до {until}.',
    en: 'Subscription active until {until}.',
  },
  subscription_none: {
    ru: 'Подписки нет.',
    en: 'No subscription.',
  },
  subscription_weekly: {
    ru: '⭐ Неделя (+10 💎) — 199 ₽',
    en: '⭐ Week (+10 💎) — 199 ₽',
  },
  subscription_monthly: {
    ru: '⭐ Месяц (безлимит) — 499 ₽',
    en: '⭐ Month (unlimited) — 499 ₽',
  },
  subscription_pay_contact: {
    ru: 'Для активации напиши администратору — @admin (или используй /admin).',
    en: 'To activate, contact the admin — @admin (or use /admin).',
  },

  // ── referral ────────────────────────────────────────────────────────
  referral_title: {
    ru: '🎁 <b>Приведи друга</b>',
    en: '🎁 <b>Invite a friend</b>',
  },
  referral_body: {
    ru: 'Поделись ссылкой — за каждого друга, который дойдёт до конца знакомства, ты получишь 1 💎.\n\n{link}',
    en: 'Share this link — for each friend who finishes onboarding, you get 1 💎.\n\n{link}',
  },
  referral_share: { ru: '📤 Поделиться', en: '📤 Share' },

  // ── settings / language ─────────────────────────────────────────────
  settings_title: { ru: '⚙️ <b>Настройки</b>', en: '⚙️ <b>Settings</b>' },
  settings_lang: { ru: 'Язык: {lang}', en: 'Language: {lang}' },
  settings_daily_card: { ru: 'Карта дня', en: 'Card of the day' },
  settings_on: { ru: 'вкл', en: 'on' },
  settings_soon: {
    ru: 'Остальные настройки скоро.',
    en: 'More settings coming soon.',
  },
  lang_select: {
    ru: 'Выбери язык. / Choose language.',
    en: 'Choose language. / Выбери язык.',
  },
  lang_changed: {
    ru: 'Язык изменён: {lang}',
    en: 'Language changed: {lang}',
  },
  lang_ru: { ru: 'Русский', en: 'Русский' },
  lang_en: { ru: 'English', en: 'English' },

  // ── history ─────────────────────────────────────────────────────────
  history_empty: {
    ru: 'У нас ещё нет раскладов. Хочешь первый?',
    en: 'We have no readings yet. Want the first one?',
  },
  history_make_first: {
    ru: '🔮 Сделать первый расклад',
    en: '🔮 Make the first reading',
  },
  history_page: {
    ru: 'Страница {page}/{total}',
    en: 'Page {page}/{total}',
  },

  // ── affirmation ─────────────────────────────────────────────────────
  affirmation_intro: {
    ru: 'Аффирмация дня:',
    en: "Today's affirmation:",
  },
  dream_ask: {
    ru: 'Расскажи свой сон — я послушаю. 🌙',
    en: 'Tell me your dream — I will listen. 🌙',
  },

  // ── admin ───────────────────────────────────────────────────────────
  admin_forbidden: {
    ru: 'Это только для хранительницы. 🌙',
    en: 'Only the keeper may enter. 🌙',
  },
  admin_panel_title: {
    ru: '🛠 <b>Админ-панель</b>',
    en: '🛠 <b>Admin panel</b>',
  },
  admin_broadcast_prompt: {
    ru: 'Напиши текст рассылки.',
    en: 'Write the broadcast text.',
  },
  admin_add_format: {
    ru: 'Используй: /gift <telegram_id> <amount>',
    en: 'Use: /gift <telegram_id> <amount>',
  },
  admin_stats_users: { ru: '👥 Пользователей', en: '👥 Users' },
  admin_stats_active24: { ru: '🕐 Активны за 24ч', en: '🕐 Active 24h' },
  admin_stats_readings: { ru: '🔮 Раскладов', en: '🔮 Readings' },
  admin_stats_crystals: { ru: '💎 Кристаллов в обороте', en: '💎 Crystals in circulation' },

  // ── return greeting ─────────────────────────────────────────────────
  return_greeting_default: {
    ru: 'милый',
    en: 'dear',
  },
  return_known: {
    ru: 'Снова здравствуй, {name}. Я скучала. О чём поговорим?',
    en: 'Hello again, {name}. I missed you. What shall we talk about?',
  },

  // ── help ────────────────────────────────────────────────────────────
  help_body: {
    ru: 'Я — София, ведунья-хранительница. Вот что я умею:\n\n' +
        '/start — познакомиться или начать заново\n' +
        '/help — эта подсказка\n' +
        '/daily — карта дня (бесплатно, раз в сутки)\n' +
        '/readings — меню раскладов\n' +
        '/profile — твой профиль\n' +
        '/memory — что я помню о тебе\n' +
        '/referral — пригласить друга\n' +
        '/subscription — подписка\n' +
        '/admin — для администратора\n' +
        '/cancel — отменить текущее действие\n\n' +
        'Просто напиши мне — я отвечу. 🌙',
    en: 'I am Sofia, a wise keeper. Here is what I can do:\n\n' +
        '/start — meet me or start anew\n' +
        '/help — this help\n' +
        '/daily — card of the day (free, once a day)\n' +
        '/readings — readings menu\n' +
        '/profile — your profile\n' +
        '/memory — what I remember about you\n' +
        '/referral — invite a friend\n' +
        '/subscription — subscription\n' +
        '/admin — for the admin\n' +
        '/cancel — cancel current action\n\n' +
        'Just write to me — I will answer. 🌙',
  },

  // ── cancel ──────────────────────────────────────────────────────────
  cancel_done: {
    ru: 'Хорошо, я отложила. О чём поговорим? 🌙',
    en: 'Very well, I put it aside. What shall we talk about? 🌙',
  },

  // ── affirmation (intro fallback) ────────────────────────────────────
  affirmation_fallback: {
    ru: 'Будь как тихая вода сегодня. 🌙',
    en: 'Be like still water today. 🌙',
  },

  // ── card of day fallback ────────────────────────────────────────────
  card_of_day_fallback: {
    ru: 'Я бы посидела с этой картой сегодня. Что она в тебе откликает? 🌙',
    en: 'I would sit with this card today. What does it bring up for you? 🌙',
  },

  // ── fate card hook ──────────────────────────────────────────────────
  fate_card_hook: {
    ru: 'В твоей карте есть ещё одна сторона… хочешь, приоткрою?',
    en: 'There is another side to your card… shall I open it?',
  },
  fate_card_failed: {
    ru: 'Туман сегодня густой, милый. Карта не хочет открываться полностью. Загляни чуть позже. 🌙',
    en: "The mist is thick today, dear. The card doesn't want to open fully. Drop by later. 🌙",
  },
};

export function t(
  key: string,
  locale: Locale = 'ru',
  params?: Record<string, string | number>,
): string {
  const entry = STRINGS[key];
  if (!entry) return key;
  let s = entry[locale] ?? entry.ru ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return s;
}

export function localeLabel(locale: Locale): string {
  return locale === 'en' ? 'English' : 'Русский';
}

/** Detect locale from Telegram's language_code. Defaults to ru. */
export function detectLocale(languageCode?: string): Locale {
  if (!languageCode) return 'ru';
  return languageCode.toLowerCase().startsWith('en') ? 'en' : 'ru';
}
