# Repository Structure — Sofia Bot

> Phase 7 deliverable. Folder layout for the new monorepo (Next.js app + bot mini-service + docs).

## Top-level layout

```
/home/z/my-project/                       # the sandbox workspace
├── docs/                                  # ← Phase 6-8 documentation (this folder)
│   ├── MIGRATION_PLAN.md
│   ├── Architecture.md
│   ├── UserFlow.md
│   ├── Navigation.md
│   ├── FSM.md
│   ├── StateMachine.md
│   ├── UX.md
│   ├── SalesFunnel.md
│   ├── FeatureList.md
│   ├── RepositoryStructure.md
│   ├── Roadmap.md
│   └── Comparison.md
│
├── prisma/
│   └── schema.prisma                      # shared Prisma schema (SQLite)
│
├── db/
│   └── custom.db                          # SQLite database file (WAL mode)
│
├── src/                                   # Next.js 16 app (admin + landing)
│   ├── app/
│   │   ├── page.tsx                       # single user-visible route: landing + admin shell
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   └── api/                           # Next.js API routes (admin backend)
│   │       ├── stats/route.ts
│   │       ├── users/route.ts
│   │       ├── users/[id]/route.ts
│   │       ├── transactions/route.ts
│   │       ├── readings/route.ts
│   │       ├── broadcasts/route.ts
│   │       └── bot/status/route.ts        # proxies to bot mini-service health
│   ├── components/
│   │   ├── ui/                            # shadcn/ui (already present)
│   │   ├── admin/                         # admin dashboard widgets
│   │   │   ├── Dashboard.tsx
│   │   │   ├── StatsCards.tsx
│   │   │   ├── UsersTable.tsx
│   │   │   ├── TransactionsTable.tsx
│   │   │   ├── ReadingsTable.tsx
│   │   │   ├── BroadcastComposer.tsx
│   │   │   └── BotStatus.tsx
│   │   └── landing/                       # public landing page sections
│   │       ├── Hero.tsx
│   │       ├── Features.tsx
│   │       ├── HowItWorks.tsx
│   │       └── CTA.tsx
│   └── lib/
│       ├── db.ts                          # Prisma client singleton
│       └── utils.ts
│
├── mini-services/
│   └── sofia-bot/                         # ← the Telegram bot (independent bun project)
│       ├── package.json
│       ├── tsconfig.json
│       ├── .env.example
│       ├── README.md
│       └── src/
│           ├── index.ts                   # composition root
│           ├── config/env.ts              # zod env
│           ├── domain/                    # ← NO framework imports (enforced by lint)
│           │   ├── entities/
│           │   │   ├── User.ts
│           │   │   ├── Conversation.ts
│           │   │   └── Reading.ts
│           │   ├── value-objects/
│           │   │   ├── TelegramId.ts
│           │   │   ├── Crystals.ts
│           │   │   ├── BirthDate.ts
│           │   │   └── MessageText.ts
│           │   ├── events/
│           │   │   └── domain-events.ts
│           │   ├── exceptions/
│           │   │   └── errors.ts
│           │   ├── tarot.ts
│           │   ├── zodiac.ts
│           │   └── prompts/
│           │       ├── sofia-system.ts
│           │       ├── fate-card.ts
│           │       ├── tarot-reading.ts
│           │       └── memory-extract.ts
│           ├── application/               # ← may import domain + own ports only
│           │   ├── use-cases/
│           │   │   ├── StartOnboarding.ts
│           │   │   ├── ContinueOnboarding.ts
│           │   │   ├── GenerateSofiaReply.ts
│           │   │   ├── RequestReading.ts
│           │   │   ├── RequestFreeCard.ts
│           │   │   ├── ExtractMemory.ts
│           │   │   ├── HandleReturn.ts
│           │   │   ├── AddCrystals.ts
│           │   │   └── Broadcast.ts
│           │   ├── dto/
│           │   ├── ports/
│           │   │   ├── UserRepository.ts
│           │   │   ├── ConversationRepository.ts
│           │   │   ├── MemoryRepository.ts
│           │   │   ├── TransactionRepository.ts
│           │   │   ├── ReadingRepository.ts
│           │   │   ├── LLMProvider.ts
│           │   │   └── EventPublisher.ts
│           │   └── services/
│           │       ├── MemoryService.ts
│           │       ├── ContextWindowManager.ts
│           │       ├── BillingService.ts
│           │       └── ReferralService.ts
│           ├── infrastructure/            # ← implements application ports
│           │   ├── database/
│           │   │   ├── prisma.ts
│           │   │   └── repositories/
│           │   │       ├── PrismaUserRepository.ts
│           │   │       ├── PrismaConversationRepository.ts
│           │   │       ├── PrismaMemoryRepository.ts
│           │   │       ├── PrismaTransactionRepository.ts
│           │   │       └── PrismaReadingRepository.ts
│           │   ├── llm/
│           │   │   ├── ZaiLLMProvider.ts
│           │   │   ├── StreamingHandler.ts
│           │   │   └── errors.ts
│           │   ├── scheduler/
│           │   │   └── CronScheduler.ts
│           │   ├── fsm/
│           │   │   └── PrismaSessionStorage.ts
│           │   └── logging/
│           │       └── logger.ts
│           └── presentation/              # ← grammY Composers
│               ├── bot.ts
│               ├── composer.ts
│               ├── commands/
│               │   ├── start.ts
│               │   ├── menu.ts
│               │   ├── profile.ts
│               │   ├── balance.ts
│               │   ├── help.ts
│               │   ├── cancel.ts
│               │   └── admin.ts
│               ├── states/
│               │   ├── askName.ts
│               │   ├── askBirthDate.ts
│               │   ├── askBirthTime.ts
│               │   ├── askBirthPlace.ts
│               │   ├── probing.ts
│               │   ├── freeReading.ts
│               │   ├── conversation.ts
│               │   ├── paidHook.ts
│               │   ├── taroAskNumbers.ts
│               │   ├── taroReading.ts
│               │   ├── singleCard.ts
│               │   ├── cardOfDay.ts
│               │   ├── blocked.ts
│               │   ├── awaitDeleteConfirm.ts
│               │   └── broadcast.ts
│               ├── callbacks/
│               │   ├── menuCallbacks.ts
│               │   ├── readingCallbacks.ts
│               │   ├── adminCallbacks.ts
│               │   └── confirmCallbacks.ts
│               ├── keyboards/
│               │   ├── mainMenu.ts
│               │   ├── readingMenu.ts
│               │   ├── profileScreen.ts
│               │   ├── balanceScreen.ts
│               │   ├── buyMenu.ts
│               │   ├── historyScreen.ts
│               │   ├── settingsScreen.ts
│               │   └── adminPanel.ts
│               ├── middleware/
│               │   ├── logging.ts
│               │   ├── session.ts
│               │   ├── typing.ts
│               │   ├── rateLimit.ts
│               │   └── errorBoundary.ts
│               ├── filters/
│               │   ├── isAdmin.ts
│               │   ├── isPrivate.ts
│               │   └── triggers.ts
│               └── formatters/
│                   ├── profile.ts
│                   ├── balance.ts
│                   ├── reading.ts
│                   └── escape.ts
│
├── research/                              # cloned reference repos (gitignored from any deploy)
│   ├── telegramskils/                     # the Skill (read-only reference)
│   └── sofiabot/                          # the old Python bot (read-only reference)
│
├── worklog.md                             # shared handover document (all agents)
├── package.json                           # Next.js app
├── prisma/schema.prisma
└── .env                                   # DATABASE_URL, BOT_TOKEN, ADMIN_ID, etc.
```

## Dependency graph

```
Next.js app (port 3000)  ──reads──►  SQLite (db/custom.db)  ◄──reads/writes──  Bot mini-service (port 3003)
      │                                                                                │
      └──api/bot/status──► HTTP GET bot:3003/health                                      │
                                                                                         ▼
                                                                              Telegram API (long polling)
                                                                              z-ai-web-dev-sdk (LLM)
```

## Ports & boundaries

- **Bot → DB**: Prisma (same schema, same SQLite file). WAL mode allows concurrent reader (admin) + 1 writer (bot).
- **Admin → DB**: Prisma (read-mostly; writes only via API routes that respect domain rules — e.g. add crystals goes through the same `BillingService`).
- **Admin → Bot**: optional HTTP (`GET bot:3003/health`, `POST bot:3003/internal/broadcast` with a shared secret). Used for "bot status" widget and to trigger broadcasts from the web UI.

## What goes where (decision rule)

| Change type | Location |
|---|---|
| New Telegram command | `bot/src/presentation/commands/` |
| New FSM state | `bot/src/presentation/fsm/states.ts` + `bot/src/presentation/states/` |
| New inline keyboard | `bot/src/presentation/keyboards/` |
| New LLM generator | `bot/src/domain/prompts/` + `bot/src/application/use-cases/` |
| New DB table | `prisma/schema.prisma` → `db:push` → `bot/src/infrastructure/database/repositories/` |
| New domain rule | `bot/src/domain/entities/` or `value-objects/` |
| Admin dashboard widget | `src/components/admin/` + `src/app/api/` |
| Landing page section | `src/components/landing/` |
| Cron job | `bot/src/infrastructure/scheduler/CronScheduler.ts` |

## Gitignore (essential entries)

```
node_modules/
.next/
.env
db/*.db
db/*.db-wal
db/*.db-shm
research/          # reference repos, never deploy
*.log
```
