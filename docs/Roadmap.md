# Roadmap — Sofia Bot

> Phase 7 deliverable. Phased delivery plan. Phase 0 ships in this build.

## Phase 0 — Foundation (ships now)

**Goal**: a working Telegram bot + web admin panel that demonstrate the full UX, end-to-end, in the sandbox.

| Deliverable | Status |
|---|---|
| Prisma schema (users, conversations, memories, transactions, readings, referrals, audit_logs, broadcasts) | ✅ |
| Bot mini-service: grammY + Clean Architecture (domain/application/infrastructure/presentation) | ✅ |
| Onboarding: START → ASK_NAME → ASK_BIRTH_DATE/TIME/PLACE → PROBING → FREE_READING → CONVERSATION | ✅ |
| Sofia personality: 3-layer system prompt + moral codex (ported from old bot, as design) | ✅ |
| Free conversation with LLM (z-ai-web-dev-sdk) + streaming | ✅ |
| Memory extraction (facts + emotional, every 5 msgs) | ✅ |
| Return greeting (>20h) | ✅ |
| Tarot readings: small/full/love/career/decision + horoscope + free card + card-of-day | ✅ |
| Crystal billing (corrected: charge-before-generate, refund on failure, never replace LLM reply) | ✅ |
| Referral program (+1💎) | ✅ |
| Streak counter + daily card push | ✅ |
| Reading history (in-chat, paginated) | ✅ |
| Admin commands (/admin, add crystals, broadcast with 2-step confirm) | ✅ |
| Next.js landing page + admin dashboard (stats, users, transactions, readings, broadcasts) | ✅ |
| Docs: MIGRATION_PLAN, Architecture, UserFlow, Navigation, FSM, StateMachine, UX, SalesFunnel, FeatureList, RepositoryStructure, Roadmap, Comparison | ✅ |

**Out of scope for Phase 0**: real payment integration, Mini App, multi-language EN, inline mode, tests.

## Phase 1 — Quality & i18n (next)

**Goal**: production-readiness for a real launch.

| Deliverable | Complexity |
|---|---|
| Unit tests: FSM transitions, billing logic, parsers (date/time/numbers), zodiac, tarot map, JSON fact parsing | M |
| Integration tests: each command handler with mocked LLM + fake repos | L |
| English language pack + language picker in onboarding (`@grammyjs/i18n`) | M |
| Inline mode (`@sofiabot question` → compact reading preview) | M |
| Deep-link attribution (`?start=ad_X`, `?start=ref_X`) + analytics events | S |
| Webhook mode (alternative to long polling) with secret token validation | M |
| Rate limiting tuning (per-action tiers) + abuse detection | S |
| Error monitoring (Sentry or equivalent) | S |
| A/B testing framework for paywall copy | M |

## Phase 2 — Monetization integration

**Goal**: real revenue.

| Deliverable | Complexity |
|---|---|
| Telegram Stars payment (credit packs + subscription) | M |
| YooKassa / CloudPayments fiat integration (RU market) | L |
| Subscription lifecycle (auto-renew via provider webhooks) | M |
| Renewal reminders (3/1/0 days before) — cron | S |
| Rewarded ad integration (AdsGram) for 1 free deep reading | M |
| Tiered referral rewards (3 friends → deck unlock; 10 → persona unlock) | S |
| Birthday special reading (cron + personalized) | S |
| Weekly digest (Sunday: "your week's cards pattern") | S |

## Phase 3 — Mini App

**Goal**: premium UX that chat can't deliver.

| Deliverable | Complexity |
|---|---|
| Telegram Web App setup + `initData` server validation | M |
| Card reveal animation (3D flip + haptic feedback) | L |
| Reading journal grid (Pinterest-style, tap to expand) | M |
| Paywall pricing card (premium feel, comparison table) | M |
| Streak dashboard (GitHub-style heatmap) | M |
| Settings screen (web version of in-chat settings) | S |
| Onboarding wizard (web version, multi-step with progress bar) | M |

## Phase 4 — Content expansion

**Goal**: deeper product.

| Deliverable | Complexity |
|---|---|
| Dream interpretation module | M |
| Natal chart (requires ephemeris lib) | XL |
| Compatibility matcher (Mini App) | L |
| Premium decks (Thoth, Marseille) — visual + interpretation tweaks | M |
| Premium Sofia personas (e.g. "Тёмная София" for shadow work) | M |
| Spanish language pack | M |

## Phase 5 — Scale & ops

**Goal**: handle growth.

| Deliverable | Complexity |
|---|---|
| Migrate SQLite → Postgres (Neon free tier) when concurrent writers > 1 | M |
| Redis for rate limiting + session storage (replace in-memory) | M |
| Job queue (BullMQ) for memory extraction + broadcasts | M |
| Prometheus + Grafana monitoring | M |
| Backup strategy (daily DB dump to S3/R2) | S |
| CI/CD: GitHub Actions (lint, typecheck, test, deploy) | M |
| Feature flags (LaunchDarkly or in-house) | M |

## Phase 6 — Growth engine

**Goal**: viral acquisition.

| Deliverable | Complexity |
|---|---|
| Telegram Ads integration | M |
| Referral leaderboard + social proof ("X people drew The Lovers today") | S |
| Share-to-story cards (Mini App → image → Telegram story) | M |
| Group bot mode (lightweight, yes/no readings in group chats) | L |
| Influencer affiliate program (trackable deep links + revshare) | M |

## Risks to Phase progression

| Risk | Mitigation |
|---|---|
| Telegram API changes break grammY | Pin grammY version; monitor release notes |
| LLM provider quota/price change | `LLMProvider` interface → swap adapter; cost cap per user |
| SQLite write contention at scale | Phase 5 Postgres migration |
| Payment provider rejection (esoteric niche) | Lead with Stars (Telegram-native, lower rejection risk); have YooKassa + crypto as fallback |
| Competitor copies our retention features | Moat = Sofia personality + memory + community, not features |
| RU market regulatory changes | Multi-language from Phase 1 enables EN/ES expansion |

## Success metrics (illustrative)

| Metric | Phase 0 target | Phase 2 target | Phase 4 target |
|---|---|---|---|
| Onboarding completion rate | >60% | >70% | >75% |
| D1 retention | — | >30% | >40% |
| D7 retention | — | >15% | >25% |
| Free→paid conversion | — | >5% | >10% |
| Avg messages / DAU | 8 | 12 | 15 |
| Reading history views / WAU | — | >1.5 | >2.5 |
| Referral-driven signups | — | >10% | >25% |
