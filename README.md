# Sofia Bot — Admin Panel + Python Bot

Telegram bot **Sofia** (мистический таро/астрология компаньон) с админ-панелью.

## Архитектура

```
┌─────────────────────────────────────────────────────────────┐
│  Telegram (@oracultetris_bot)                                │
│  ↓ long polling (aiogram 3.x)                                │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Python Bot (python-bot/)                            │    │
│  │  - Deployed to Render/Fly.io/Railway (long-running)  │    │
│  │  - aiogram 3.x, long polling (NOT webhooks)          │    │
│  │  - 10 commands, onboarding FSM, 7 reading types      │    │
│  │  - Crystal economy, referrals, subscriptions         │    │
│  │  - OpenRouter AI for interpretations                 │    │
│  │  - Heartbeat every 20s → BotHeartbeat table          │    │
│  │  - Polls BotCommand table every 2s for admin cmds    │    │
│  └────────────────────┬────────────────────────────────┘    │
│                       │ shared PostgreSQL (Neon free tier)   │
│  ┌────────────────────┴────────────────────────────────┐    │
│  │  Next.js Admin Panel (src/)                          │    │
│  │  - Deployed to Vercel (serverless)                   │    │
│  │  - 9 tabs: Обзор/Пользователи/Расклады/Серии/         │    │
│  │    Экономика/Дайджест/Рассылки/Управление            │    │
│  │  - Controls bot via BotCommand queue                 │    │
│  │  - Reads bot status from BotHeartbeat table          │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## Почему бот НЕ на Vercel

Vercel — serverless. Каждый запрос живёт максимум 10-60 секунд. Telegram long polling держит соединение открытым минутами. Serverless убивает процесс → бот умирает.

**Решение:** бот деплоится на long-running host (Render/Fly.io/Railway), админка — на Vercel. Они общаются через общую PostgreSQL базу.

## Быстрый старт

### 1. База данных (Neon PostgreSQL — free)

1. Зарегистрируйся на https://neon.tech
2. Создай проект → получи connection string вида:
   ```
   postgresql://user:pass@ep-xxx.eu-central-1.aws.neon.tech/dbname?sslmode=require
   ```
3. Сохрани его — он нужен и для админки, и для бота.

### 2. Админ-панель → Vercel

```bash
# Локально
bun install
# В prisma/schema.prisma: provider = "postgresql"
# В .env: DATABASE_URL=postgresql://... (твой Neon URL)
bun run db:push
bun run dev  # http://localhost:3000
```

**Деплой на Vercel:**
1. Push этого репозитория в GitHub
2. Vercel.com → New Project → Import from GitHub
3. Environment Variables:
   - `DATABASE_URL` = твой Neon PostgreSQL URL
4. Deploy
5. В Vercel settings → `prisma/schema.prisma`: поменяй `provider = "sqlite"` → `provider = "postgresql"`
6. Redeploy

### 3. Python бот → Render

```bash
cd python-bot/
cp .env.example .env
# Отредактируй .env:
#   BOT_TOKEN=8171475783:AAFCkLhxfwjUafqRPX0bqEYP6fciM84t7hk
#   ADMIN_IDS=987617664
#   DATABASE_URL=postgresql://... (тот же Neon URL, что у админки)
#   OPENROUTER_API_KEY=sk-or-v1-...
```

**Деплой на Render.com (бесплатно):**
1. Push папку `python-bot/` в отдельный GitHub репозиторий (или используй monorepo)
2. Render.com → New → Web Service (или Background Worker)
3. Connect GitHub repo
4. Render автоматически использует `render.yaml`
5. Environment Variables (если не через render.yaml):
   - `BOT_TOKEN`
   - `ADMIN_IDS`
   - `DATABASE_URL`
   - `OPENROUTER_API_KEY`
6. Deploy

**Альтернатива — Fly.io:**
```bash
cd python-bot/
fly launch  # использует Dockerfile
fly deploy
```

**Альтернатива — Railway:**
1. Railway.app → New Project → Deploy from GitHub repo
2. Set env vars
3. Railway автоматически detected Python

### 4. Проверка

После деплоя:
1. Открой админку на Vercel → вкладка "Обзор" → бот должен показать "Онлайн" (heartbeat в течение 60s)
2. Напиши боту в Telegram `/start` → должна начаться онбординг
3. В админке → "Управление" → отправь команду "Gift crystals" → бот выполнит в течение 2s

## Переменные окружения

### Админ-панель (Vercel)
| Переменная | Описание |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (Neon) |
| `ADMIN_PASSWORD` | (опц.) пароль для защиты админки |

### Python бот (Render)
| Переменная | Описание |
|---|---|
| `BOT_TOKEN` | Telegram bot token от @BotFather |
| `ADMIN_IDS` | Telegram user IDs администраторов (через запятую) |
| `DATABASE_URL` | PostgreSQL connection string (Neon) — тот же, что у админки |
| `OPENROUTER_API_KEY` | API key для AI интерпретаций |
| `LOG_LEVEL` | `INFO` (по умолчанию) |

## Команды бота

| Команда | Описание |
|---|---|
| `/start` | Приветствие + онбординг |
| `/help` | Помощь |
| `/daily` | Карта дня (бесплатно, 1/день) |
| `/readings` | 7 типов раскладов (за кристаллы) |
| `/profile` | Профиль + баланс кристаллов |
| `/referral` | Реферальная программа |
| `/memory` | Что София помнит о тебе |
| `/subscription` | Подписка (недельная/месячная) |
| `/admin` | Админ-панель (только для админов) |
| `/cancel` | Отменить текущее действие |

## Управление ботом из админки

Админка → вкладка "Управление":
- **Direct Message** — отправить сообщение конкретному пользователю
- **Gift Crystals** — начислить кристаллы
- **Ban / Unban** — заблокировать/разблокировать пользователя
- **Reload Config** — перезагрузить конфигурацию бота
- **Shutdown** — корректно остановить бота
- **Broadcast** (вкладка "Рассылки") — массовая рассылка всем пользователям

Команды попадают в таблицу `BotCommand`, бот опрашивает её каждые 2 секунды.

## Стек

- **Админ-панель**: Next.js 16, TypeScript, Tailwind CSS 4, shadcn/ui, Prisma ORM
- **Бот**: Python 3.12, aiogram 3.x, asyncpg, Pydantic v2
- **БД**: PostgreSQL (Neon free tier) — общая для админки и бота
- **AI**: OpenRouter API (модель: google/gemini-2.0-flash-exp:free)
- **Деплой**: Vercel (админка) + Render (бот)

## Структура репозитория

```
.
├── prisma/schema.prisma          # Общая схема БД
├── src/                          # Next.js админ-панель
│   ├── app/page.tsx              # Главная страница (9 вкладок)
│   ├── app/api/                  # API routes
│   └── components/               # shadcn/ui + кастомные
├── python-bot/                   # Python Telegram бот (aiogram)
│   ├── app/
│   │   ├── main.py               # Entry point (long polling)
│   │   ├── handlers/             # 8 обработчиков команд
│   │   ├── services/             # Бизнес-логика
│   │   └── i18n/                 # RU/EN
│   ├── Dockerfile                # Для Fly.io
│   ├── render.yaml               # Для Render.com
│   └── requirements.txt
└── vercel.json                   # Конфиг Vercel для админки
```

## Лицензия

Private — собственность владельца Sofia Bot.
