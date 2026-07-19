import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/bot/command/[id]
// Returns the status / result of a single enqueued command.
// The admin UI polls this while a command is in "pending" or "processing" state.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const cmd = await db.botCommand.findUnique({ where: { id } });
    if (!cmd) {
      return NextResponse.json({ error: 'command not found' }, { status: 404 });
    }
    return NextResponse.json({
      id: cmd.id,
      type: cmd.type,
      payload: cmd.payload,
      status: cmd.status,
      result: cmd.result,
      createdAt: cmd.createdAt,
      startedAt: cmd.startedAt,
      finishedAt: cmd.finishedAt,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[bot/command/:id] lookup failed:', msg.slice(0, 160));
    return NextResponse.json({ error: 'db unavailable' }, { status: 500 });
  }
}
