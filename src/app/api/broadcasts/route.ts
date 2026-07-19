import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const broadcasts = await db.broadcast.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  return NextResponse.json({ broadcasts });
}

export async function POST(req: NextRequest) {
  const { text } = await req.json();
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return NextResponse.json({ error: 'text required' }, { status: 400 });
  }
  try {
    // Outbox pattern: write a pending broadcast row; the bot polls & sends it.
    const total = await db.user.count({ where: { isBlocked: false, onboardingCompleted: true } });
    const broadcast = await db.broadcast.create({
      data: {
        adminId: 'web-admin',
        text: text.slice(0, 4000),
        total,
        status: 'pending',
      },
    });
    return NextResponse.json({ ok: true, id: broadcast.id, total, status: 'pending' });
  } catch (e: any) {
    return NextResponse.json({ error: `failed to enqueue: ${e.message}` }, { status: 500 });
  }
}
