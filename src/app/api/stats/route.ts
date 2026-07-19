import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 86400_000);
  const weekAgo = new Date(now.getTime() - 7 * 86400_000);

  const [
    totalUsers, active24h, active7d, onboarded, blocked,
    totalMessages, totalReadings, crystalsSpent, crystalsInCirculation,
    broadcasts, readingsByType,
  ] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { lastSeenAt: { gte: dayAgo } } }),
    db.user.count({ where: { lastSeenAt: { gte: weekAgo } } }),
    db.user.count({ where: { onboardingCompleted: true } }),
    db.user.count({ where: { isBlocked: true } }),
    db.conversation.count(),
    db.reading.count(),
    db.transaction.aggregate({ where: { type: 'spend' }, _sum: { amount: true } }),
    db.user.aggregate({ _sum: { crystals: true } }),
    db.broadcast.count(),
    db.reading.groupBy({ by: ['type'], _count: { type: true }, orderBy: { _count: { type: 'desc' } } }),
  ]);

  const conversion = totalUsers > 0 ? (onboarded / totalUsers) * 100 : 0;
  const retention7d = totalUsers > 0 ? (active7d / totalUsers) * 100 : 0;

  return NextResponse.json({
    users: { total: totalUsers, active24h, active7d, onboarded, blocked },
    activity: { totalMessages, totalReadings, broadcasts },
    economy: {
      crystalsSpent: crystalsSpent._sum.amount ?? 0,
      crystalsInCirculation: crystalsInCirculation._sum.crystals ?? 0,
    },
    funnel: { conversion: Number(conversion.toFixed(1)), retention7d: Number(retention7d.toFixed(1)) },
    readingsByType: readingsByType.map((r) => ({ type: r.type, count: r._count.type })),
  });
}
