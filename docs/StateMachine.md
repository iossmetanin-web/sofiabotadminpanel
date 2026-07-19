# State Machine — Sofia Bot (formal)

> Phase 7 deliverable. Formal statechart (states, events, guards, actions, transitions).
> UML state machine notation, condensed.

## Notation

- `S` = state, `E` = event, `[g]` = guard, `/a` = action, `→ S'` = target state.
- `entry/` = on-enter action, `exit/` = on-exit action.

## Top-level regions

The bot has **one orthogonal region** per user (no parallel regions). All states belong to a single statechart.

## Statechart (ASCII)

```
                          ┌─────────────────────────────────────────────┐
                          │                  START                       │
                          │  entry/ hydrate user from DB                 │
                          └──────┬───────────────────────┬───────────────┘
                                 │ /start, first         │ /start, returning
                                 │                       │
                ┌────────────────▼───────┐   ┌───────────▼──────────────┐
                │       ASK_NAME          │   │      CONVERSATION        │
                │  entry/ "Как называть?" │   │  (hub state)             │
                └────────┬───────────────┘   └─┬──┬──┬──┬──┬──┬──┬──────┘
                         │ text                 │  │  │  │  │  │  │
                ┌────────▼────────┐    rude ────┘  │  │  │  │  │  └─ /cancel → self
                │  ASK_BIRTH_DATE │               │  │  │  │  │
                └────────┬────────┘   reading ─────┘  │  │  │  └─ "карта дня" ──► CARD_OF_DAY
                         │            "бесплатная" ──┘  │  │
                ┌────────▼────────┐     msg%7==0 ───────┘  │
                │  ASK_BIRTH_TIME │            "профиль" ──┘ (menu shown, stay)
                └────────┬────────┘
                         │                ┌──────────────────────────────────┐
                ┌────────▼────────┐       │           PAID_HOOK               │
                │ ASK_BIRTH_PLACE │       │  entry/ send hook + reading menu  │
                └────────┬────────┘       └──┬───────────────┬────────────────┘
                         │            "да" │               │ "нет"
                ┌────────▼────────┐         │               │
                │     PROBING     │         │               │
                │ entry/ send 1 Q │         │               ▼
                └────────┬────────┘         │          CONVERSATION
                         │ reply            │
                ┌────────▼────────┐         │
                │   FREE_READING  │         ▼
                │ entry/ fate card│    TARO_ASK_NUMBERS
                │ + hook button   │         │ valid N numbers
                └────────┬────────┘         ▼
                         │            TARO_{SMALL|FULL|LOVE|CAREER|DECISION}
                         ▼            entry/ spend + generate + stream
                   CONVERSATION ◄─────┘
```

## Full transition table (formal)

| # | Source | Event | Guard | Action | Target |
|---|---|---|---|---|---|
| T1 | START | `/start` | `messageCount==0` | createUser, bindReferral | ASK_NAME |
| T2 | START | `/start` | `messageCount>0 && absence<=20h` | sendWelcome | CONVERSATION |
| T3 | START | `/start` | `messageCount>0 && absence>20h` | sendReturnGreeting | CONVERSATION |
| T4 | ASK_NAME | text | len 1..100 && !rude | saveName | ASK_BIRTH_DATE |
| T5 | ASK_BIRTH_DATE | text | dateRegex && year∈[1900,now] | saveBirthDate, computeZodiac | ASK_BIRTH_TIME |
| T6 | ASK_BIRTH_DATE | "пропустить" | — | — | ASK_BIRTH_TIME |
| T7 | ASK_BIRTH_TIME | text | timeRegex OR "пропустить" | saveOrSkip | ASK_BIRTH_PLACE |
| T8 | ASK_BIRTH_PLACE | text | len 0..200 | saveOrSkip | PROBING |
| T9 | PROBING | entry | — | sendProbingQuestion | (wait) |
| T10 | PROBING | text | — | (ignore content, proceed) | FREE_READING |
| T11 | FREE_READING | entry | — | generateFateCard, send 4-part + hook | CONVERSATION (+onboarding_completed=true) |
| T12 | CONVERSATION | text, rude | `rudenessCount<4` | increment, softWarn | CONVERSATION |
| T13 | CONVERSATION | text, rude | `rudenessCount>=4` | increment, block | BLOCKED |
| T14 | CONVERSATION | "меню" trigger | — | showMainMenu | CONVERSATION |
| T15 | CONVERSATION | "баланс" trigger | — | showBalance | CONVERSATION |
| T16 | CONVERSATION | "профиль" trigger | — | showProfile | CONVERSATION |
| T17 | CONVERSATION | "история" trigger | — | showHistory | CONVERSATION |
| T18 | CONVERSATION | reading trigger | — | askNumbers, storeType | TARO_ASK_NUMBERS |
| T19 | CONVERSATION | "бесплатная карта" | `now-lastFreeCardAt>=24h` | markUsed, generate | SINGLE_CARD |
| T20 | CONVERSATION | "бесплатная карта" | cooldown | "Завтра" | CONVERSATION |
| T21 | CONVERSATION | "карта дня" | `now-lastDailyCardAt>=20h` | markUsed, streak++ | CARD_OF_DAY |
| T22 | CONVERSATION | normal text | `dailyMsgs<10` | generateSofiaReply, extractMemory | CONVERSATION |
| T23 | CONVERSATION | normal text | `dailyMsgs>=10 && crystals>0` | softerReply (or offer package) | CONVERSATION |
| T24 | CONVERSATION | msg_count%7==0 && >=7 | — | sendPaidHook | PAID_HOOK |
| T25 | CONVERSATION | `/cancel` | — | "Хорошо" | CONVERSATION |
| T26 | PAID_HOOK | "да"/tap 🔮 | — | showReadingMenu | (pick → TARO_ASK_NUMBERS) |
| T27 | PAID_HOOK | "нет"/tap Позже | — | "Я подожду" | CONVERSATION |
| T28 | PAID_HOOK | other text | — | handleAsConversation | CONVERSATION |
| T29 | TARO_ASK_NUMBERS | text, N valid | N matches type | parse, pickCards | TARO_{TYPE} |
| T30 | TARO_ASK_NUMBERS | invalid | — | "Загадай N чисел" | TARO_ASK_NUMBERS |
| T31 | TARO_{TYPE} | entry | `crystals>=cost` | spend (atomic), generate, stream | CONVERSATION |
| T32 | TARO_{TYPE} | entry | `crystals<cost` | showBuyMenu | CONVERSATION |
| T33 | HOROSCOPE | entry | `crystals>=2` | spend, generate | CONVERSATION |
| T34 | SINGLE_CARD | entry | cooldown ok | markUsed, generate | CONVERSATION |
| T35 | CARD_OF_DAY | entry | cooldown ok | markUsed, streak++, generate | CONVERSATION |
| T36 | BLOCKED | "извини"/"прости" | — | resetRudeness | CONVERSATION |
| T37 | BLOCKED | other | — | "Скажи извини" | BLOCKED |
| T38 | CONVERSATION | "удалить данные" | — | confirmScreen | AWAIT_DELETE_CONFIRM |
| T39 | AWAIT_DELETE_CONFIRM | "удалить навсегда" | — | deleteUser(cascade) | START (goodbye) |
| T40 | AWAIT_DELETE_CONFIRM | other | — | "Хорошо, останусь" | CONVERSATION |
| T41 | any | `/admin` | `isAdmin` | showAdminPanel | ADMIN_PANEL |
| T42 | ADMIN_PANEL | tap Рассылка | — | "Введи текст" | BROADCAST |
| T43 | BROADCAST | text | — | preview + confirm | BROADCAST (await) |
| T44 | BROADCAST | tap Подтвердить | — | enqueueBroadcast | ADMIN_PANEL |
| T45 | BROADCAST | tap Отмена | — | — | ADMIN_PANEL |
| T46 | any (stale) | idle > 30min | state∈{TARO_ASK_NUMBERS, BROADCAST, PAID_HOOK} | "Вернёмся к началу" | CONVERSATION |

## Guards (named, reusable)

- `isFirstTime`: `user.messageCount === 0`
- `isLongAbsence`: `now - user.lastSeenAt > 20h`
- `isRude(text)`: word-boundary regex match against RUDENESS_PATTERNS
- `dailyQuotaOk`: `user.dailyMessageDate == today && dailyMessageCount < 10 || dailyMessageDate != today`
- `cooldownFreeCardOk`: `now - user.lastFreeCardAt >= 24h`
- `cooldownDailyCardOk`: `now - user.lastDailyCardAt >= 20h`
- `hasCrystals(cost)`: `user.crystals >= cost`
- `isAdmin`: `user.isAdmin`

## Actions (named, side-effectful)

- `createUser`, `bindReferral`, `saveName`, `saveBirthDate`, `computeZodiac`
- `sendProbingQuestion`, `generateFateCard`, `generateSofiaReply`, `extractMemory`
- `sendPaidHook`, `showReadingMenu`, `askNumbers`, `pickCards`
- `spendCrystals(cost, type)`, `generateReading`, `streamReading`
- `markFreeCardUsed`, `markDailyCardUsed`, `incrementStreak`
- `incrementRudeness`, `resetRudeness`, `deleteUser`
- `enqueueBroadcast`

## Invariants (must always hold)

1. `user.crystals >= 0` (enforced by `Crystals.spend()` domain method raising `InsufficientCrystalsError`).
2. `user.onboardingStep` ∈ the state union (DB-level CHECK not available in SQLite; enforced in code).
3. A `Transaction` row exists for every crystal change (spend/add/gift/referral) with `balanceAfter`.
4. A `Reading` row exists for every completed paid reading.
5. `rudenessCount` resets only on apology from BLOCKED state.
6. `onboardingCompleted=true` only after FREE_READING entry.
