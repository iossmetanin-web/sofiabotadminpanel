import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Bot settings — read/write BotConfig rows.
// GET: list all config entries.
// PATCH: update one or more config entries by key.
export async function GET() {
  try {
    const configs = await db.botConfig.findMany({
      orderBy: { key: 'asc' },
    });
    return NextResponse.json({
      settings: configs.map((c) => ({
        id: c.id,
        key: c.key,
        value: c.value,
        updatedAt: c.updatedAt,
      })),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[settings] db unavailable:', msg.slice(0, 160));
    return NextResponse.json({ settings: [] });
  }
}

export async function PATCH(req: NextRequest) {
  const { key, value } = await req.json();
  if (!key || typeof key !== 'string' || typeof value !== 'string') {
    return NextResponse.json({ error: 'key and value (strings) required' }, { status: 400 });
  }
  try {
    const updated = await db.botConfig.upsert({
      where: { key },
      update: { value },
      create: { id: `cfg_${key}`, key, value },
    });
    return NextResponse.json({ ok: true, setting: updated });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `failed to update: ${msg}` }, { status: 500 });
  }
}
