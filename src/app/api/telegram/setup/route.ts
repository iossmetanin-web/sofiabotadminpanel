// /api/telegram/setup — register the webhook URL + bot commands with Telegram.
//
// POST /api/telegram/setup
// Body: { webhookUrl?: string, secret?: string, adminPassword?: string }
// If `webhookUrl` is not provided, uses WEBHOOK_URL env or `https://{host}` from headers.
//
// Protected by ADMIN_PASSWORD env (if set).

import { NextRequest, NextResponse } from 'next/server';
import {
  setMyCommands,
  setWebhook,
  getMe,
  type TelegramBotCommand,
} from '@/lib/bot/telegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const COMMANDS: TelegramBotCommand[] = [
  { command: 'start', description: 'Познакомиться или начать заново' },
  { command: 'help', description: 'Подсказка по командам' },
  { command: 'daily', description: 'Карта дня (бесплатно, раз в сутки)' },
  { command: 'readings', description: 'Меню раскладов' },
  { command: 'profile', description: 'Твой профиль' },
  { command: 'memory', description: 'Что София помнит о тебе' },
  { command: 'referral', description: 'Пригласить друга' },
  { command: 'subscription', description: 'Подписка' },
  { command: 'admin', description: 'Админ-панель (только для админа)' },
  { command: 'cancel', description: 'Отменить текущее действие' },
];

export async function POST(req: NextRequest) {
  // Auth check.
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (adminPassword) {
    let body: { adminPassword?: string } | null = null;
    try {
      body = await req.json();
    } catch {
      body = null;
    }
    if (body?.adminPassword !== adminPassword) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }
  }

  let webhookUrl = process.env.WEBHOOK_URL;
  let secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  try {
    const body = await req.json().catch(() => ({}));
    if (body?.webhookUrl) webhookUrl = body.webhookUrl;
    if (body?.secret !== undefined) secret = body.secret;
  } catch {
    /* ignore body parse errors */
  }

  if (!webhookUrl) {
    // Try to derive from request headers (works for Vercel preview/prod).
    const proto = req.headers.get('x-forwarded-proto') ?? 'https';
    const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
    if (host) webhookUrl = `${proto}://${host}`;
  }
  if (!webhookUrl) {
    return NextResponse.json(
      { ok: false, error: 'WEBHOOK_URL is not set and could not be derived from headers' },
      { status: 400 },
    );
  }
  const fullUrl = `${webhookUrl.replace(/\/$/, '')}/api/telegram/webhook`;

  try {
    const me = await getMe();
    await setWebhook(fullUrl, secret ? { secret_token: secret } : undefined);
    await setMyCommands(COMMANDS);
    return NextResponse.json({
      ok: true,
      webhookUrl: fullUrl,
      bot: me.username,
      commandsCount: COMMANDS.length,
      commands: COMMANDS,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { ok: false, error: msg },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    usage: 'POST with optional { webhookUrl?, secret?, adminPassword? }',
    commands: COMMANDS,
  });
}
