import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const hb = await db.botConfig.findUnique({ where: { id: 'heartbeat' } });
    if (!hb || !hb.value) {
      return NextResponse.json({ ok: false, error: 'нет данных', username: 'oracultetris_bot' });
    }
    const ageMs = Date.now() - new Date(hb.value).getTime();
    const ok = ageMs < 60_000; // heartbeat within last 60s
    return NextResponse.json({
      ok,
      username: 'oracultetris_bot',
      lastHeartbeat: hb.value,
      ageSeconds: Math.floor(ageMs / 1000),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[bot/status] db unavailable:', msg.slice(0, 160));
    return NextResponse.json({ ok: false, error: 'база недоступна', username: 'oracultetris_bot' });
  }
}
