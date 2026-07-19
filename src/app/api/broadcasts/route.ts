import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

// ───────────────────────────────────────────────────────────────────────
// /api/broadcasts
//
// GET  — list recent broadcasts with current status (read from Broadcast table;
//        the Python bot updates sentCount/failedCount/status as it processes).
//
// POST — create a pending Broadcast row + enqueue a BotCommand(type="broadcast")
//        so the Python bot picks it up on its next poll cycle (~2s). The bot
//        then sends the messages and updates the Broadcast row in-place.
//
// We do NOT send messages directly from Vercel — the Telegram Bot API calls
// must come from the long-running Python process on Render.
// ───────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const broadcasts = await db.broadcast.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return NextResponse.json({
      broadcasts: broadcasts.map((b) => ({
        id: b.id,
        adminId: b.adminId,
        text: b.text,
        sentCount: b.sentCount,
        failedCount: b.failedCount,
        total: b.total,
        status: b.status,
        createdAt: b.createdAt,
      })),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[broadcasts] db unavailable:', msg.slice(0, 160));
    return NextResponse.json({ broadcasts: [] });
  }
}

export async function POST(req: NextRequest) {
  let text: unknown;
  try {
    const body = await req.json();
    text = body?.text;
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  if (typeof text !== 'string' || text.trim().length === 0) {
    return NextResponse.json({ error: 'text required' }, { status: 400 });
  }
  if (text.length > 4096) {
    return NextResponse.json({ error: 'text too long (max 4096)' }, { status: 400 });
  }

  try {
    // Compute recipient count for the broadcast preview.
    const total = await db.user.count({
      where: { isBlocked: false, onboardingCompleted: true },
    });

    // Create the Broadcast row + enqueue the BotCommand atomically.
    // The Python bot reads the broadcast payload (which references the
    // broadcastId), fetches the Broadcast row to track progress, sends
    // messages in batches, and updates sentCount/failedCount/status.
    const result = await db.$transaction(async (tx) => {
      const broadcast = await tx.broadcast.create({
        data: {
          adminId: 'web-admin',
          text: text.slice(0, 4000),
          total,
          status: 'pending',
        },
      });
      await tx.botCommand.create({
        data: {
          type: 'broadcast',
          payload: JSON.stringify({
            text: broadcast.text,
            broadcastId: broadcast.id,
          }),
          status: 'pending',
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: null,
          action: 'bot_command:broadcast',
          details: `Рассылка (broadcast ${broadcast.id}, recipients=${total})`,
        },
      });
      return broadcast;
    });

    return NextResponse.json(
      {
        ok: true,
        id: result.id,
        total,
        status: result.status,
      },
      { status: 201 },
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[broadcasts] create failed:', msg.slice(0, 160));
    return NextResponse.json(
      { error: `failed to enqueue broadcast: ${msg.slice(0, 120)}` },
      { status: 500 },
    );
  }
}
