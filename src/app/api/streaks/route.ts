import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Streaks — top streaks + distribution + retention curve.
export async function GET() {
  const now = new Date();

  // Top streaks.
  const topStreaks = await db.user.findMany({
    where: { streakDays: { gt: 0 }, isBlocked: false },
    orderBy: { streakDays: 'desc' },
    take: 10,
    select: {
      id: true,
      name: true,
      firstName: true,
      username: true,
      zodiacSign: true,
      streakDays: true,
      lastActivityDay: true,
      lastSeenAt: true,
    },
  });

  // Distribution buckets.
  const all = await db.user.findMany({
    where: { isBlocked: false },
    select: { streakDays: true },
  });
  const dist = {
    '0': 0, '1-3': 0, '4-7': 0, '8-14': 0, '15-30': 0, '31+': 0,
  };
  for (const u of all) {
    if (u.streakDays === 0) dist['0']++;
    else if (u.streakDays <= 3) dist['1-3']++;
    else if (u.streakDays <= 7) dist['4-7']++;
    else if (u.streakDays <= 14) dist['8-14']++;
    else if (u.streakDays <= 30) dist['15-30']++;
    else dist['31+']++;
  }

  // Daily active users for the last 14 days (based on lastActivityDay).
  const since = new Date(now.getTime() - 14 * 86400_000);
  const activeUsers = await db.user.findMany({
    where: { lastActivityDay: { gte: since } },
    select: { lastActivityDay: true },
  });
  const dailyActive: { date: string; count: number }[] = [];
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  for (let i = 13; i >= 0; i--) {
    const day = new Date(today);
    day.setUTCDate(today.getUTCDate() - i);
    const dayStr = day.toISOString().slice(0, 10);
    const count = activeUsers.filter((u) => {
      if (!u.lastActivityDay) return false;
      const d = new Date(u.lastActivityDay);
      d.setUTCHours(0, 0, 0, 0);
      return d.toISOString().slice(0, 10) === dayStr;
    }).length;
    dailyActive.push({ date: dayStr, count });
  }

  // Card-of-day retention: how many users did at least one card_of_day reading in the last 7 days.
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400_000);
  const cardOfDayUsers = await db.reading.findMany({
    where: { type: 'card_of_day', createdAt: { gte: sevenDaysAgo } },
    select: { userId: true, createdAt: true },
    distinct: ['userId'],
  });

  return NextResponse.json({
    topStreaks: topStreaks.map((u) => ({
      id: u.id,
      name: u.name ?? u.firstName ?? '—',
      username: u.username,
      zodiacSign: u.zodiacSign,
      streakDays: u.streakDays,
      lastSeenAt: u.lastSeenAt,
    })),
    distribution: Object.entries(dist).map(([bucket, count]) => ({ bucket, count })),
    dailyActive,
    cardOfDayActiveUsers: cardOfDayUsers.length,
  });
}
