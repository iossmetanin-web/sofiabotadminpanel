import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

// ───────────────────────────────────────────────────────────────────────
// /api/bot/command
//
// POST — enqueue a command for the Python bot to pick up from the shared DB.
//        The bot polls BotCommand every ~2s, marks status pending→processing→done,
//        and writes the result. This decouples the serverless admin (Vercel)
//        from the long-running bot (Render).
//
// GET  — list recent commands (admin UI history table + auto-refresh).
// ───────────────────────────────────────────────────────────────────────

const COMMAND_TYPES = [
  'broadcast',
  'dm',
  'ban',
  'unban',
  'gift_crystals',
  'set_subscription',
  'reload_config',
  'shutdown',
] as const;
type CommandType = (typeof COMMAND_TYPES)[number];

// Per-type payload schemas — the Python bot expects exactly these shapes.
// Defined as a plain function so each request gets a fresh schema instance
// (avoids any module-level caching weirdness with Turbopack + zod 4).
function payloadSchemaFor(type: CommandType): z.ZodType {
  switch (type) {
    case 'broadcast':
      return z.object({
        text: z.string().min(1).max(4096),
        broadcastId: z.string().min(1).max(64),
      });
    case 'dm':
      return z.object({
        telegramId: z.string().min(1).max(64),
        text: z.string().min(1).max(4096),
      });
    case 'ban':
      return z.object({
        telegramId: z.string().min(1).max(64),
      });
    case 'unban':
      return z.object({
        telegramId: z.string().min(1).max(64),
      });
    case 'gift_crystals':
      return z.object({
        telegramId: z.string().min(1).max(64),
        amount: z.number().int().min(1).max(100000),
      });
    case 'set_subscription':
      return z.object({
        telegramId: z.string().min(1).max(64),
        type: z.enum(['weekly', 'monthly']),
      });
    case 'reload_config':
      return z.object({}).strict();
    case 'shutdown':
      return z.object({}).strict();
  }
}

// Human-readable Russian labels for audit log + UI.
const COMMAND_LABELS: Record<CommandType, string> = {
  broadcast: 'Рассылка',
  dm: 'Личное сообщение',
  ban: 'Бан пользователя',
  unban: 'Разбан пользователя',
  gift_crystals: 'Подарок кристаллов',
  set_subscription: 'Установка подписки',
  reload_config: 'Перезагрузка конфига',
  shutdown: 'Остановка бота',
};

function isValidCommandType(value: unknown): value is CommandType {
  return typeof value === 'string' && (COMMAND_TYPES as readonly string[]).includes(value);
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  // Manual outer validation: { type: string, payload: object }.
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'body must be an object' }, { status: 400 });
  }
  const b = body as { type?: unknown; payload?: unknown };
  if (!isValidCommandType(b.type)) {
    return NextResponse.json(
      { error: `invalid type; expected one of: ${COMMAND_TYPES.join(', ')}` },
      { status: 400 },
    );
  }
  const type = b.type;
  if (!b.payload || typeof b.payload !== 'object' || Array.isArray(b.payload)) {
    return NextResponse.json({ error: 'payload must be an object' }, { status: 400 });
  }
  const payload = b.payload as Record<string, unknown>;

  // Validate the payload against the per-type schema.
  const payloadSchema = payloadSchemaFor(type);
  const payloadParsed = payloadSchema.safeParse(payload);
  if (!payloadParsed.success) {
    return NextResponse.json(
      { error: `invalid payload for type "${type}"`, details: payloadParsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    // Insert the command + audit log entry in a single transaction.
    // Keeps the two writes atomic so an audit log entry always exists for every command.
    const command = await db.$transaction(async (tx) => {
      const cmd = await tx.botCommand.create({
        data: {
          type,
          payload: JSON.stringify(payloadParsed.data),
          status: 'pending',
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: null,
          action: `bot_command:${type}`,
          targetUserId:
            'telegramId' in payloadParsed.data && typeof payloadParsed.data.telegramId === 'string'
              ? payloadParsed.data.telegramId
              : null,
          details: `${COMMAND_LABELS[type]} (cmd ${cmd.id})`,
        },
      });
      return cmd;
    });

    return NextResponse.json(
      { id: command.id, status: command.status, type: command.type },
      { status: 201 },
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[bot/command] create failed:', msg.slice(0, 160));
    return NextResponse.json(
      { error: `failed to enqueue command: ${msg.slice(0, 120)}` },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10) || 50));
  const statusFilter = searchParams.get('status'); // "pending" | "processing" | "done" | "failed"
  const typeFilter = searchParams.get('type');

  try {
    const where: { status?: string; type?: string } = {};
    if (statusFilter && ['pending', 'processing', 'done', 'failed'].includes(statusFilter)) {
      where.status = statusFilter;
    }
    if (typeFilter && isValidCommandType(typeFilter)) {
      where.type = typeFilter;
    }

    const commands = await db.botCommand.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return NextResponse.json({ commands });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[bot/command] list failed:', msg.slice(0, 160));
    return NextResponse.json({ commands: [] });
  }
}
