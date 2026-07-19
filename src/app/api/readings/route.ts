import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(50, parseInt(searchParams.get('limit') ?? '20', 10));

    const readings = await db.reading.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: { select: { name: true, username: true, firstName: true, telegramId: true, zodiacSign: true } },
      },
    });

    return NextResponse.json({ readings });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[readings] db unavailable:', msg.slice(0, 160));
    return NextResponse.json({ readings: [] });
  }
}
