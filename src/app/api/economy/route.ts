import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Economy overview — transaction history, crystal flow, revenue metrics.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit = Math.min(50, parseInt(searchParams.get('limit') ?? '20', 10));
  const type = searchParams.get('type') ?? '';

  const where = type ? { type } : {};

  const [transactions, total, typeBreakdown, totalSpent, totalAdded, totalDailyBonus, totalReferral, totalAdminGift] = await Promise.all([
    db.transaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: { select: { name: true, firstName: true, username: true, telegramId: true } },
      },
    }),
    db.transaction.count({ where }),
    db.transaction.groupBy({
      by: ['type'],
      _count: { type: true },
      _sum: { amount: true },
      orderBy: { _count: { type: 'desc' } },
    }),
    db.transaction.aggregate({ where: { type: 'spend' }, _sum: { amount: true }, _count: true }),
    db.transaction.aggregate({ where: { type: 'add' }, _sum: { amount: true }, _count: true }),
    db.transaction.aggregate({ where: { type: 'daily_bonus' }, _sum: { amount: true }, _count: true }),
    db.transaction.aggregate({ where: { type: 'referral' }, _sum: { amount: true }, _count: true }),
    db.transaction.aggregate({ where: { type: 'admin_gift' }, _sum: { amount: true }, _count: true }),
  ]);

  const totalInCirculation = await db.user.aggregate({ _sum: { crystals: true } });
  const avgBalance = await db.user.aggregate({ _avg: { crystals: true } });
  const zeroBalanceCount = await db.user.count({ where: { crystals: 0 } });

  return NextResponse.json({
    transactions: transactions.map((t) => ({
      id: t.id,
      userId: t.userId,
      type: t.type,
      amount: t.amount,
      description: t.description,
      balanceAfter: t.balanceAfter,
      createdAt: t.createdAt,
      user: t.user,
    })),
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    summary: {
      totalSpent: totalSpent._sum.amount ?? 0,
      totalSpentCount: totalSpent._count,
      totalAdded: totalAdded._sum.amount ?? 0,
      totalAddedCount: totalAdded._count,
      totalDailyBonus: totalDailyBonus._sum.amount ?? 0,
      totalDailyBonusCount: totalDailyBonus._count,
      totalReferral: totalReferral._sum.amount ?? 0,
      totalReferralCount: totalReferral._count,
      totalAdminGift: totalAdminGift._sum.amount ?? 0,
      totalAdminGiftCount: totalAdminGift._count,
      totalInCirculation: totalInCirculation._sum.crystals ?? 0,
      avgBalance: Math.round(avgBalance._avg.crystals ?? 0),
      zeroBalanceUsers: zeroBalanceCount,
    },
    typeBreakdown: typeBreakdown.map((tb) => ({
      type: tb.type,
      count: tb._count.type,
      total: tb._sum.amount ?? 0,
    })),
  });
}
