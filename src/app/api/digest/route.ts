import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Weekly digest — fetch the last-sent marker + the data that would be in the digest.
// Used by the admin "Digest" tab to preview what the bot sent (or will send) to admins.
export async function GET() {
  const now = new Date();
  const weekStart = new Date(now.getTime() - 7 * 86400_000);

  try {
    const [newUsers, active7d, messages, readings, crystalsSpentAgg, topUsers, lastSentMarker, allBroadcasts] = await Promise.all([
      db.user.count({ where: { createdAt: { gte: weekStart } } }),
      db.user.count({ where: { lastSeenAt: { gte: weekStart } } }),
      db.conversation.count({ where: { createdAt: { gte: weekStart } } }),
      db.reading.count({ where: { createdAt: { gte: weekStart } } }),
      db.transaction.aggregate({ where: { type: 'spend', createdAt: { gte: weekStart } }, _sum: { amount: true } }),
      db.user.findMany({
        where: { lastSeenAt: { gte: weekStart } },
        orderBy: { messageCount: 'desc' },
        take: 5,
        select: { id: true, name: true, firstName: true, username: true, zodiacSign: true, messageCount: true, streakDays: true, createdAt: true },
      }),
      db.botConfig.findUnique({ where: { id: 'weekly_digest' } }),
      db.broadcast.findMany({
        where: { createdAt: { gte: weekStart } },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    // Reading-type breakdown for the week.
    const readingsByType = await db.reading.groupBy({
      by: ['type'],
      where: { createdAt: { gte: weekStart } },
      _count: { type: true },
      orderBy: { _count: { type: 'desc' } },
    });

    return NextResponse.json({
      weekRange: { from: weekStart.toISOString(), to: now.toISOString() },
      lastSentAt: lastSentMarker?.value ?? null,
      stats: {
        newUsers,
        active7d,
        messages,
        readings,
        crystalsSpent: crystalsSpentAgg._sum.amount ?? 0,
      },
      topUsers: topUsers.map((u) => ({
        id: u.id,
        name: u.name ?? u.firstName ?? '-',
        username: u.username,
        zodiacSign: u.zodiacSign,
        messageCount: u.messageCount,
        streakDays: u.streakDays,
      })),
      readingsByType: readingsByType.map((r) => ({ type: r.type, count: r._count.type })),
      recentBroadcasts: allBroadcasts.map((b) => ({
        id: b.id,
        text: b.text,
        status: b.status,
        sentCount: b.sentCount,
        failedCount: b.failedCount,
        total: b.total,
        createdAt: b.createdAt,
      })),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[digest] db unavailable:', msg.slice(0, 160));
    return NextResponse.json({
      weekRange: { from: weekStart.toISOString(), to: now.toISOString() },
      lastSentAt: null,
      stats: { newUsers: 0, active7d: 0, messages: 0, readings: 0, crystalsSpent: 0 },
      topUsers: [],
      readingsByType: [],
      recentBroadcasts: [],
    });
  }
}
