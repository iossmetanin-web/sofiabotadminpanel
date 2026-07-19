import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit = Math.min(50, parseInt(searchParams.get('limit') ?? '20', 10));
  const search = searchParams.get('search') ?? '';

  const where = search
    ? {
        OR: [
          { username: { contains: search } },
          { name: { contains: search } },
          { firstName: { contains: search } },
        ],
      }
    : {};

  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true, telegramId: true, username: true, firstName: true, name: true,
        language: true,
        zodiacSign: true, onboardingCompleted: true, onboardingStep: true,
        crystals: true, messageCount: true, streakDays: true, isBlocked: true,
        isAdmin: true, lastSeenAt: true, createdAt: true, referredById: true,
      },
    }),
    db.user.count({ where }),
  ]);

  return NextResponse.json({ users, total, page, totalPages: Math.max(1, Math.ceil(total / limit)) });
}
