# Feature List — Sofia Bot

> Phase 7 deliverable. All features with priority, complexity, status.
> Priority: P0=must (ships now), P1=high (next), P2=medium, P3=low/future.
> Complexity: S/M/L/XL.

## Onboarding (P0)

| ID | Feature | Priority | Complexity | Status |
|---|---|---|---|---|
| F1 | `/start` with deep-link `start=ref_` parsing | P0 | S | ✅ |
| F2 | ASK_NAME (with validation) | P0 | S | ✅ |
| F3 | ASK_BIRTH_DATE (date parse + zodiac) | P0 | S | ✅ |
| F4 | ASK_BIRTH_TIME (optional, skip) | P0 | S | ✅ |
| F5 | ASK_BIRTH_PLACE (optional, skip) | P0 | S | ✅ |
| F6 | PROBING (1 LLM-generated question) | P0 | M | ✅ |
| F7 | FREE_READING (fate card, 4-part + hook) | P0 | M | ✅ |
| F8 | Resume onboarding if abandoned | P0 | S | ✅ |

## Conversation (P0)

| ID | Feature | Priority | Complexity | Status |
|---|---|---|---|---|
| F10 | Free chat with Sofia (LLM, 3-layer personality) | P0 | M | ✅ |
| F11 | Streaming replies (throttled edits) | P0 | M | ✅ |
| F12 | Daily free quota (10 msgs/day) | P0 | S | ✅ |
| F13 | Memory extraction (facts + emotional, every 5 msgs) | P0 | M | ✅ |
| F14 | Return greeting (>20h absence) | P0 | S | ✅ |
| F15 | Rudeness detection + soft block + apology unblock | P0 | S | ✅ |
| F16 | `/cancel` from any state | P0 | S | ✅ |

## Readings (P0)

| ID | Feature | Priority | Complexity | Status |
|---|---|---|---|---|
| F20 | Tarot small (5 cards, 1💎) | P0 | M | ✅ |
| F21 | Tarot full (20 cards, 3💎) | P0 | M | ✅ |
| F22 | Tarot love (3 cards, 2💎) | P0 | M | ✅ |
| F23 | Tarot career (5 cards, 2💎) | P0 | M | ✅ |
| F24 | Tarot decision (3 cards, 2💎) | P0 | M | ✅ |
| F25 | Horoscope (2💎) | P0 | S | ✅ |
| F26 | Free single card (24h cooldown) | P0 | S | ✅ |
| F27 | Card of the day (20h cooldown, streak++) | P0 | S | ✅ |
| F28 | Tarot 78-card map (22 major + 56 minor, reversed) | P0 | M | ✅ |
| F29 | Number-pick card selection (user picks N numbers) | P0 | S | ✅ |

## Monetization (P0 data + UX, P1 integration)

| ID | Feature | Priority | Complexity | Status |
|---|---|---|---|---|
| F30 | Crystal currency (spend/add/refund) | P0 | S | ✅ |
| F31 | Daily soft paywall (after 10 msgs) | P0 | S | ✅ |
| F32 | Paid hook every 7th message | P0 | S | ✅ |
| F33 | Buy menu (3 tiers + credit packs) | P0 | S | ✅ |
| F34 | Referral program (+1💎 per onboarded friend) | P0 | M | ✅ |
| F35 | Subscription data model + UX | P0 | S | ✅ |
| F36 | Telegram Stars payment | P1 | M | ⏳ |
| F37 | YooKassa / fiat payment | P2 | M | ⏳ |
| F38 | Rewarded ad for free reading | P2 | M | ⏳ |
| F39 | Tiered referral rewards | P2 | S | ⏳ |

## Retention (P0)

| ID | Feature | Priority | Complexity | Status |
|---|---|---|---|---|
| F40 | Daily card push (09:00 user TZ, configurable) | P0 | M | ✅ |
| F41 | Streak counter (increment on daily card) | P0 | S | ✅ |
| F42 | Mood check-in cron (3-day inactive) | P0 | S | ✅ |
| F43 | Birthday greeting cron | P0 | S | ✅ |
| F44 | Renewal reminders (3/1/0 days before) | P0 | S | ✅ |
| F45 | Reading history (paginated, in-chat) | P0 | S | ✅ |
| F46 | Weekly digest | P1 | S | ⏳ |
| F47 | Streak recovery via referral/1💎 | P2 | S | ⏳ |

## Navigation & UX (P0)

| ID | Feature | Priority | Complexity | Status |
|---|---|---|---|---|
| F50 | Main menu (inline keyboard) | P0 | S | ✅ |
| F51 | Edit-in-place navigation | P0 | S | ✅ |
| F52 | Breadcrumb + Back + Home | P0 | S | ✅ |
| F53 | Empty states with CTA | P0 | S | ✅ |
| F54 | Optimistic UI placeholders | P0 | S | ✅ |
| F55 | Friendly error messages (Sofia voice) | P0 | S | ✅ |
| F56 | Confirmation screens for destructive actions | P0 | S | ✅ |
| F57 | HTML parse mode + escape user input | P0 | S | ✅ |

## Admin (P0)

| ID | Feature | Priority | Complexity | Status |
|---|---|---|---|---|
| F60 | `/admin` panel (admin-only) | P0 | S | ✅ |
| F61 | Statistics (users, msgs, crystals, readings) | P0 | S | ✅ |
| F62 | User list + detail | P0 | S | ✅ |
| F63 | Add crystals to user | P0 | S | ✅ |
| F64 | Broadcast (2-step confirm) | P0 | M | ✅ |
| F65 | Audit log | P0 | S | ✅ |
| F66 | Next.js admin dashboard (web) | P0 | L | ✅ |

## Architecture & Security (P0)

| ID | Feature | Priority | Complexity | Status |
|---|---|---|---|---|
| F70 | Clean Architecture (4 layers) | P0 | L | ✅ |
| F71 | Repository pattern + ports | P0 | M | ✅ |
| F72 | zod env config (fail-fast) | P0 | S | ✅ |
| F73 | pino structured logging | P0 | S | ✅ |
| F74 | Rate limiting (per user/action) | P0 | S | ✅ |
| F75 | Input validation at boundaries | P0 | S | ✅ |
| F76 | Webhook secret validation (if webhook mode) | P0 | S | ✅ |
| F77 | `allowed_updates` includes callback_query | P0 | S | ✅ |
| F78 | Graceful shutdown (SIGINT/SIGTERM) | P0 | S | ✅ |
| F79 | Correlation IDs in logs | P0 | S | ✅ |
| F80 | Unit tests (FSM, billing, parsers) | P1 | M | ⏳ |

## i18n (P1)

| ID | Feature | Priority | Complexity | Status |
|---|---|---|---|---|
| F85 | Russian (default) | P0 | — | ✅ |
| F86 | English | P1 | M | ⏳ |
| F87 | Language picker in onboarding | P1 | S | ⏳ |
| F88 | Spanish | P2 | M | ⏳ |

## Mini App (P2)

| ID | Feature | Priority | Complexity | Status |
|---|---|---|---|---|
| F90 | Card reveal animation (3D flip + haptic) | P2 | L | ⏳ |
| F91 | Reading journal grid | P2 | M | ⏳ |
| F92 | Birth chart wheel | P3 | XL | ⏳ |
| F93 | Paywall pricing card | P2 | M | ⏳ |
| F94 | Compatibility matcher | P3 | L | ⏳ |
| F95 | Streak dashboard (heatmap) | P3 | M | ⏳ |

## Growth (P1)

| ID | Feature | Priority | Complexity | Status |
|---|---|---|---|---|
| F100 | Inline mode (`@sofiabot question`) | P1 | M | ⏳ |
| F101 | Deep-link attribution (`?start=ad_X`) | P1 | S | ⏳ |
| F102 | A/B testing framework | P2 | L | ⏳ |
| F103 | Analytics events (funnel, retention) | P1 | M | ⏳ |

## Content (P0)

| ID | Feature | Priority | Complexity | Status |
|---|---|---|---|---|
| F110 | Sofia system prompt (3 layers, moral codex) | P0 | M | ✅ |
| F111 | Tarot card interpretations (LLM-generated) | P0 | S | ✅ |
| F112 | Themed spread templates (love/career/decision) | P0 | S | ✅ |
| F113 | Dream interpretation | P3 | M | ⏳ |
| F114 | Natal chart | P3 | XL | ⏳ |

## Compliance (P0)

| ID | Feature | Priority | Complexity | Status |
|---|---|---|---|---|
| F120 | GDPR: delete my data | P0 | S | ✅ |
| F121 | GDPR: export my history | P1 | S | ⏳ |
| F122 | 18+ gating | P0 | S | ✅ |
| F123 | Terms of service link | P0 | S | ✅ |
| F124 | Privacy policy link | P0 | S | ✅ |

## Status legend
- ✅ ships in this build
- ⏳ documented, next phase
- — n/a
