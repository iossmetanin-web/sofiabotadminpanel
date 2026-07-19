import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Referral leaderboard + counts.
export async function GET() {
  // Top referrers (by count of referrals made).
  const referrers = await db.referral.groupBy({
    by: ['referrerId'],
    _count: { refereeId: true },
    orderBy: { _count: { refereeId: 'desc' } },
    take: 10,
  });

  const referrerIds = referrers.map((r) => r.referrerId);
  const users = await db.user.findMany({
    where: { id: { in: referrerIds } },
    select: { id: true, name: true, firstName: true, username: true, zodiacSign: true, createdAt: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  const leaderboard = referrers.map((r, i) => ({
    rank: i + 1,
    referrer: userMap.get(r.referrerId),
    referrals: r._count.refereeId,
  }));

  // Totals.
  const totalReferrals = await db.referral.count();
  const rewardedReferrals = await db.referral.count({ where: { rewardGiven: true } });
  const usersWithReferralCode = await db.user.count({
    where: { referredById: { not: null } },
  });

  // Crystals awarded via referral (referral type transactions).
  const crystalsAwardedAgg = await db.transaction.aggregate({
    where: { type: 'referral' },
    _sum: { amount: true },
  });

  return NextResponse.json({
    leaderboard: leaderboard.filter((l) => l.referrer != null),
    totals: {
      totalReferrals,
      rewardedReferrals,
      usersWithReferrer: usersWithReferralCode,
      crystalsAwarded: crystalsAwardedAgg._sum.amount ?? 0,
    },
  });
}
