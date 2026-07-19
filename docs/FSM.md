# FSM — Sofia Bot (Finite State Machine)

> Phase 7 deliverable. States, transitions, triggers, guards, actions.
> Implemented via grammY `session()` backed by Prisma (`User.onboardingStep` is the source of truth).

## States (TS union type)

```typescript
type SofiaState =
  | "START"
  | "ASK_NAME"
  | "ASK_BIRTH_DATE"
  | "ASK_BIRTH_TIME"
  | "ASK_BIRTH_PLACE"
  | "PROBING"
  | "FREE_READING"
  | "CONVERSATION"
  | "PAID_HOOK"
  | "TARO_ASK_NUMBERS"
  | "TARO_SMALL"
  | "TARO_FULL"
  | "TARO_LOVE"
  | "TARO_CAREER"
  | "TARO_DECISION"
  | "HOROSCOPE"
  | "SINGLE_CARD"
  | "CARD_OF_DAY"
  | "BLOCKED"
  | "AWAIT_DELETE_CONFIRM"
  | "BROADCAST"
  | "ADMIN_PANEL";
```

## Onboarding transitions

| From | Event | Guard | Action | To |
|---|---|---|---|---|
| START | `/start` (first time) | `user.messageCount === 0` | create user + referral link | ASK_NAME |
| START | `/start` (returning) | `user.messageCount > 0 && absence <= 20h` | send welcome | CONVERSATION |
| START | `/start` (long absence) | `absence > 20h` | send return greeting | CONVERSATION |
| ASK_NAME | text (1-100 chars, not rude) | — | save name | ASK_BIRTH_DATE |
| ASK_BIRTH_DATE | text matches date regex | year 1900..now | save birthDate, compute zodiac | ASK_BIRTH_TIME |
| ASK_BIRTH_DATE | "пропустить" | — | skip | ASK_BIRTH_TIME |
| ASK_BIRTH_TIME | text matches time regex OR "пропустить" | — | save or skip | ASK_BIRTH_PLACE |
| ASK_BIRTH_PLACE | text (<=200 chars) OR "пропустить" | — | save or skip | PROBING |
| PROBING | any text | `probingCount < 1` | generate probing question (already sent on entry) → wait for reply | FREE_READING |
| FREE_READING | (auto on entry) | — | generate fate card, deliver 4-part + hook | CONVERSATION (mark onboarding_completed=true) |

## Conversation transitions

| From | Event | Guard | Action | To |
|---|---|---|---|---|
| CONVERSATION | text, rude | `rudenessCount >= 4` | increment, warn | BLOCKED |
| CONVERSATION | text, rude | `rudenessCount < 4` | increment, soft warn | CONVERSATION |
| CONVERSATION | "меню"/menu trigger | — | show main menu | CONVERSATION (menu shown) |
| CONVERSATION | "баланс"/balance trigger | — | show balance screen | CONVERSATION |
| CONVERSATION | reading-type trigger (e.g. "малый расклад") | — | ask for numbers | TARO_ASK_NUMBERS (+ store reading_type) |
| CONVERSATION | "бесплатная карта" | `now - lastFreeCardAt >= 24h` | mark used, generate | SINGLE_CARD → CONVERSATION |
| CONVERSATION | "бесплатная карта" | cooldown active | "Луна ещё не встала, милый. Завтра." | CONVERSATION |
| CONVERSATION | "карта дня" | `now - lastDailyCardAt >= 20h` | mark used, streak++ | CARD_OF_DAY → CONVERSATION |
| CONVERSATION | msg_count % 7 == 0 && >= 7 | — | send paid hook | PAID_HOOK |
| CONVERSATION | normal text | daily quota ok | generate Sofia reply, extract memory | CONVERSATION |
| CONVERSATION | normal text | daily quota exceeded | soft paywall | CONVERSATION (softer replies) |
| CONVERSATION | `/cancel` | — | "Хорошо, вернёмся к началу." | CONVERSATION |
| PAID_HOOK | "да"/"хочу"/"давай"/tap 🔮 | — | show reading menu | TARO_ASK_NUMBERS (after pick) |
| PAID_HOOK | "нет"/"позже"/tap Позже | — | "Хорошо, я подожду." | CONVERSATION |
| PAID_HOOK | other text | — | treat as conversation | CONVERSATION (handle as msg) |

## Paid reading transitions

| From | Event | Guard | Action | To |
|---|---|---|---|---|
| TARO_ASK_NUMBERS | text matches N numbers | N matches reading_type | parse, pick cards | TARO_{TYPE} |
| TARO_ASK_NUMBERS | invalid | — | "Загадай {N} чисел от 1 до 78" | TARO_ASK_NUMBERS |
| TARO_{TYPE} | (auto on entry) | `crystals >= cost` | spend (atomic $transaction), generate reading, stream | CONVERSATION |
| TARO_{TYPE} | (auto on entry) | `crystals < cost` | show BUY_MENU | CONVERSATION (buy menu shown) |
| HOROSCOPE | (auto on entry) | `crystals >= 2` | spend, generate | CONVERSATION |
| SINGLE_CARD | (auto on entry) | cooldown ok | mark used, generate | CONVERSATION |
| CARD_OF_DAY | (auto on entry) | cooldown ok | mark used, streak++, generate | CONVERSATION |

## Moderation transitions

| From | Event | Guard | Action | To |
|---|---|---|---|---|
| BLOCKED | "извини"/"прости" | — | reset rudeness, "Прощаю." | CONVERSATION |
| BLOCKED | other text | — | "Скажи 'извини', когда будешь готов." | BLOCKED |

## Data/GDPR transitions

| From | Event | Guard | Action | To |
|---|---|---|---|---|
| CONVERSATION | "удалить мои данные" / tap | — | confirm screen | AWAIT_DELETE_CONFIRM |
| AWAIT_DELETE_CONFIRM | "удалить навсегда" / tap | — | delete user + cascade | START (goodbye message, then user row gone) |
| AWAIT_DELETE_CONFIRM | other / tap Отмена | — | "Хорошо, я останусь." | CONVERSATION |

## Admin transitions

| From | Event | Guard | Action | To |
|---|---|---|---|---|
| any | `/admin` | `user.isAdmin` | show admin panel | ADMIN_PANEL |
| ADMIN_PANEL | tap section | — | show sub-screen | ADMIN_PANEL (edit-in-place) |
| ADMIN_PANEL | tap Рассылка | — | "Введи текст рассылки:" | BROADCAST |
| BROADCAST | text | — | preview + confirm buttons | BROADCAST (awaiting confirm) |
| BROADCAST | tap Подтвердить | — | enqueue broadcast job | ADMIN_PANEL |
| BROADCAST | tap Отмена | — | — | ADMIN_PANEL |

## FSM storage strategy

- **Source of truth**: `User.onboardingStep` column (String). Survives process restart.
- **grammY session**: hydrated from DB on each update; written back on every transition via a `session middleware` that calls `repos.users.updateState(userId, newState)`.
- **No TTL needed**: DB-backed. But a `/cancel` + 30-min idle auto-reset middleware clears stale `TARO_ASK_NUMBERS`/`BROADCAST` back to `CONVERSATION` (tracked via `lastSeenAt`).

## Trigger classification

To avoid the old bot's substring collisions, triggers are classified in this priority order:

1. **Command** (`/start`, `/menu`…) — highest priority.
2. **Callback query** (inline button) — matched via `@grammyjs/callback-data` typed payload.
3. **Rudeness check** (word-boundary regex) — if rude, intercept regardless of state.
4. **State-specific intent** — only in the matching state (e.g. date regex in ASK_BIRTH_DATE).
5. **Global text triggers** ("меню", "баланс"…) — word-boundary.
6. **Reading-type triggers** — checked in CONVERSATION/PAID_HOOK.
7. **Default** — treat as free conversation → Sofia LLM reply.

Each level is a separate grammY `Composer`, registered in priority order.
