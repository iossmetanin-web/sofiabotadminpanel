import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/users/[telegramId] — full user detail with recent readings + transactions + conversations.
export async function GET(req: NextRequest, { params }: { params: Promise<{ telegramId: string }> }) {
  const { telegramId } = await params;

  try {
    const user = await db.user.findUnique({
      where: { telegramId },
      select: {
        id: true, telegramId: true, username: true, firstName: true, lastName: true, name: true,
        language: true, birthDate: true, birthTime: true, birthPlace: true, gender: true, ageGroup: true,
        zodiacSign: true, onboardingCompleted: true, onboardingStep: true,
        crystals: true, messageCount: true, streakDays: true, lastActivityDay: true,
        isBlocked: true, isAdmin: true, lastSeenAt: true, createdAt: true,
        subscriptionType: true, subscriptionUntil: true, referredById: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'user not found' }, { status: 404 });
    }

    const [readings, transactions, conversations, referralCount, memoriesCount] = await Promise.all([
      db.reading.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 15,
        select: { id: true, type: true, question: true, cards: true, interpretation: true, cost: true, createdAt: true },
      }),
      db.transaction.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 15,
        select: { id: true, type: true, amount: true, description: true, balanceAfter: true, createdAt: true },
      }),
      db.conversation.count({ where: { userId: user.id } }),
      db.referral.count({ where: { referrerId: user.id } }),
      db.memory.count({ where: { userId: user.id } }),
    ]);

    // Who referred this user (if anyone).
    const referrer = user.referredById
      ? await db.user.findUnique({ where: { id: user.referredById }, select: { name: true, firstName: true, username: true, telegramId: true } })
      : null;

    return NextResponse.json({
      user: {
        ...user,
        birthDate: user.birthDate?.toISOString() ?? null,
        lastActivityDay: user.lastActivityDay?.toISOString() ?? null,
        lastSeenAt: user.lastSeenAt?.toISOString() ?? null,
        createdAt: user.createdAt.toISOString(),
        subscriptionUntil: user.subscriptionUntil?.toISOString() ?? null,
      },
      stats: {
        conversations,
        referrals: referralCount,
        memories: memoriesCount,
        readings: readings.length,
        transactions: transactions.length,
      },
      readings,
      transactions,
      referrer,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[user-detail] db unavailable:', msg.slice(0, 160));
    return NextResponse.json({ error: 'db unavailable' }, { status: 500 });
  }
}
