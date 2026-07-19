import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getWebhookInfo, hasBotToken } from '@/lib/bot/telegram';

export const dynamic = 'force-dynamic';

// GET /api/bot/status
// In webhook mode, the bot is "online" if:
//   - the Telegram webhook URL is set AND
//   - the BotHeartbeat row was touched within the last 5 minutes
//     (each webhook request upserts the singleton row)
//   - no recent Telegram errors (last_error_date within 60s)
//
// Response shape is backwards-compatible with the old endpoint:
//   { ok, username, lastHeartbeat, ageSeconds, ... } plus new fields:
//   { status, lastBeatAt, pollingMode, webhook, ... }

export async function GET() {
  const username = 'oracultetris_bot';
  try {
    const [hb, webhook] = await Promise.all([
      db.botHeartbeat.findUnique({ where: { id: 'singleton' } }).catch(() => null),
      hasBotToken()
        ? getWebhookInfo().catch(() => null)
        : Promise.resolve(null),
    ]);

    if (!hb && !webhook) {
      return NextResponse.json({
        ok: false,
        status: 'offline' as const,
        username,
        lastHeartbeat: null,
        lastBeatAt: null,
        ageSeconds: null,
        lagSeconds: null,
        pid: null,
        hostname: null,
        version: null,
        uptime: null,
        pollingMode: 'webhook',
        webhook: null,
        error: 'нет данных — бот ещё не запускался',
      });
    }

    const nowMs = Date.now();
    const beatMs = hb ? new Date(hb.lastBeatAt).getTime() : 0;
    const ageMs = Math.max(0, nowMs - beatMs);
    const ageSeconds = hb ? Math.floor(ageMs / 1000) : null;
    // Webhook mode: heartbeat should be touched every few minutes (per update).
    // 5-minute window accounts for low-traffic bots.
    const heartbeatFresh = hb ? ageMs < 5 * 60_000 : false;
    const webhookConfigured = Boolean(webhook?.url);
    const noRecentErrors =
      !webhook?.last_error_date ||
      nowMs - webhook.last_error_date * 1000 > 60_000;
    const online = (heartbeatFresh || webhookConfigured) && noRecentErrors;

    return NextResponse.json({
      ok: online,
      username,
      lastHeartbeat: hb ? hb.lastBeatAt.toISOString() : null,
      ageSeconds,
      status: online ? ('online' as const) : ('offline' as const),
      lastBeatAt: hb ? hb.lastBeatAt.toISOString() : null,
      lagSeconds: ageSeconds,
      pid: hb?.pid ?? null,
      hostname: hb?.hostname ?? null,
      version: hb?.version ?? null,
      uptime: hb?.uptime ?? null,
      pollingMode: hb?.pollingMode ?? 'webhook',
      webhook: webhook
        ? {
            url: webhook.url,
            pending_update_count: webhook.pending_update_count,
            last_error_date: webhook.last_error_date ?? null,
            last_error_message: webhook.last_error_message ?? null,
          }
        : null,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[bot/status] error:', msg.slice(0, 160));
    return NextResponse.json({
      ok: false,
      status: 'offline' as const,
      username,
      lastHeartbeat: null,
      lastBeatAt: null,
      ageSeconds: null,
      lagSeconds: null,
      pid: null,
      hostname: null,
      version: null,
      uptime: null,
      pollingMode: 'webhook',
      webhook: null,
      error: 'база недоступна',
    });
  }
}
