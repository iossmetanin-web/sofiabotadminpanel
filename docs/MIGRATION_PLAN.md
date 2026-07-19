# MIGRATION_PLAN — Sofia Bot: Python → TypeScript

> Phase 6 deliverable. Verdict per module, risks, and migration sequence.
> Source analysis: see worklog.md (Task 1-b, Sofia Code Review).

## Strategic decision

The existing Sofia bot (Python/Flask/Vercel/python-telegram-bot/asyncpg/Neon) is **rewritten in TypeScript** with **grammY** + **Prisma (SQLite)** + **z-ai-web-dev-sdk** for LLM. This fits the sandbox (Next.js/Bun), enables a shared DB with the Next.js admin panel, and modernizes the stack. The **product concept** (3-layer Sofia personality, fate card, moral codex, emotional memory, FSM shape) is **preserved as design**; only the implementation is rewritten.

The Skill's architectural PRINCIPLES (Clean Architecture, DDD, ports & adapters, FSM, middleware, repository pattern, UoW) are language-agnostic and applied faithfully — see `Architecture.md` §13 mapping.

## Per-module verdict

| Old module | Verdict | New location | Notes |
|---|---|---|---|
| `config.py` | **REWRITE** | `bot/src/config/env.ts` | zod env schema; fail-fast at startup; split into telegram/llm/db/pricing/cron configs; remove hardcoded `WEBHOOK_SECRET` default; move `PAYMENT_INSTRUCTIONS` to `pricing.ts` |
| `bot/__init__.py` | **DELETE** | — | TS modules don't need package markers |
| `bot/fsm.py` | **REWRITE** | `bot/src/domain/tarot.ts`, `bot/src/domain/zodiac.ts`, `bot/src/presentation/fsm/states.ts` | Port `SofiaState` as TS union; replace substring triggers with word-boundary regex + intent classifier; fix Capricorn bug; port tarot card map + zodiac; drop dead `get_next_state` |
| `bot/handlers.py` (2307 lines) | **DELETE & REWRITE** | `bot/src/presentation/{commands,states,callbacks,middleware,keyboards}/` | Split god module; handlers delegate to use cases; no direct DB access; fix daily-billing bug; fix "не хочу"→consent bug; fix `allowed_updates` |
| `bot/memory.py` | **DELETE & REWRITE** | `bot/src/application/services/MemoryService.ts` | Drop dead `build_context`/`should_extract_facts`; run fact extraction **synchronously in-request** (sandbox allows long polling) or via a job table; unify facts + emotional into one `Memory` table with `kind` discriminator |
| `bot/database.py` | **DELETE & REWRITE** | `bot/src/infrastructure/repositories/*.ts` | Prisma replaces asyncpg; repository pattern; `$transaction` for atomic spend+generate+save; add missing indexes (transactions.user_id, users.last_seen_at, etc.); `@updatedAt` auto-managed |
| `bot/gemini.py` | **REWRITE** | `bot/src/infrastructure/llm/`, `bot/src/domain/prompts/` | Use `system` role for Sofia prompt (not user role); add streaming; use z-ai-web-dev-sdk adapter implementing `LLMProvider`; fix `generate_single_card` to use real RNG; remove fake OpenRouter fallback IDs; split 12 generators into `llm/generators/` |
| `api/webhook.py` | **DELETE & REWRITE** | `bot/src/index.ts` (long-polling) + optional `bot/src/webhook.ts` | grammY long polling for the sandbox; validate `X-Telegram-Bot-Api-Secret-Token` if webhook mode; authenticate cron via `CRON_SECRET`; no `asyncio.run` per request |
| `local_polling.py` | **REWRITE** | `bot/src/index.ts` | grammY `bot.start({ allowed_updates: ["message","callback_query","edited_message"] })` |
| `set_webhook.py` | **REWRITE** | `bot/src/scripts/set-webhook.ts` | grammY `bot.api.setWebhook`; fix `allowed_updates` bug; add secret token |
| `requirements.txt` | **DELETE** | `bot/package.json` | — |
| `.env.example` | **REWRITE** | `bot/.env.example` | TS stack vars; remove duplicated `PAYMENT_INSTRUCTIONS` |
| `vercel.json` | **DELETE** (bot runs as mini-service) | — | Next.js admin keeps its own Vercel config if deployed |
| `README.md` | **REWRITE** | `bot/README.md` + `docs/*` | New TS architecture |

## What is KEPT (as design, ported, not copied verbatim from competitor)

1. 3-layer Sofia personality (Хранительница / Наблюдатель / Проводник) — the crown jewel.
2. The system prompt (ported as typed TS constant, split into named sections).
3. The legend (староверка 1883, digitized journals).
4. FSM onboarding shape (START → ASK_NAME → ASK_BIRTH_DATE → … → PROBING → FREE_READING → CONVERSATION).
5. Moral codex (no exact dates, no death/illness, no curses, cards as mirror).
6. Memory model (facts + emotional + last_topic_summary + return-after-20h).
7. Tarot card name map + thematic spread positions (love/career/decision).
8. Fate-card 4-part structure with hook question.
9. Monetization structure (crystals, daily free tier, paid packages, referral bonus, admin gift) — with corrected billing.
10. Rudeness escalation + soft block + apology unblock.
11. Cron jobs concept (daily card, mood check-in, birthday) — implemented via in-process scheduler in the mini-service.

## What is NEW (competitive moat — see Comparison.md)

- **Reading history/journal** (the #1 competitor gap).
- **Referral program** with tiered rewards + unique codes.
- **Streak counter** + daily ritual push.
- **Soft paywall** (cards free, interpretation paid).
- **Weekly subscription** + Stars credit packs (architecture; payment integration is a later phase).
- **Multi-language** (RU + EN from day 1).
- **Inline mode** (`@bot question`).
- **Admin panel** (Next.js) for ops, analytics, broadcasts.
- **Edit-in-place navigation**, optimistic UI, empty states, friendly errors.
- **Webhook secret validation**, authenticated crons, input validation, rate limiting.

## Migration sequence

1. **Schema first** — Prisma schema (done) → `db:push`. Both bot and admin read the same SQLite file.
2. **Bot mini-service skeleton** — grammY + Clean Arch folders + env config + long polling. Verify `getMe` + `/start` echo.
3. **Domain layer** — Sofia prompt, tarot map, zodiac, FSM states, entities. Pure TS, zero framework imports.
4. **Infrastructure** — Prisma repositories, LLM provider (z-ai-web-dev-sdk), memory service.
5. **Presentation** — commands, state handlers, callbacks, keyboards, middleware.
6. **Next.js admin** — dashboard, users, transactions, broadcasts, reading history viewer.
7. **Cron/scheduler** — in-process `setInterval`-based scheduler for daily card, check-in, streak reset.
8. **Verification** — lint, types, agent-browser, end-to-end `/start` → onboarding → free reading → paid reading.

## Risk register

| # | Risk | L | I | Mitigation |
|---|---|---|---|---|
| R1 | Telegram API unreachable from sandbox | M | H | Long-polling with retry/backoff; log `getMe` failures; fallback to a "dry run" mode that echoes to console |
| R2 | z-ai-web-dev-sdk LLM quota/latency | M | M | Streaming with throttled edits; 6s timeout; graceful "туман сегодня густой" fallback (Sofia-voice) |
| R3 | SQLite write contention (single writer) | M | M | WAL mode; short transactions; `$transaction` scoped tightly; bot is single-process so contention is minimal |
| R4 | Prompt parity drift vs old bot | M | M | Port the prompt verbatim as a TS template; snapshot test; A/B 10 samples before "production" |
| R5 | `allowed_updates` regression (old bug) | M | H | Explicitly set `["message","callback_query","edited_message","inline_query"]`; verify via `getWebhookInfo`/`getMe` |
| R6 | Daily-message billing logic regression | H | M | Reimplement cleanly: charge BEFORE generate; never replace LLM reply with billing text; unit tests |
| R7 | FSM state persistence across restarts | M | M | grammY session storage backed by Prisma (`User.onboardingStep` column is source of truth) |
| R8 | Inline button callback auth (forwarded callback_data) | L | M | Sign callback_data with a per-user HMAC; or track pending keyboards in a `pending_actions` table |
| R9 | Bot token exposed in logs | M | H | Never log `BOT_TOKEN`; mask in health endpoint; `.env` only |
| R10 | No tests exist (old bot had none) | H | H | Ship unit tests for FSM, billing, parsers, zodiac, tarot; integration tests for each command with mocked LLM |
| R11 | Memory extraction blocking the request | M | M | Run synchronously after the reply is sent (long-polling allows this); or queue in a `jobs` table processed by a scheduler |
| R12 | Subscription/Stars payment not available in sandbox | H | M | Implement the data model + UX now; defer actual Stars API integration to a later phase (documented in Roadmap) |

## What is explicitly NOT done in this phase

- Migrating existing Neon Postgres data (no production data in sandbox).
- Real Telegram Stars payment integration (UX + data model only).
- Mini App (documented in Roadmap; chat-first UX shipped now).
- Deployment to Vercel/production (sandbox-only; user deploys later with provided tokens).

## Rollback

Since this is a greenfield TS implementation in a new `bot/` mini-service + the existing Next.js app, there is no production cutover to roll back. The old Python repo remains untouched at `research/sofiabot/` for reference.
