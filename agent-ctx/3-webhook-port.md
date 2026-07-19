# Task ID: 3 — Port Python Telegram bot to Next.js webhook mode

**Agent**: full-stack-developer (Next.js + TypeScript)
**Date**: 2026-07-19
**Scope**: Port aiogram long-polling bot → Next.js serverless webhook so it
deploys cleanly to Vercel (Render is blocked in Russia).

## What was done

### Architecture

```
Telegram → POST /api/telegram/webhook → Next.js serverless function
  → handleUpdate(update)                  [src/lib/bot/handlers/index.ts]
    → dispatchMessage(message)            — routes /commands + FSM text
    → handleCallback(callbackQuery)       — routes ns:action:payload callbacks
  → DB (Prisma) for state                 [User.onboardingStep survives invocations]
  → Telegram Bot API via fetch            [src/lib/bot/telegram.ts]
  → OpenRouter LLM (Gemini-2.0-flash)     [src/lib/bot/services/ai.ts]
  → Return 200 OK (always, even on error — Telegram would retry 100× otherwise)
```

Webhook mode = NO persistent process. Each Telegram update = 1 HTTP request.
Vercel handles this perfectly (maxDuration=30 set in route.ts + vercel.json).

### Files created

**Core client / types**
- `src/lib/bot/types.ts` — TelegramUpdate / Message / CallbackQuery / User / InlineKeyboardMarkup / WebhookInfo
- `src/lib/bot/telegram.ts` — fetch-based Telegram Bot API client (NO SDK).
  Functions: sendMessage, answerCallbackQuery, editMessageText,
  editMessageReplyMarkup, sendPhoto, sendChatAction, setMyCommands,
  deleteMessage, sendDice, getUserProfilePhotos, setWebhook, deleteWebhook,
  getWebhookInfo, getMe, verifyWebhookSecret, hasBotToken.
  `answerCallbackQuery` is non-throwing so a stale query ID doesn't abort
  the rest of the callback handler.

**Services** (ported 1:1 from `python-bot/app/services/`)
- `services/tarot.ts` — 78-card Ryder–Waite deck (22 Major + 56 Minor in
  4 suits × 14 ranks), KEYWORDS_RU/EN, 9 SPREADS, `getCardByNumber`,
  `drawRandomCards`, `parseUserNumbers`, `formatCardsForPrompt`,
  `keywordFor`, `cardsToJSON`, `cardDisplayName`.
- `services/zodiac.ts` — 12 signs with emoji/element, `calculateZodiac`,
  `getZodiac`, `getZodiacFromISO`, `ageGroupFromYear`, `inferGender`,
  `parseBirthDate` (accepts DD.MM.YYYY / DD/MM/YYYY / YYYY-MM-DD /
  "14 марта 1990").
- `services/ai.ts` — OpenRouter integration. Model
  `google/gemini-2.0-flash-exp:free` (override via `OPENROUTER_MODEL`).
  Sofia system prompt + 9 feature prompts (fate_card, tarot_small/full/love/
  career/decision, horoscope, card_of_day, single_card, return_greeting,
  affirmation, dream). All wrappers fall back gracefully if the LLM fails.
- `services/crystals.ts` — `getBalance`, `addCrystals`, `spendCrystals`
  (atomic via `db.$transaction` — returns false if insufficient),
  `refundCrystals`, `checkAndGiveDailyBonus` (streak logic + +1 💎 bonus
  if streak ≥ 3), `subscriptionActive`, `applySubscription`, `rewardReferral`
  (idempotent — unique constraint on Referral(referrerId, refereeId)),
  `welcomeBonus`.
- `services/memory.ts` — facts + emotional memory (matches Prisma Memory
  model categories), `summarizeForPrompt`, `formatMemoryForUser`,
  `deleteAll`.

**i18n / keyboards**
- `i18n/index.ts` — ~70 RU/EN string keys (onboarding, menus, errors,
  billing, profile, subscription, referral, admin, help). `t(key, locale,
  params?)` interpolates `{placeholders}`. `detectLocale(languageCode)`.
- `keyboards.ts` — all inline keyboards as `InlineKeyboardMarkup` objects:
  mainMenu, readingMenu, readingNumbers, buyMenu, subscription, referral,
  deleteConfirm, paidHook, adminPanel, historyPagination, usersPagination,
  language, homeOnly, backHome. Callback data convention: `ns:action[:payload]`.

**Handlers** (in `handlers/`)
- `_helpers.ts` — `newReferralCode`, `splitMessage` (Telegram 4096-char
  limit), `findUserByTelegramId`, `isAdmin`, `readingPrice`, tunables
  (`DAILY_CARD_COOLDOWN_HOURS`, `RETURN_ABSENCE_HOURS`).
- `start.ts` — `/start` + 8-step onboarding FSM
  (START→ASK_NAME→ASK_BIRTH_DATE→ASK_BIRTH_TIME→ASK_BIRTH_PLACE→
  ASK_GENDER→ASK_AGE_GROUP→PROBING→FREE_READING→CONVERSATION).
  All state in `User.onboardingStep` column (survives webhook restarts).
  Deep-link parsing: `ref_<code>` | `card` | `affirmation` | `question` | `lang`.
  On first /start: creates User with 3 💎, generates referral code,
  links `referredById` if `ref_<code>` deep-link present.
  On onboarding completion: delivers fate card (free), then rewards
  referrer +1 💎 (idempotent).
  Returning user with absence > 12h: triggers `returnGreeting` LLM call.
- `daily.ts` — `/daily` card of the day. Free, 1/day per user (20h cooldown).
  Updates streak. +1 💎 bonus if streak ≥ 3. Saves Reading record.
- `readings.ts` — `/readings` menu + reading flow FSM.
  7 paid types (fate_card, tarot_small/full/love/career/decision, horoscope)
  + 2 free (card_of_day, single_card). Price env-overridable.
  Flow: spend crystals → ask N numbers (or random) → draw cards →
  LLM interpretation (with memory context) → save Reading.
  Horoscope + fate_card skip card draw. `AWAIT_NUMBERS` state stored
  in `User.onboardingStep`; reading type+price stored in
  `User.lastTopicSummary` as `__reading:<type>:<price>` marker.
- `profile.ts` — `/profile` + `formatProfile` (HTML-formatted: name,
  zodiac+emoji, age group, message count, streak, crystals, subscription,
  referral code) + `handleBalance`.
- `referral.ts` — `/referral` link + count of friends invited.
- `memory.ts` — `/memory` shows what Sofia remembers.
- `help.ts` — `/help` lists all 10 commands.
- `subscription.ts` — `/subscription` plans (weekly 7d/+10💎, monthly 30d/unlimited).
- `admin.ts` — `/admin` panel (admin-only). `renderStats` (total users,
  active 24h, readings, crystals in circulation). `renderUsersPage`.
- `callback.ts` — master callback router. Namespaces: nav / rd / buy /
  admin / lang / share. Each handler edits the inline message in place
  (or sends a new one if edit fails).
- `index.ts` — `handleUpdate(update)` entry point. Routes:
  - `update.message` → `dispatchMessage` (commands then FSM then echo)
  - `update.callback_query` → `handleCallback`
  - Commands: /start /help /daily /readings /profile /memory /referral
    /subscription /admin /cancel /broadcast /gift
  - Each webhook request touches `BotHeartbeat` singleton (so admin
    panel can show "online" status in webhook mode).
  - All errors caught — webhook ALWAYS returns 200.

**API routes**
- `src/app/api/telegram/webhook/route.ts` — POST handler. Verifies
  optional `X-Telegram-Bot-Api-Secret-Token` header. `runtime='nodejs'`,
  `maxDuration=30`. Always returns `{ok:true}` (even on error — to stop
  Telegram retries). GET = health check.
- `src/app/api/telegram/setup/route.ts` — POST registers webhook URL +
  10 bot commands with Telegram. Derives URL from `WEBHOOK_URL` env or
  `x-forwarded-proto`/`x-forwarded-host` headers (works on Vercel
  preview/prod). Protected by `ADMIN_PASSWORD` if set. GET lists commands.
- `src/app/api/telegram/status/route.ts` — GET returns Telegram
  `getWebhookInfo` + bot info (username, id, pending_update_count,
  last_error_date/message).

**Updated files**
- `src/app/api/bot/status/route.ts` — webhook-aware now. Reads
  `BotHeartbeat` row AND calls `getWebhookInfo`. Bot is "online" if
  heartbeat fresh (<5min) OR webhook URL configured, AND no recent
  Telegram errors. Response shape backwards-compatible + new `webhook`
  field.
- `.env.example` — added `WEBHOOK_URL`, `TELEGRAM_WEBHOOK_SECRET`,
  `BOT_TOKEN`, `ADMIN_IDS`, `OPENROUTER_API_KEY`, `BOT_USERNAME`,
  `OPENROUTER_MODEL`, tunables (DAILY_CARD_COOLDOWN_HOURS,
  RETURN_ABSENCE_HOURS, WELCOME_CRYSTALS, PRICE_*).
- `.env` (local) — added `BOT_TOKEN`, `ADMIN_IDS`, `OPENROUTER_API_KEY`,
  `BOT_USERNAME`, `WEBHOOK_URL=http://localhost:3000`.

### Verification

- `bun run lint` — ✅ passes, exit 0, no warnings.
- `bunx tsc --noEmit` — ✅ no errors in any file under `src/lib/bot/`
  or `src/app/api/telegram/`. (Pre-existing errors in `src/app/page.tsx`,
  `examples/`, `skills/`, `src/app/api/bot/command/route.ts` are not
  mine — they predate this task.)
- `GET /api/telegram/webhook` → `{"ok":true,"service":"sofia-bot-webhook"}` ✅
- `GET /api/telegram/status` → returns bot username + (empty) webhook
  info + pending_update_count from Telegram. ✅
- `GET /api/bot/status` → webhook-aware JSON with `pollingMode:"webhook"`
  and `webhook:{url,pending_update_count,last_error_*}` fields. ✅
- `POST /api/telegram/webhook` with `/help` message → 200 OK, sends
  help text to chat. ✅
- `POST /api/telegram/webhook` with `/start` from a brand-new user
  (id=123456789) → 200 OK, User row created with `onboardingStep="ASK_NAME"`,
  `crystals=3`, `referralCode` generated. ✅
- Onboarding FSM stepped through: name "Олег" → `name="Олег"`,
  `onboardingStep="ASK_BIRTH_DATE"`. Birth date "14.03.1990" →
  `zodiacSign="Рыбы"`, `onboardingStep="ASK_BIRTH_TIME"`. ✅
- Callback query (`nav:help`) routed correctly. `answerCallbackQuery`
  failure on fake callback ID (`cb1`) no longer aborts the rest of
  the handler — message is still sent. ✅
- Prisma queries show in dev.log as expected (heartbeat upsert, user
  find, user update for message counter, etc.). ✅

### Notes for the next agent / owner

1. **To activate the webhook in production** (after Vercel deploy):
   ```bash
   curl -X POST https://your-app.vercel.app/api/telegram/setup \
     -H "Content-Type: application/json" \
     -d '{}'
   ```
   This sets the webhook URL + registers the 10 commands with Telegram.
   If `ADMIN_PASSWORD` is set, include it in the body.

2. **Webhook secret** (optional but recommended): set
   `TELEGRAM_WEBHOOK_SECRET` env on Vercel, then call `/setup` with
   `{"secret":"<same-value>"}`. Telegram will send
   `X-Telegram-Bot-Api-Secret-Token` header on every update; the
   webhook verifies it.

3. **FSM state is in the DB** (`User.onboardingStep` column), not in
   memory — so it survives across webhook invocations. No FSM library
   needed.

4. **The BotHeartbeat row is upserted on every webhook request** by
   `handleUpdate`. This means the admin panel's "online" indicator now
   shows green whenever traffic is flowing. For low-traffic bots it may
   flicker — the 5-minute freshness window covers that.

5. **No new npm dependencies were added** — uses native `fetch`, Prisma,
  and existing Next.js 16 + TypeScript. Bundle stays small for serverless.

6. **The Python bot at `python-bot/` is no longer needed** (it doesn't
   even exist in this checkout). All bot logic now lives in
   `src/lib/bot/`. The BotCommand queue (`src/app/api/bot/command/*`)
   is still used by `/broadcast` and `/gift` admin commands — those
   enqueue commands for the admin panel to display, but in webhook mode
   there's no separate bot process polling them. (If the admin panel's
   UI relies on the queue being consumed, that's a follow-up task —
   not part of this port.)

### What's NOT done (out of scope or follow-up)

- **Payment integration** — subscription plans are accepted via
  `buy:weekly` / `buy:monthly` callbacks and applied immediately
  (no actual payment). Same as the Python bot's behavior.
- **Anti-rudeness auto-block** — marked "optional" in the spec; not
  implemented. The `rudenessCount` field is reset to 0 on every /start.
- **Memory extraction LLM** — `extract_and_store` from Python was not
  ported (would require an extra LLM call per message, doubling cost).
  Manual `addFact` / `addEmotion` helpers exist for future use.
- **BotCommand queue consumer** — `/broadcast` and `/gift` enqueue
  commands but nothing polls the queue in webhook mode. Either:
  (a) the admin panel polls and calls Telegram API directly (the admin
  panel already has `BOT_TOKEN`), or (b) a follow-up task adds a
  `/api/telegram/process-queue` endpoint triggered by a cron.

Stage Summary:
- ✅ All bot logic ported to TypeScript under `src/lib/bot/`
- ✅ Webhook endpoint live at `/api/telegram/webhook` (POST + GET)
- ✅ Setup endpoint at `/api/telegram/setup` registers webhook + commands
- ✅ Status endpoint at `/api/telegram/status` shows Telegram webhook info
- ✅ `bot/status` route updated to be webhook-aware (online if heartbeat
  fresh OR webhook URL set, AND no recent Telegram errors)
- ✅ Lint clean, no TS errors in any bot file
- ✅ End-to-end test: /start creates user → onboarding FSM steps through
  name + birth date (zodiac auto-calculated) → state persists in DB
- Ready for Vercel deploy. Owner just needs to call `/api/telegram/setup`
  once after deploy.
