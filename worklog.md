# Worklog — Sofia Bot Re-architecture Project

Project: Re-architect the Sofia Telegram bot (originally Python/Flask/Vercel) into a
modern TypeScript implementation running inside this Next.js sandbox.

Environment constraints:
- Next.js 16 + TypeScript + Bun (port 3000) for the web admin/landing.
- Telegram bot runs as a mini-service (separate port, grammY framework).
- Prisma + SQLite for persistence.
- z-ai-web-dev-sdk for backend AI work (not in client).

Strategic decision: Apply the Skill's architectural PRINCIPLES (Clean Architecture,
DDD, ports & adapters, FSM, middleware, repository pattern, UoW) — they are
language-agnostic — but implement in TypeScript with grammY (TS-first, modern FSM)
instead of Python/aiogram. This fits the sandbox and gives a better DX.

---
Task ID: 0
Agent: orchestrator (main)
Task: Bootstrap project, clone repos, set up research workspace, plan phases.

Work Log:
- Inspected existing Next.js sandbox (shadcn/ui, Prisma, port 3000).
- Cloned telegramskils (Skill) and sofiabot (existing bot) into /home/z/my-project/research/.
- Read SKILL.md and sofiabot README to understand scope.
- Decided on TypeScript/grammY re-implementation with Clean Architecture.
- Created this worklog.md as the shared handover document.

Stage Summary:
- Research workspace ready at /home/z/my-project/research/{telegramskils,sofiabot}.
- Three parallel research agents launched next: Skill digest, Sofia code review, competitor UX research.
- Next: produce MIGRATION_PLAN.md + architecture docs, then build bot mini-service + Next.js admin panel.

---
Task ID: 1-b
Agent: sofia-code-reviewer
Task: Code review the existing sofiabot Python repo.

Work Log:
- Read /home/z/my-project/worklog.md to understand prior orchestrator context.
- Read all 14 source files in /home/z/my-project/research/sofiabot/:
  config.py, bot/__init__.py, bot/fsm.py, bot/handlers.py (2307 lines),
  bot/database.py (914 lines), bot/memory.py, bot/gemini.py (1107 lines),
  api/webhook.py, local_polling.py, set_webhook.py, requirements.txt,
  .env.example, vercel.json, README.md.
- Catalogued the full FSM (17 states), DB schema (6 tables + 13 ALTERed columns),
  3-layer Sofia system prompt, 12 LLM generator functions, all triggers,
  monetization tiers, cron endpoints, and the moral codex.
- Identified 40+ concrete code-review findings (god module, string-based FSM,
  substring trigger collisions, fire-and-forget fact extraction that is silently
  killed by Vercel's event loop, missing webhook secret validation, unauthenticated
  cron endpoints, hardcoded bot username, dead PROBING_ROUNDS logic, daily-limit
  billing bug, missing indexes, etc.).
- Produced a per-module DELETE / REWRITE / KEEP verdict and a migration risk register.

Stage Summary:
- Full structured report delivered in the agent's final message (10 sections:
  architecture map, DB schema, FSM, LLM integration, monetization, personality/codex,
  per-file code review, reusability, per-module verdict, risk register).
- Key reusable assets: the 3-layer Sofia personality + system prompt, FSM shape,
  schema design (users/conversations/memory_facts/emotional_memory/transactions),
  tarot card name mapping, zodiac computation, return-after-20h logic, moral codex,
  thematic spreads, fate-card 4-part structure with hook.
- Key rewrite drivers: handlers.py is an untestable 2307-line god module;
  substring trigger routing is fragile; daily-message billing is buggy;
  asyncio.create_task fact extraction is dead in serverless; no Clean Arch layering;
  no input validation; no auth on cron; no tests; SQLite/Prisma migration will
  require schema translation + data migration from Neon Postgres.
- The full report lives in this agent's final message (not persisted as a file,
  per task instructions — "Do NOT write any code files. Do NOT modify the repo."
  beyond the worklog append).

---
Task ID: 1-a
Agent: skill-analyzer
Task: Produce principles digest of telegramskils Skill repo.

Work Log:
- Read /home/z/my-project/worklog.md to absorb prior context (Task 0).
- Inventoried the full tree of /home/z/my-project/research/telegramskils (architecture/, rules/, patterns/, checklists/, prompts/, templates/, examples/, references/).
- Re-read SKILL.md end-to-end (315 lines) — captured the 10 core philosophy principles, 4-layer structure, 55 mandatory rules, anti-patterns table, workflow, verification checklist.
- Read all architecture/ docs:
  * clean-architecture/README.md + layers.md (dependency rule, per-layer patterns, test pyramid).
  * ddd/README.md + aggregates.md + context-mapping.md (bounded contexts, ubiquitous language, ACL).
  * hexagonal/README.md + ports-and-adapters.md (driving/driven ports, Protocol-based ports, adapter swapping).
  * telegram/fsm, middleware, handlers, callbacks, filters, router-strategy, aiogram3, dependency-injection.
  * ai/prompt-engineering, conversation-memory, llm-integration, openrouter, openai, anthropic, tool-calling, rag, context-management.
  * database/repository-pattern, unit-of-work, postgresql, sqlalchemy, alembic.
  * cqrs, event-driven, microservices.
  * security/input-validation, secrets-management, rate-limiting.
  * performance/caching, optimization, concurrency.
  * infrastructure/configuration, monitoring, deployment, cicd, logging, docker, redis.
- Read all rules/ docs: aiogram-rules, async-rules, security-rules, python-rules, coding-standards, testing-rules, documentation-rules.
- Read all patterns/ docs: behavioral (Strategy/Observer/Command/State/Chain), creational (Factory/Builder/Singleton/Prototype), concurrency (Lock/Circuit Breaker/Event/Condition), integration (Provider/ACL/Gateway/Saga), structural (Adapter/Decorator/Facade/Proxy).
- Read all checklists/ docs: code-review, security, production, pre-merge, deployment, release.
- Read prompts/system-prompts, conversation-templates, context-templates, tool-descriptions, routing-prompts.
- Read templates/project-skeleton/README + bot/main.py + bot/config.py for wiring patterns.
- Synthesized the complete PRINCIPLES DIGEST (see Stage Summary for the full text — it is returned as the agent's final message and is the canonical handover artifact for Tasks 2+).

Stage Summary:
- The Skill repository is an exhaustive, opinionated playbook for production Telegram bots built on aiogram 3.x + SQLAlchemy 2.0 + Redis + Pydantic v2 + structlog + Alembic + Docker, with multi-provider LLM integration (OpenAI / Anthropic / OpenRouter) including streaming, conversation memory tiers, prompt versioning, tool calling, and cost-aware routing.
- Architectural spine: Clean Architecture + Hexagonal ports-and-adapters + DDD tactical patterns (entities, value objects, aggregates, domain events, repositories per aggregate root, Unit of Work, CQRS, event-driven bus). Dependencies strictly point inward (domain ← application ← infrastructure ← presentation). Domain layer is framework-free.
- The PRINCIPLES DIGEST (returned as the final message of this agent, to be saved as `/home/z/my-project/research/telegramskils_DIGEST.md` by the orchestrator) condenses every architectural rule, pattern, naming convention, anti-pattern, testing strategy, security stance, checklist, prompt-design advice, and — crucially for the re-implementation — a per-pattern mapping to TypeScript + grammY + Prisma + zod + pino + z-ai-web-dev-sdk.
- Key language-agnostic principles to carry over: thin handlers delegating to use cases; ports defined in application layer; fakes (not mocks) for repository tests; one UoW per use case with auto-rollback; streaming-by-default with throttled message edits; three-tier conversation memory (working/summary/system) with token budget allocation; provider protocol + factory + fallback chain; per-user/per-action sliding-window rate limits with exponential backoff; SecretStr-equivalent for secrets; enum-based FSM states with TTL; CallbackData-style typed callback payloads; correlation-ID structured logging; fail-fast configuration; never blocking I/O in async context.
- Next research agents (sofiabot code review, competitor UX) can layer on top of this digest; the orchestrator can produce MIGRATION_PLAN.md using the digest's "Mapping to TypeScript/grammY" section verbatim.

---
Task ID: 1-c
Agent: competitor-researcher
Task: Research @taro_gpt_bot competitor UX (principles only, no copying).

Work Log:
- Read existing worklog.md to align with project context (Sofia bot re-architecture, TS/grammY).
- Invoked web-search skill (CLI `z-ai function -n web_search`) and web-reader skill (CLI `z-ai function -n page_reader`).
- Performed 18 web searches covering: @taro_gpt_bot directly, AI tarot Telegram bots (EN + RU), Telegram bot UX/inline-keyboard best practices, Telegram Mini App monetization, freemium/credit/subscription conversion, retention/streak tactics, AI persona/character roleplay bots, referral programs, Co-Star astrology app UX, AI feature monetization.
- Fetched and parsed 16 long-form pages: t.me/taro_gpt_bot (competitor direct page — extracted bot description, user count, /start screen text — PRINCIPLES ONLY extracted, no verbatim reproduction beyond unavoidable proper nouns), findmini.app/ru/taro_gpt_bot (catalog card with full description and /start screenshot), dev.to "500 paying users in 3 months" (credit-based monetization + 14% conversion benchmark), GramIO UX patterns guide, Medium "10 Best UX Practices for Telegram Bots", OmiSoft Mini App monetization 2026, SMMplanner Russian tarot bot article (competitor "Стас Астроглаз"), vc.ru tarot bot MVP test (BotHelp + funnel + the "90% freebie-seekers in esoteric niche" comment), vc.ru @tarologia_robot guide (Yes/No + 3-card + bot deck vs own cards + history), core.telegram.org/bots/webapps (Mini App capabilities), TG-Staff welcome-message article, TG-Staff inline-keyboard UX article, Teleclaw monetization article, divkix.me scaling bot to 300k users, memberpass.net Telegram membership growth, auraeastrology Co-Star review, lennysnewsletter AI monetization framework.
- Key competitor facts confirmed:
  * Bot display name: "Таролог (TaroGPT) — расклад таро мгновенно" / handle @taro_gpt_bot.
  * ~31,655 monthly users (slightly declining -1.2% MoM per FindMini sensor).
  * Russian-language only (RU). 18+ niche.
  * Positioning: "AI helper for deciphering tarot spreads" — instant AI tarot readings on any question.
  * Owner/support: @goodcopy_support.
  * Free-form chat interface: user types a question, bot produces a spread + interpretation. Default 3 cards, auto-selected schema, reversed cards toggle, choice of "tarologist" persona (e.g. "TaroGPT-2") and deck (Rider–Waite).
  * Hybrid input: virtual deck OR user types cards drawn from a physical deck.
  * Commands: /start, /flow (settings), /reset.
  * Engagement hook observed: "card of the day for tomorrow" teaser in /start.
  * NO visible paywall, referral, mini app, natal chart, horoscope module, streak system, or yes/no mode in the public surface (likely absent or very soft).
- Synthesized all findings into a single Competitor UX Map (delivered as the agent's final message). The map is principle-level: UX patterns, screen tree, FSM, monetization model, engagement tactics, message formatting, psychological triggers, Mini App opportunities, lessons to apply, and a feature comparison baseline table. No competitor creative/marketing text reproduced verbatim; only structural/principle-level observations and proper nouns (bot name, handle) are cited.

Stage Summary:
- The full Competitor UX Map is delivered in the agent's final message (not as a separate file, per task instructions "Do NOT write any code files").
- Key headline findings:
  1. Competitor @taro_gpt_bot is a lean, RU-only, free-form chat AI tarot bot (~31.7K MAU, modest scale, slightly declining). Its moat is "TaroGPT" persona + configurable deck/card-count/reversals + hybrid virtual/physical deck input.
  2. Competitor does NOT visibly use: paywall, referral, Mini App, natal chart, separate horoscope, dream interpretation, streak/ritual system, multi-language. → Big opportunity gap.
  3. Industry benchmarks to beat: 2–5% free→paid conversion is normal for bots; the reference AI bot hit 14% via credit-based pricing (not subscription). Day-0 = 90% of all purchases. Weekly plans convert 5.4× better than annual. Rewarded interstitials hit 20–40% CTR.
  4. Critical RU-market warning (vc.ru comment): "in esoteric niche, ~90% are freebie-seekers — they unsubscribe the moment they get the free answer." → Our funnel must (a) delay the free payload, (b) make the first reading *partial* (card + 1-line teaser, full interpretation = paid), (c) seed identity/ritual before paywall.
  5. Architecture principles to adopt: button-first /edit-in-place navigation, FSM with breadcrumb+back+home on every screen, ctx.answer on every callback, optimistic loading placeholders, explicit empty states, destructive-action confirmation, save-progress-between-sessions, inline-mode for viral growth, deep-link start_param for referral + ad-source attribution + A/B paywall testing.
  6. Monetization recommendation: hybrid = small daily free ritual (1 card, short interpretation) + Telegram Stars credit packs + weekly subscription (5.4× better conversion than annual) + rewarded-video ad unit (earn 1 reading by watching) + referral bonus (invite X friends → unlock premium deck/persona).
  7. Mini App opportunity: a Web App for the *card reveal animation* + *journal/history grid* + *birth chart wheel* + *deck gallery* — things that are painful in plain chat. The chat stays the entry point and the conversational reading stays in chat; the Mini App handles visualization and history.
- Next agents (architect/builder) can use the Comparison Baseline table in section 11 as a feature checklist when designing our bot's FSM and menu tree.

---
Task ID: 2
Agent: orchestrator (main)
Task: Phase 6-8 documentation + Phase 9 foundation.

Work Log:
- Pushed Prisma schema (users, conversations, memories, transactions, readings, referrals, audit_logs, broadcasts, bot_config) to SQLite. WAL mode.
- Wrote 12 design docs in /home/z/my-project/docs/:
  MIGRATION_PLAN.md, Architecture.md, UserFlow.md, Navigation.md, FSM.md,
  StateMachine.md, UX.md, SalesFunnel.md, FeatureList.md, RepositoryStructure.md,
  Roadmap.md, Comparison.md.
- Key decisions locked: TypeScript + grammY + Prisma(SQLite) + z-ai-web-dev-sdk;
  4-layer Clean Architecture; Sofia 3-layer personality ported as design;
  corrected crystal billing (charge-before-generate, refund on failure);
  referral program; reading history; streak; admin panel in Next.js.

Stage Summary:
- Design phase complete. All research synthesized into actionable docs.
- Next: build bot mini-service (mini-services/sofia-bot/) + Next.js admin panel.
- Bot runs on port 3003 (long polling to Telegram). Admin on port 3000.
- Both share the SQLite DB via Prisma.

---
Task ID: 3
Agent: orchestrator (main)
Task: Phase 9-10 — build bot mini-service + Next.js admin panel + verify.

Work Log:
- Built bot mini-service (mini-services/sofia-bot/) with Clean Architecture:
  - domain/ (entities, value objects, exceptions, tarot 78-card map, zodiac, Sofia 3-layer system prompt)
  - application/ (ports/interfaces, services: ContextManager, MemoryService, BillingService)
  - infrastructure/ (Prisma repos, z-ai-web-dev-sdk LLM provider, scheduler, pino logger)
  - presentation/ (grammY bot, commands, onboarding/conversation/callback handlers, keyboards, middleware, formatters)
- Bot connects to Telegram (@oracultetris_bot) via long polling (allowed_updates includes callback_query — fixes old bot bug).
- Corrected crystal billing (charge-before-generate, refund on failure, never replace LLM reply with billing text).
- Implemented: onboarding (START→ASK_NAME→BIRTH_DATE/TIME/PLACE→PROBING→FREE_READING→CONVERSATION),
  free conversation with streaming-LLM Sofia, memory extraction (every 5 msgs), return greeting (>20h),
  6 tarot spreads + horoscope + free card + card-of-day, referral program, reading history, admin panel
  (/admin, /add @username N, broadcast with 2-step confirm), cron scheduler (heartbeat, broadcast outbox,
  daily card nudge, birthday, mood check-in).
- Built Next.js admin panel (port 3000) at / route: landing hero + dashboard with 4 tabs
  (Overview/Users/Readings/Broadcasts), stat cards, funnel viz, readings-by-type chart, user table,
  readings feed, broadcast composer with outbox pattern.
- DB-outbox pattern: bot writes heartbeat to BotConfig every 20s (admin reads it for "bot online" status);
  admin writes broadcasts as "pending" rows; bot polls every 8s and sends them. Avoids cross-process HTTP
  fetch issues (Next.js server-side fetch couldn't reach localhost:3003).
- Seeded 4 test users + 3 readings for dashboard demo.
- Verified via agent-browser: page renders, all 4 tabs work, bot status shows online, broadcast created
  and processed end-to-end (sent=0/failed=3 expected — fake telegram IDs).
- Final checks: lint 0 errors/0 warnings, bot tsc clean, footer sticky (min-h-screen flex flex-col mt-auto).

Stage Summary:
- Bot mini-service running on its own process (long polling to Telegram + internal HTTP on 3003).
- Next.js admin panel running on port 3000 (user-visible / route).
- Both share the SQLite DB via Prisma (WAL mode).
- All 12 design docs in /home/z/my-project/docs/.
- Bot is live and ready: user can message @oracultetris_bot to test the full flow (onboarding → fate card → conversation → paid readings).
- Known limitation: payment integration (Stars/fiat) is UX-only (data model + buy menu); real payments are a later phase (documented in Roadmap).
- Next: cron job (webDevReview every 15 min) will continue QA + feature expansion.
