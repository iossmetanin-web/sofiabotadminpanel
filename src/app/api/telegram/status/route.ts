// /api/telegram/status — get webhook info from Telegram.

import { NextResponse } from 'next/server';
import { getWebhookInfo, getMe, hasBotToken } from '@/lib/bot/telegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 15;

export async function GET() {
  if (!hasBotToken()) {
    return NextResponse.json(
      { ok: false, error: 'BOT_TOKEN is not configured' },
      { status: 500 },
    );
  }
  try {
    const [info, me] = await Promise.all([getWebhookInfo(), getMe().catch(() => null)]);
    return NextResponse.json({
      ok: true,
      bot: me ? { username: me.username, id: me.id } : null,
      webhook: {
        url: info.url,
        pending_update_count: info.pending_update_count,
        last_error_date: info.last_error_date ?? null,
        last_error_message: info.last_error_message ?? null,
        max_connections: info.max_connections ?? null,
        has_custom_certificate: info.has_custom_certificate,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { ok: false, error: msg },
      { status: 502 },
    );
  }
}
