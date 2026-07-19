# Sofia Bot — Next.js Webhook + Admin Panel (Vercel-only)

Telegram bot **Sofia** (мистический таро/астрология компаньон) с админ-панелью.
Вся архитектура работает **только на Vercel** — бот и админка в одном Next.js приложении.

## Архитектура

```
┌─────────────────────────────────────────────────────────────┐
│  Telegram (@oracultetris_bot)                                │
│  ↓ webhook (POST to /api/telegram/webhook)                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Vercel (Next.js 16 serverless)                      │    │
│  │  - Admin Panel (9 tabs, /)                            │    │
│  │  - Webhook handler (/api/telegram/webhook)            │    │
│  │  - Bot logic in src/lib/bot/                          │    │
│  │  - Telegram API client (fetch, no SDK)                │    │
│  │  - OpenRouter AI for tarot interpretations            │    │
│  │  - All bot state in DB (PostgreSQL via Prisma)        │    │
│  └────────────────────┬────────────────────────────────┘    │
│                       │ PostgreSQL (Neon / Supabase)         │
│  ┌────────────────────┴────────────────────────────────┐    │
│  │  Database (Neon free tier, доступен из РФ)            │    │
│  │  - Users, Readings, Transactions, BotCommands         │    │
│  │  - BotHeartbeat (singleton, updated on each webhook)  │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## Почему webhook mode работает на Vercel

Vercel — serverless, каждый запрос живёт максимум 10-60 секунд. **Long polling**
в serverless не работает (процесс убивается между запросами), но **webhook mode** —
идеально подходит:

- Telegram отправляет **один POST-запрос** на каждое сообщение пользователя.
- Vercel serverless функция обрабатывает его за <3 секунды (обычно).
- Возвращает `200 OK` → Telegram счастлив, ждёт следующего сообщения.
- Не нужен постоянный процесс (в отличие от long polling).
- AI-интерпретации могут занимать 10-20 секунд на cold start → webhook endpoint
  имеет `maxDuration: 60` в `vercel.json`.

**Решение:** и бот (webhook), и админка — один Next.js деплой на Vercel. Общая
PostgreSQL (Neon, доступен из РФ) хранит состояние и очередь команд.

## Быстрый старт

### 1. База данных — Neon PostgreSQL (free, доступен из РФ)

1. Зарегистрируйся на https://neon.tech
2. Создай проект → получи connection string вида:
   ```
   postgresql://user:pass@ep-xxx.eu-central-1.aws.neon.tech/dbname?sslmode=require
   ```
3. Сохрани его — он нужен и для локального dev, и для Vercel.

### 2. Локальная разработка

```bash
git clone https://github.com/iossmetanin-web/sofiabotadminpanel.git
cd sofiabotadminpanel
bun install
cp .env.example .env
# Отредактируй .env (см. раздел «Переменные окружения» ниже)
# Поменяй provider в prisma/schema.prisma: sqlite → postgresql
bun run db:push
bun run dev  # http://localhost:3000
```

### 3. Деплой на Vercel

```bash
# 1. Подготовка
git clone https://github.com/iossmetanin-web/sofiabotadminpanel.git
cd sofiabotadminpanel
bun install

# 2. БД — Neon (доступен из РФ)
# Зарегистрируйся на https://neon.tech
# Создай проект → получи DATABASE_URL

# 3. Настрой .env
cp .env.example .env
# Отредактируй .env:
#   DATABASE_URL=postgresql://... (Neon)
#   BOT_TOKEN=8171475783:AAFCkLhxfwjUafqRPX0bqEYP6fciM84t7hk
#   ADMIN_IDS=987617664
#   OPENROUTER_API_KEY=sk-or-v1-...
#   WEBHOOK_URL=https://твой-vercel-url.vercel.app
#   BOT_USERNAME=oracultetris_bot

# 4. Поменяй provider в prisma/schema.prisma: sqlite → postgresql

# 5. Примени схему к БД
bun run db:push

# 6. Деплой на Vercel
# - Vercel.com → New Project → Import from GitHub
# - Set env vars (DATABASE_URL, BOT_TOKEN, ADMIN_IDS, OPENROUTER_API_KEY, WEBHOOK_URL, BOT_USERNAME)
# - Deploy
# - После деплоя: WEBHOOK_URL = твой Vercel URL (например https://sofiabotadminpanel.vercel.app)

# 7. Установи webhook в Telegram
# После деплоя открой:
# https://твой-vercel-url.vercel.app/api/telegram/setup
# Это вызовет Telegram setWebhook API + зарегистрирует команды в BotFather

# 8. Проверь
# - Открой админку: https://твой-vercel-url.vercel.app
# - Вкладка "Обзор" → бот должен показать "Онлайн"
# - Напиши боту в Telegram /start → должна начаться онбординг
```

### 4. Проверка после деплоя

1. Открой админку на Vercel → вкладка **«Обзор»** → бот должен показать
   **«Онлайн»** (heartbeat обновляется при каждом входящем webhook).
2. Напиши боту в Telegram `/start` → должна начаться онбординг.
3. В админке → **«Управление»** → отправь команду «Gift crystals» → бот
   обработает её при следующем webhook-цикле (обычно мгновенно, когда
   пользователь пишет следующее сообщение, либо из фонового апдейта).

## Переменные окружения

Все переменные задаются в Vercel → Settings → Environment Variables.

| Переменная | Описание |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (Neon). Локально можно `file:./db/custom.db` (SQLite) для dev. |
| `BOT_TOKEN` | Telegram bot token от @BotFather |
| `BOT_USERNAME` | Username бота без `@` (например `oracultetris_bot`) |
| `ADMIN_IDS` | Telegram user IDs администраторов (через запятую) |
| `WEBHOOK_URL` | Публичный URL твоего Vercel деплоя (например `https://sofiabotadminpanel.vercel.app`) |
| `TELEGRAM_WEBHOOK_SECRET` | (опц.) секрет для проверки заголовка `X-Telegram-Bot-Api-Secret-Token` |
| `OPENROUTER_API_KEY` | API key для AI интерпретаций (OpenRouter) |
| `ADMIN_PASSWORD` | (опц.) пароль для защиты админ-панели |

См. `.env.example` — готовый шаблон.

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

Админка → вкладка **«Управление»**:
- **Direct Message** — отправить сообщение конкретному пользователю
- **Gift Crystals** — начислить кристаллы
- **Ban / Unban** — заблокировать/разблокировать пользователя
- **Reload Config** — перезагрузить конфигурацию бота
- **Shutdown** — корректно остановить обработку команд
- **Broadcast** (вкладка **«Рассылки»**) — массовая рассылка всем пользователям

Команды попадают в таблицу `BotCommand` и обрабатываются серверной частью
при обработке webhook-ов (а также при фоновых тиках).

## Стек

- **App**: Next.js 16 (App Router), TypeScript, Tailwind CSS 4, shadcn/ui
- **ORM**: Prisma (PostgreSQL на Vercel, SQLite для локального dev)
- **Бот**: встроенный в Next.js — webhook на `/api/telegram/webhook`,
  Telegram Bot API через `fetch` (без SDK)
- **БД**: PostgreSQL (Neon free tier, доступен из РФ)
- **AI**: OpenRouter API (модель: `google/gemini-2.0-flash-exp:free`)
- **Деплой**: **только Vercel** (serverless functions)

## Структура репозитория

```
.
├── prisma/schema.prisma              # Общая схема БД (sqlite локально, postgresql на Vercel)
├── src/
│   ├── app/
│   │   ├── page.tsx                  # Админ-панель (9 вкладок)
│   │   ├── api/
│   │   │   ├── telegram/webhook/     # ← Webhook endpoint (Telegram → сюда)
│   │   │   ├── telegram/setup/       # ← Установка webhook + команд
│   │   │   ├── telegram/status/      # ← Проверка webhook
│   │   │   ├── bot/status/           # ← Статус бота (для админки)
│   │   │   ├── bot/command/          # ← Очередь команд (админ → бот)
│   │   │   ├── broadcasts/           # ← Рассылки
│   │   │   ├── users/                # ← Пользователи
│   │   │   ├── readings/             # ← Расклады
│   │   │   └── ...                   # ← Другие API
│   │   └── layout.tsx
│   ├── lib/
│   │   ├── db.ts                     # Prisma client
│   │   └── bot/                      # ← Логика бота (TypeScript)
│   │       ├── telegram.ts           # ← Telegram API client (fetch)
│   │       ├── types.ts
│   │       ├── handlers/             # ← 10 command handlers
│   │       ├── services/             # ← tarot, zodiac, ai, crystals, memory
│   │       ├── i18n/                 # ← RU/EN
│   │       └── keyboards.ts
│   └── components/                   # shadcn/ui + кастомные
├── vercel.json
└── README.md
```

## Лицензия

Private — собственность владельца Sofia Bot.
