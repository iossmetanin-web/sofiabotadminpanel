# Sofia Bot (Python / aiogram 3.x)

A mystical tarot & astrology companion Telegram bot — **Sofia**, the wise
Siberian keeper. Ported back to Python (the original language) after a brief
and regrettable detour into TypeScript/grammY.

The bot uses **long polling** (NOT webhooks) so it can run on any long-lived
worker host — Render, Fly.io, Railway, a VPS, anything. It must NOT be deployed
to Vercel serverless (which can't hold a long-polling connection).

The Next.js admin panel (separate repo, deployed to Vercel) shares the same
PostgreSQL database. The admin panel writes commands to a `BotCommand` table;
this Python bot polls that table every 2 seconds and executes them.

---

## Features

- **10 commands** (registered in @BotFather):
  `/start`, `/help`, `/daily`, `/readings`, `/profile`, `/referral`,
  `/memory`, `/subscription`, `/admin`, `/cancel`
- **Onboarding FSM**: name → birthDate → birthTime → birthPlace → gender →
  ageGroup → zodiac auto-calculated
- **78-card tarot deck** (Major + Minor Arcana), reversed cards, 7 reading types:
  `fate_card`, `tarot_small`, `tarot_full`, `tarot_love`, `tarot_career`,
  `tarot_decision`, `horoscope`
- **Crystal economy**: new users get 3 💎, daily bonus, referral rewards,
  subscription tiers (weekly / monthly)
- **Memory system**: stores facts + emotional context about each user,
  used to personalise LLM interpretations
- **i18n**: Russian (default) + English, auto-detected from user record
- **Heartbeat**: every 20s updates `BotHeartbeat` singleton row → admin panel
  shows bot online/offline status
- **Command queue**: polls `BotCommand` every 2s → executes admin commands
  (broadcast, dm, ban, unban, gift crystals, set subscription, reload config,
  shutdown)
- **LLM integration**: OpenRouter API (`google/gemini-2.0-flash-exp:free`),
  Sofia persona (mystical, warm, insightful, speaks Russian by default)
- **Referral program**: +1 💎 for the referrer when a referee completes onboarding
- **Graceful shutdown**: handles SIGTERM / SIGINT, drains tasks cleanly

---

## Local development (SQLite)

1. **Install Python 3.12+** and create a virtualenv:
    ```bash
    cd python-bot
    python3.12 -m venv .venv
    source .venv/bin/activate
    pip install -r requirements.txt
    ```

2. **Copy and edit env**:
    ```bash
    cp .env.example .env
    # edit .env — leave DATABASE_URL=file:./db/custom.db for local SQLite
    ```

3. **Initialise the schema** — the bot uses the same Prisma schema as the
   Next.js admin panel. Run `npx prisma db push` from the **project root**
   (where `prisma/schema.prisma` lives) to create tables. The bot will also
   auto-create the SQLite schema on first run if the file is empty.

4. **Run**:
    ```bash
    ./start.sh
    # or
    python -m app.main
    ```

5. Open Telegram → talk to `@oracultetris_bot` → `/start`.

---

## Production deployment

The bot is a **worker process** (long polling). It needs a host that allows
long-running connections — NOT serverless.

### Render.com (recommended — free tier)

`render.yaml` is included. Either:

- **Blueprint deploy**: push this repo to GitHub → New → Blueprint → pick the
  repo → Render will read `render.yaml` and create the worker automatically.
- **Manual**: New → Background Worker → Python → set build command
  `pip install -r requirements.txt` and start command `python -m app.main`.

Set environment variables in the Render dashboard:
`BOT_TOKEN`, `DATABASE_URL` (Postgres), `ADMIN_IDS`, `OPENROUTER_API_KEY`,
`LOG_LEVEL`.

### Fly.io

`Dockerfile` is included.

```bash
fly launch --no-deploy
fly secrets set BOT_TOKEN=... DATABASE_URL=... ADMIN_IDS=... OPENROUTER_API_KEY=...
fly deploy
fly scale count 1    # long polling — only 1 instance
```

### Railway

1. New project → Deploy from GitHub repo → pick this folder.
2. Set the start command to `python -m app.main`.
3. Add the env vars in Railway's dashboard.
4. Add a Postgres plugin (or use an external Neon DB) and copy its connection
   string to `DATABASE_URL`.

### Vercel — **DO NOT USE** for the bot

Vercel serverless functions can't hold a long-polling connection. The Next.js
admin panel CAN live on Vercel; the bot CANNOT.

---

## Environment variables

| Variable              | Required | Description                                            |
| --------------------- | -------- | ------------------------------------------------------ |
| `BOT_TOKEN`           | yes      | Telegram bot token from @BotFather                     |
| `DATABASE_URL`        | yes      | `postgresql://...` for prod, `file:./db/custom.db` dev |
| `ADMIN_IDS`           | yes      | Comma-separated Telegram user IDs                      |
| `OPENROUTER_API_KEY`  | yes      | OpenRouter API key                                     |
| `LOG_LEVEL`           | no       | DEBUG / INFO / WARNING / ERROR (default INFO)          |
| `OPENROUTER_MODEL`    | no       | Override model (default `google/gemini-2.0-flash-exp:free`) |

---

## Database setup (shared with admin panel)

Use a hosted PostgreSQL free tier — **Neon** is recommended
(<https://neon.tech>) because it supports serverless Postgres with branching.

1. Create a Neon project → copy the connection string.
2. Set `DATABASE_URL` to that string in **both**:
   - the Next.js admin panel (Vercel env vars)
   - this Python bot (Render/Fly env vars)
3. Run Prisma migrations once (from the project root):
    ```bash
    npx prisma migrate deploy
    npx prisma db push   # if no migrations exist yet
    ```
4. Both services now read/write the same DB.

---

## How the admin panel controls the bot

The admin panel (Next.js / Vercel) is serverless and can't hold a long-polling
connection. Instead, it inserts rows into the `BotCommand` table:

```sql
INSERT INTO "BotCommand" (id, type, payload, status, "createdAt")
VALUES (cuid(), 'broadcast', '{"text":"Hello from Sofia 👋"}', 'pending', now());
```

This Python bot polls `BotCommand` every 2 seconds for `status='pending'`
rows, marks them `processing`, executes them, then marks `done` or `failed`
with a JSON `result`.

Supported command types:

| type               | payload                                                  |
| ------------------ | -------------------------------------------------------- |
| `broadcast`        | `{"text": "..."}`                                        |
| `dm`               | `{"telegramId": "123", "text": "..."}`                   |
| `ban`              | `{"telegramId": "123"}`                                  |
| `unban`            | `{"telegramId": "123"}`                                  |
| `gift_crystals`    | `{"telegramId": "123", "amount": 5}`                     |
| `set_subscription` | `{"telegramId": "123", "type": "monthly", "days": 30}`   |
| `reload_config`    | `{}`                                                     |
| `shutdown`         | `{}` (admin-only, triggers graceful shutdown)            |

The admin panel reads `BotHeartbeat.lastBeatAt` to display online/offline status.
If `lastBeatAt` is older than ~60 seconds, the bot is considered offline.

---

## Architecture

```
python-bot/
├── app/
│   ├── main.py              # Entry — starts aiogram bot + heartbeat + command queue
│   ├── config.py            # Loads env vars (pydantic-settings style)
│   ├── db.py                # asyncpg (Postgres) + aiosqlite (local) — same API
│   ├── models.py            # Pydantic v2 models matching Prisma schema
│   ├── handlers/            # Command handlers (start, daily, readings, ...)
│   ├── services/            # Domain logic (tarot, zodiac, ai, crystals, memory, queue)
│   ├── keyboards/           # Inline keyboard builders
│   ├── i18n/                # ru.py + en.py translation packs
│   └── utils/               # Heartbeat + structured logger
├── requirements.txt
├── Dockerfile               # Fly.io / container deployments
├── render.yaml              # Render.com blueprint
├── start.sh                 # Local dev launcher
└── .env.example
```

Design principles: DRY, KISS, SOLID. Async throughout (aiogram 3.x).
Type hints everywhere. Pydantic v2 for data models. No ORM — asyncpg /
aiosqlite only. Structured logging. Graceful shutdown on SIGTERM/SIGINT.

---

## Logging

Structured JSON logs to stdout. Render / Fly / Railway capture stdout
automatically. Set `LOG_LEVEL=DEBUG` for verbose output during development.

---

## Notes

- The bot generates `cuid()`-compatible IDs (using the `cuid` Python lib) for
  consistency with the Prisma schema.
- Bot username: **@oracultetris_bot**
- For local dev, the bot will auto-create the SQLite schema on first run if
  the file is empty. For Postgres, run Prisma migrations.
- Do NOT scale the bot beyond 1 instance — long polling means only one
  instance should consume updates.
