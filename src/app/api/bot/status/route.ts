import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/bot/status
// Reads the singleton BotHeartbeat row written by the Python bot every 15-30s.
// Bot is considered ONLINE if lastBeatAt is within the last 60 seconds.
// Response shape is backwards-compatible with the old endpoint:
//   { ok, username, lastHeartbeat, ageSeconds, ... } plus new fields:
//   { status, lastBeatAt, pid, hostname, version, uptime, pollingMode, lagSeconds }
export async function GET() {
  try {
    const hb = await db.botHeartbeat.findUnique({ where: { id: 'singleton' } });

    if (!hb) {
      return NextResponse.json({
        ok: false,
        status: 'offline' as const,
        username: 'oracultetris_bot',
        lastHeartbeat: null,
        lastBeatAt: null,
        ageSeconds: null,
        lagSeconds: null,
        pid: null,
        hostname: null,
        version: null,
        uptime: null,
        pollingMode: 'long_polling',
        error: 'нет данных — бот ещё не запускался',
      });
    }

    const nowMs = Date.now();
    const beatMs = new Date(hb.lastBeatAt).getTime();
    const ageMs = Math.max(0, nowMs - beatMs);
    const ageSeconds = Math.floor(ageMs / 1000);
    const online = ageMs < 60_000; // heartbeat fresh within 60s

    return NextResponse.json({
      // Backwards-compatible fields
      ok: online,
      username: 'oracultetris_bot',
      lastHeartbeat: hb.lastBeatAt.toISOString(),
      ageSeconds,
      // New fields
      status: online ? ('online' as const) : ('offline' as const),
      lastBeatAt: hb.lastBeatAt.toISOString(),
      lagSeconds: ageSeconds,
      pid: hb.pid ?? null,
      hostname: hb.hostname ?? null,
      version: hb.version ?? null,
      uptime: hb.uptime ?? null,
      pollingMode: hb.pollingMode ?? 'long_polling',
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[bot/status] db unavailable:', msg.slice(0, 160));
    return NextResponse.json({
      ok: false,
      status: 'offline' as const,
      username: 'oracultetris_bot',
      lastHeartbeat: null,
      lastBeatAt: null,
      ageSeconds: null,
      lagSeconds: null,
      pid: null,
      hostname: null,
      version: null,
      uptime: null,
      pollingMode: 'long_polling',
      error: 'база недоступна',
    });
  }
}
