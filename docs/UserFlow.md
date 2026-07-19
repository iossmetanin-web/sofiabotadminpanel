# User Flow — Sofia Bot

> Phase 7 deliverable. End-to-end user journey. See `FSM.md` for formal states and `Navigation.md` for menu tree.

## Primary flow (new user)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ 1. User opens bot via t.me/sofiabot?start=ref_ABC  (deep link, optional)  │
└───────────────────────────────────┬──────────────────────────────────────┘
                                    │ /start
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ 2. WELCOME — Sofia introduces herself (3-5 lines), acknowledges referral  │
│    if present. CTA: "Как мне тебя называть?"                              │
│    State: ASK_NAME                                                        │
└───────────────────────────────────┬──────────────────────────────────────┘
                                    │ user sends name
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ 3. ASK_BIRTH_DATE — "А когда ты родился? День и месяц (или год) подскажи" │
│    Accepts DD.MM / DD.MM.YYYY. Derives zodiac.                            │
└───────────────────────────────────┬──────────────────────────────────────┘
                                    │ valid date
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ 4. ASK_BIRTH_TIME — optional; "А во сколько, если помнишь? Можно 'пропустить'"│
│    Skip allowed → next state regardless.                                  │
└───────────────────────────────────┬──────────────────────────────────────┘
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ 5. ASK_BIRTH_PLACE — optional; "А где это было? Можно 'пропустить'"       │
└───────────────────────────────────┬──────────────────────────────────────┘
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ 6. PROBING — Sofia asks ONE evocative question based on name+ zodiac.     │
│    e.g. "Что привело тебя ко мне сегодня?"                                │
│    State: PROBING                                                         │
└───────────────────────────────────┬──────────────────────────────────────┘
                                    │ user replies
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ 7. FREE_READING (Fate Card) — Sofia draws the fate card and delivers the  │
│    4-part structure: 🌟 Что дано / 🌙 Скрытая сторона / ⚡ Слабое место /  │
│    🔑 Главный вопрос. Ends with a hook: "В твоей карте есть ещё одна      │
│    сторона… хочешь, приоткрою?" + inline [🔮 Узнать полностью]            │
│    State: FREE_READING → marks onboarding_completed, → CONVERSATION       │
└───────────────────────────────────┬──────────────────────────────────────┘
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ 8. CONVERSATION — free chat with Sofia. Daily free quota: 10 msgs/day.    │
│    Every 7th message (msg_count % 7 == 0, msg_count >= 7): soft PAID_HOOK.│
│    Sofia: "В твоей карте есть ещё одна сторона…" + [Малый расклад 1💎]    │
│    [Полный расклад 3💎] [Гороскоп 2💎] [Позже]                            │
└──────────────────────────────────────────────────────────────────────────┘
```

## Paid reading sub-flow

```
CONVERSATION / PAID_HOOK
  │ user taps "Малый расклад" or types "малый расклад"
  ▼
TARO_ASK_NUMBERS — "Загадай три числа от 1 до 78 — они выберут карты"
  │ user sends "12 45 7"
  ▼
PARSE → pick cards[12%78, 45%78, 7%78] → spend 1💎 (atomic $transaction)
  │
  ▼
STREAM TAROT READING — placeholder "🔀 Тасую колоду…" → throttled edits
  → final: per-card interpretation + combined reading + moral codex footer
  │
  ▼
CONVERSATION (Sofia weaves the reading into the dialogue)
```

## Return flow (>20h absence)

```
User sends /start (or any message) after >20h absence
  ▼
HANDLE_RETURN — Sofia: "Помнишь, ты рассказывал про [last_topic]…"
  (uses last_topic_summary + top emotional memory + zodiac)
  ▼
CONVERSATION
```

## Retention loop (daily)

```
[09:00 user-timezone] scheduler fires
  ▼
Daily card push: "🌙 Твоя карта дня готова" + [Получить карту]
  ▼
User taps → CARD_OF_DAY (free, 20h cooldown) → streak++ → CONVERSATION
  ▼
If streak broken (>1 day gap): streak reset to 1; Sofia acknowledges gently
```

## Monetization funnel (see SalesFunnel.md)

```
Free tier (10 msgs/day + 1 free card/24h + card-of-day/20h)
  │ user hits daily limit OR wants deeper reading
  ▼
SOFT PAYWALL — "Хочешь продолжить? Малый расклад откроет больше (1💎)"
  │
  ├── User has crystals → spend → reading
  ├── User out of crystals → BUY_MENU
  │     ├── Weekly subscription (best value)
  │     ├── Credit pack: 3💎 / 10💎 / 25💎
  │     └── Referral: "+1💎 за каждого друга"
  └── User declines → CONVERSATION continues (softer, shorter Sofia replies)
```

## Admin flow

```
/admin (ADMIN_ID only)
  ▼
ADMIN_PANEL — inline keyboard:
  [📊 Статистика] [👥 Пользователи] [💸 Начислить кристаллы]
  [📢 Рассылка] [⚙️ Конфиг]
  ▼
Each opens a sub-screen (edit-in-place). Broadcast has a 2-step confirmation.
```

## Error & edge flows

| Trigger | Sofia response | State transition |
|---|---|---|
| Invalid date format | "Hmm, я ждала день и месяц вроде 12.05. Попробуешь ещё раз?" | stay |
| Rudeness (1st) | "Мне немного больно слышать это. Но я здесь." | stay, rudeness_count++ |
| Rudeness (5th) | "Мне нужно время. Скажи 'извини', когда будешь готов." | → BLOCKED |
| BLOCKED + "извини" | "Прощаю. Я всегда здесь." | → CONVERSATION, reset count |
| LLM timeout | "Туман сегодня густой, милый. Дай мне миг…" (retry once) | stay |
| LLM content filter | "Что-то в твоих словах я не смогла разобрать. Перескажи иначе?" | stay |
| Out of crystals | "Кристаллы закончились, но я не оставлю тебя…" + BUY_MENU | stay |
| /cancel anywhere | "Хорошо, вернёмся к началу." | → CONVERSATION |

## Mini App flow (future — see Roadmap)

- Card reveal animation (3D flip + haptic)
- Reading journal grid (history)
- Birth chart wheel
- Paywall pricing card
- All share the same backend; auth via Telegram `initData` validated server-side.
