# Sofia Bot Admin Panel

Control center for the **Sofia** Telegram tarot bot (`@oracultetris_bot`). Built with Next.js 16, TypeScript, Tailwind CSS 4, and a heavily-customized shadcn/ui kit, designed according to the [taste-skill](https://github.com/Leonxlnx/taste-skill) anti-slop frontend directives.

## Stack

- **Framework:** Next.js 16 (App Router, standalone output)
- **Language:** TypeScript 5
- **Styling:** Tailwind CSS 4 + shadcn/ui (New York)
- **Fonts:** Geist + Geist Mono (via `next/font`)
- **ORM:** Prisma (SQLite for local dev)
- **Icons:** lucide-react (strokeWidth 1.5)
- **Motion:** framer-motion (reduced-motion aware)

## Design language

- **Dials:** VARIANCE 6 / MOTION 5 / DENSITY 7
- **Palette:** charcoal `zinc-950` base, single antique-amber accent, off-white text. No AI-purple, no warm-beige-brass.
- **Layout:** asymmetric bento overview, hairline data tables, mono tabular numerals, sticky single-line nav, sticky footer.
- **States:** skeleton loaders (shaped to final layout), composed empty states, inline error states, tactile button feedback.
- **Pre-Flight:** zero em-dashes, single accent lock, Geist-only fonts.

## Features (8 tabs)

1. **Обзор** - asymmetric bento KPIs, 14-day activity sparkline, readings-by-type, funnel, zodiac wheel, top referrals
2. **Пользователи** - searchable paginated table, block/unblock, gift crystals, reset onboarding
3. **Расклады** - expandable tarot reading cards with full interpretation
4. **Серии** - streak leaderboard, distribution buckets, 14-day DAU chart
5. **Экономика** - crystal flow, type breakdown, filterable transactions ledger
6. **Дайджест** - weekly digest preview (new users, active, messages, readings, top users)
7. **Рассылки** - broadcast composer with character counter + send history
8. **Настройки** - bot config key/value editor with save indicators

Plus: live bot-status polling (30s), CSV export (users/readings/transactions), sonner toasts.

## Local development

```bash
bun install
bun run db:push    # create SQLite schema
bun run dev        # http://localhost:3000
```

## Environment

Copy `.env.example` to `.env` and fill in:

```
DATABASE_URL=file:./db/custom.db
```

The admin panel reads from the same database the Sofia bot writes to. For production (Vercel), use a hosted Postgres (Neon, Supabase) by switching the Prisma `datasource` provider to `postgresql` and pointing `DATABASE_URL` at the connection string.

## Project structure

```
src/
  app/
    api/            # 11 route handlers (stats, users, readings, ...)
    globals.css     # theme tokens, amber accent, hairline scrollbar
    layout.tsx      # Geist fonts, dark theme, metadata
    page.tsx        # the admin panel (8 tabs)
  components/
    ui/             # shadcn/ui primitives
    sofia/          # AdminKit, Sparkline, ZodiacWheel
  lib/
    db.ts           # Prisma client
prisma/
  schema.prisma     # User, Conversation, Reading, Transaction, Broadcast, ...
```

## License

Private project.
