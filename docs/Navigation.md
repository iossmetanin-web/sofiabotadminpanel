# Navigation — Sofia Bot

> Phase 7 deliverable. Menu tree, screen tree, navigation rules.

## Navigation principles (from competitor research, Task 1-c §10)

1. **Button-first navigation.** Commands (`/start`, `/menu`, `/help`, `/profile`, `/balance`) are registered with BotFather for discoverability, but the primary UI is inline keyboards.
2. **Edit-in-place.** Navigation rewrites the current message via `editMessageText`. Only **events** (reading delivered, payment success, error) send new messages.
3. **Every screen ≥1 level deep** has: breadcrumb in text ("⚙️ Настройки · главная › настройки"), `◀ Назад` (last row), `🏠 Меню` (if >2 levels deep).
4. **One primary CTA per screen.** Secondary actions in the second row.
5. **Toggle labels encode state**: `✅ Уведомления` (on) vs `⬜ Уведомления` (off).
6. **Destructive actions** get a confirmation screen (not a `show_alert`): safe action left, destructive right with red emoji.
7. **Empty states are explicit**: "📜 У тебя ещё нет раскладов. [Сделать первый расклад]".
8. **`answerCallbackQuery` is the first call** in every callback handler.

## Main menu (CONVERSATION state)

```
Sofia reply (the actual conversation). Below it, a persistent inline keyboard:

[🔮 Расклад]    [🌟 Карта дня]    [🆓 Бесплатная карта]
[📜 История]    [👤 Профиль]      [💎 Баланс: 3]
[⚙️ Настройки]  [❓ Помощь]
```

- Tap 🔮 Расклад → READING_MENU (edit-in-place)
- Tap 🌟 Карта дня → CARD_OF_DAY flow (if cooldown ok)
- Tap 🆓 Бесплатная карта → SINGLE_CARD flow (24h cooldown)
- Tap 📜 История → HISTORY_LIST (paginated, edit-in-place)
- Tap 👤 Профиль → PROFILE_SCREEN
- Tap 💎 Баланс → BALANCE_SCREEN (with BUY_MENU link)
- Tap ⚙️ Настройки → SETTINGS_SCREEN
- Tap ❓ Помощь → HELP_SCREEN

## Reading menu (1 level deep)

```
📜 Выбери расклад:

[💑 Любовный (3 карты · 2💎)]
[💼 Карьера (5 карт · 2💎)]
[🛤 Решение (3 карты · 2💎)]
[🃏 Малый (5 карт · 1💎)]
[🌑 Полный (20 карт · 3💎)]
[♈ Гороскоп (2💎)]
[◀ Назад] [🏠 Меню]
```

## Profile screen (1 level deep)

```
👤 Профиль

Имя: {name}
Знак: {zodiac} {emoji}
Возраст: {ageGroup}
С тобой мы уже: {messageCount} сообщений
🔥 Серия: {streakDays} дней
💎 Кристаллы: {crystals}
{subscription badge if active}

[✏️ Изменить имя] [🗑 Удалить мои данные]
[◀ Назад] [🏠 Меню]
```

## Balance screen (1 level deep)

```
💎 Баланс: {crystals} кристаллов

{if subscription active: "Подписка: недельная · до {date}"}

[🎁 Получить бонус]   → referral screen
[💳 Купить кристаллы] → BUY_MENU
[📜 История трат]     → transactions list (paginated)
[◀ Назад] [🏠 Меню]
```

## Buy menu (2 levels deep)

```
💳 Пополнить баланс

Подписка (выгодно):
[⭐ Недельная — 199₽ / неделя]   → unlimited + perks
[💎 Месячная — 699₽ / месяц]

Кристаллы:
[3 💎 — 99₽]    [10 💎 — 249₽]    [25 💎 — 499₽ ⭐]

[🎁 Пригласить друга за +1💎]
[◀ Назад] [🏠 Меню]
```

> Payment integration (Telegram Stars / YooKassa) is a later phase. For now, taps show "Скоро 🌙" with a Sofia-voice message. The data model + UX ship now.

## History screen (1 level deep, paginated)

```
📜 Твои расклады (страница 1/3)

[card] 🔮 Полный расклад · 12 мая
       "Что дано: Сила. Скрытая сторона: Луна…"
[card] 💑 Любовный · 10 мая
       "Ты: Император. Партнёр: Звезда…"
[card] 🌟 Карта дня · 9 мая
       "Колесница — движение вперёд…"

[◀ Пред.] [1/3] [След. ▶]
[◀ Назад] [🏠 Меню]
```

Empty state: "📜 У тебя ещё нет сохранённых раскладов. [Сделать первый расклад 🔮]"

## Settings screen (1 level deep)

```
⚙️ Настройки

[🔔 Ежедневная карта: ✅ Вкл]   → toggle
[🌍 Язык: 🇷🇺 Русский]          → language picker
[🤫 Режим тишины: ⬜ Выкл]       → toggle (mute non-daily pushes)
[🗑 Удалить мои данные]          → confirmation screen

[◀ Назад] [🏠 Меню]
```

## Confirmation screen (destructive, 2 levels deep)

```
⚠️ Удалить все данные?

Это удалит твои расклады, память обо мне о тебе, кристаллы.
София забудет тебя. Действие необратимо.

[❌ Отмена]                    [💥 Да, удалить навсегда]
```

## Admin panel (ADMIN_ID only)

```
🛠 Админ-панель

[📊 Статистика]   [👥 Пользователи]
[💸 Начислить 💎] [📢 Рассылка]
[⚙️ Конфиг]       [🏠 Меню]
```

Each sub-screen edit-in-place. Broadcast has 2-step: type text → preview → confirm.

## Command list (BotFather registration)

| Command | Description | Visible in menu |
|---|---|---|
| `/start` | Начать / вернуться | ✅ |
| `/menu` | Открыть меню | ✅ |
| `/profile` | Твой профиль | ✅ |
| `/balance` | Баланс кристаллов | ✅ |
| `/help` | Помощь | ✅ |
| `/cancel` | Отменить действие | ✅ |
| `/admin` | Админ-панель (только админ) | hidden |

## Text triggers (word-boundary, intent-classified)

To preserve the old bot's "just type it" UX, common phrases also work:
- "меню" / "menu" → main menu
- "баланс" / "кристаллы" → balance
- "профиль" / "кто я" → profile
- "история" / "расклады" → history
- "малый расклад" / "5 карт" → reading menu
- "карта дня" → card of day
- "бесплатная карта" → free card
- "извини" / "прости" (when BLOCKED) → unblock
- "пропустить" / "далее" (when in optional onboarding step) → skip

All triggers use `\b` word boundaries to avoid the old bot's substring collisions (e.g. "карта" no longer matches "карта полного расклада").
