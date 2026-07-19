# Architecture — Sofia Bot (TypeScript)

> Phase 7 deliverable. 4-layer Clean Architecture + Hexagonal ports, applied to grammY + Prisma + z-ai-web-dev-sdk.
> Source: telegramskils Skill digest (Task 1-a) §1–§13.

## Layer structure

```
┌─────────────────────────────────────────────────────────────┐
│  Presentation  (grammY Composers, keyboards, middleware, FSM)│  bot/src/presentation/
├─────────────────────────────────────────────────────────────┤
│  Application   (use cases, DTOs, ports/interfaces, services) │  bot/src/application/
├─────────────────────────────────────────────────────────────┤
│  Domain        (entities, value objects, events, exceptions, │  bot/src/domain/
│                 tarot map, zodiac, Sofia prompt — NO imports)│
├─────────────────────────────────────────────────────────────┤
│  Infrastructure (Prisma repos, LLM adapter, scheduler, etc.) │  bot/src/infrastructure/
└─────────────────────────────────────────────────────────────┘
```

**Dependency rule**: source dependencies point **inward only**. Delete `grammy` / `@prisma/client` / `z-ai-web-dev-sdk` from `node_modules` → only Infrastructure + Presentation fail to compile. Domain + Application stay intact. This is the law; enforced by lint rule `no-restricted-imports` on `domain/` and `application/`.

## Project structure (bot mini-service)

```
mini-services/sofia-bot/
├── package.json
├── tsconfig.json
├── .env.example
├── README.md
└── src/
    ├── index.ts                       # Composition root: wire Bot + Composer + start polling
    ├── config/
    │   └── env.ts                     # zod env schema, fail-fast parse at startup
    ├── domain/
    │   ├── entities/
    │   │   ├── User.ts                # User entity (telegramId, crystals, state…)
    │   │   ├── Conversation.ts        # Conversation aggregate root
    │   │   └── Reading.ts             # Reading entity
    │   ├── value-objects/
    │   │   ├── TelegramId.ts
    │   │   ├── Crystals.ts            # spend(n) with invariant "balance >= 0"
    │   │   ├── BirthDate.ts           # zodiac derivation
    │   │   └── MessageText.ts         # length cap, sanitize
    │   ├── events/
    │   │   └── domain-events.ts       # UserRegistered, ReadingCompleted, PaymentReceived…
    │   ├── exceptions/
    │   │   └── errors.ts              # UserNotFoundError, InsufficientCrystalsError, LLMError hierarchy
    │   ├── tarot.ts                   # 78-card map (22 major + 4×14 minor), spread definitions
    │   ├── zodiac.ts                  # zodiac-from-birthdate (Capricorn wrap fixed)
    │   └── prompts/
    │       ├── sofia-system.ts        # 3-layer Sofia system prompt (typed constant)
    │       ├── fate-card.ts           # 4-part fate card generator prompt
    │       ├── tarot-reading.ts       # tarot spread interpretation prompt
    │       └── memory-extract.ts      # fact/emotional extraction prompt
    ├── application/
    │   ├── use-cases/
    │   │   ├── StartOnboarding.ts
    │   │   ├── ContinueOnboarding.ts
    │   │   ├── GenerateSofiaReply.ts
    │   │   ├── RequestReading.ts      # validates balance, spends crystals, calls LLM, saves Reading
    │   │   ├── RequestFreeCard.ts
    │   │   ├── ExtractMemory.ts
    │   │   ├── HandleReturn.ts        # >20h absence → return greeting
    │   │   ├── AddCrystals.ts         # admin
    │   │   └── Broadcast.ts           # admin
    │   ├── dto/
    │   │   └── *.ts                   # Request/Response DTOs per use case
    │   ├── ports/
    │   │   ├── UserRepository.ts      # interface
    │   │   ├── ConversationRepository.ts
    │   │   ├── MemoryRepository.ts
    │   │   ├── TransactionRepository.ts
    │   │   ├── ReadingRepository.ts
    │   │   ├── LLMProvider.ts         # generate/stream/countTokens interface
    │   │   ├── CacheBackend.ts
    │   │   └── EventPublisher.ts
    │   └── services/
    │       ├── MemoryService.ts       # context assembly, fact extraction
    │       ├── ContextWindowManager.ts # token counting + truncation
    │       ├── BillingService.ts      # crystal spend/refund, daily-limit accounting
    │       └── ReferralService.ts
    ├── infrastructure/
    │   ├── database/
    │   │   ├── prisma.ts              # PrismaClient singleton, WAL mode
    │   │   └── repositories/
    │   │       ├── PrismaUserRepository.ts
    │   │       ├── PrismaConversationRepository.ts
    │   │       ├── PrismaMemoryRepository.ts
    │   │       ├── PrismaTransactionRepository.ts
    │   │       └── PrismaReadingRepository.ts
    │   ├── llm/
    │   │   ├── ZaiLLMProvider.ts      # z-ai-web-dev-sdk adapter implementing LLMProvider
    │   │   ├── StreamingHandler.ts    # placeholder → throttled edits → final
    │   │   └── errors.ts              # LLMRateLimitError, LLMTimeoutError, LLMContentFilterError…
    │   ├── scheduler/
    │   │   └── CronScheduler.ts       # in-process setInterval for daily card, check-in, streak
    │   ├── fsm/
    │   │   └── PrismaSessionStorage.ts # grammY session storage backed by User.onboardingStep
    │   └── logging/
    │       └── logger.ts              # pino with correlation_id, user_id, chat_id binding
    └── presentation/
        ├── bot.ts                     # Bot instance + Composer wiring
        ├── composer.ts                # feature Composers registration order
        ├── commands/                  # one file per command: start, profile, balance, menu, help, admin…
        ├── states/                    # one handler per FSM state
        ├── callbacks/                 # inline button router (grammY callback_data plugin)
        ├── keyboards/                 # InlineKeyboard builders
        ├── middleware/
        │   ├── logging.ts
        │   ├── session.ts             # grammY session + Prisma storage
        │   ├── typing.ts              # optimistic "печатает…" loop
        │   ├── rate-limit.ts          # per-user sliding window
        │   └── error-boundary.ts      # catch domain errors → user-friendly message
        ├── filters/                   # IsAdmin, IsPrivate, word-boundary triggers
        └── formatters/                # formatProfile, formatBalance, escapeHtml
```

## Next.js admin panel structure

```
src/app/
├── page.tsx                           # Landing + admin shell (single route)
├── api/
│   ├── stats/route.ts                 # dashboard metrics
│   ├── users/route.ts                 # paginated users
│   ├── users/[id]/route.ts            # user detail
│   ├── transactions/route.ts
│   ├── readings/route.ts
│   ├── broadcasts/route.ts            # POST → enqueue broadcast
│   └── bot/status/route.ts            # bot health (calls bot mini-service)
└── components/                        # dashboard widgets, charts, tables
```

The admin talks to the **same SQLite DB** via Prisma (read-only for analytics; writes go through API routes that respect the same domain rules). The admin can also send commands to the bot via a small internal HTTP API on the bot's port (e.g. `POST /internal/broadcast`).

## Key architectural decisions

| Decision | Choice | Rationale |
|---|---|---|
| Architecture | Clean + Hexagonal | Domain isolation; swappable adapters (DB, LLM, storage) |
| Bot framework | grammY | TS-first, modern FSM via sessions/conversations, great DX, callback_data plugin |
| ORM | Prisma (SQLite) | Sandbox constraint; typed; migrations; shared with admin |
| FSM storage | Prisma `User.onboardingStep` | Cross-restart persistence (long polling restarts); single source of truth |
| LLM | z-ai-web-dev-sdk (via `LLMProvider` interface) | Sandbox rule (backend only); swappable |
| Streaming | grammY `editMessageText` throttled ~1.5s | Per Skill §7; respect Telegram edit rate limit |
| Config | zod env schema, fail-fast | Per Skill §4; no hardcoded values |
| Logging | pino (JSON prod, pretty dev) with bound context | Per Skill §4; correlation IDs |
| Sessions | grammY `session()` + custom Prisma storage | Per Skill §5; TTL not needed (DB-backed) |
| Callbacks | `@grammyjs/callback-data` plugin | Type-safe payloads; per Skill §5 |
| Validation | zod at boundaries (presentation + application) | Per Skill §6 |
| Rate limiting | in-memory sliding window per user/action | SQLite can't do Redis sorted sets; single-process so OK |
| Scheduler | in-process `setInterval` with jitter | Sandbox has no cron daemon; long polling process is always-on |
| Tests | `bun:test` | Native to Bun; per Skill §11 (fakes over mocks) |

## Dependency rule enforcement (lint)

`eslint.config.mjs` adds `no-restricted-imports`:
- `bot/src/domain/**` may NOT import `grammy`, `@prisma/client`, `z-ai-web-dev-sdk`, `ioredis`, any `infrastructure/*` or `presentation/*`.
- `bot/src/application/**` may NOT import `grammy`, `@prisma/client`, `z-ai-web-dev-sdk` (only its own `ports/` interfaces).

## Composition root (`index.ts`)

```
1. parseEnv() → config (fail-fast)
2. prisma = new PrismaClient(); prisma.$executeRaw`PRAGMA journal_mode=WAL`
3. repos = { users: new PrismaUserRepository(prisma), … }
4. llm = new ZaiLLMProvider(config)
5. useCases = { startOnboarding: new StartOnboarding(repos, llm), … }
6. bot = new Bot(config.BOT_TOKEN)
7. bot.use(session({ storage: new PrismaSessionStorage(repos.users) }))
8. bot.use(loggingMiddleware, rateLimitMiddleware, typingMiddleware, errorBoundary)
9. register composers: onboarding, conversation, readings, admin, callbacks
10. scheduler.start()
11. bot.start({ allowed_updates: ["message","callback_query","edited_message","inline_query"] })
12. process.on(SIGINT/SIGTERM) → bot.stop() + prisma.$disconnect()
```

## Why this beats the old architecture

- **No god module**: `handlers.py` (2307 lines) → ~30 small files, each testable.
- **No dead background tasks**: fact extraction runs synchronously after reply (long polling keeps the process alive).
- **No unauthenticated endpoints**: webhook secret + cron secret enforced.
- **No connection-per-request**: Prisma connection pool; single client.
- **No substring trigger collisions**: word-boundary regex + intent classifier.
- **Correct billing**: charge-before-generate; LLM reply never replaced by billing text.
- **Streaming**: long readings stream instead of blocking 5–8s.
- **Tests**: fakes for every repository; unit tests for FSM, billing, parsers.
- **Shared DB with admin panel**: real-time analytics, no ETL.
