import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Export data as CSV — supports users, readings, transactions.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type') ?? 'users';

  const csvHeaders = {
    'Content-Type': 'text/csv; charset=utf-8',
  };

  try {
    if (type === 'users') {
      const users = await db.user.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          telegramId: true, username: true, firstName: true, name: true, language: true,
          zodiacSign: true, onboardingCompleted: true, crystals: true, messageCount: true,
          streakDays: true, isBlocked: true, isAdmin: true, lastSeenAt: true, createdAt: true,
        },
      });
      const header = 'telegram_id,username,first_name,name,language,zodiac,onboarded,crystals,messages,streak,blocked,admin,last_seen,created_at';
      const rows = users.map((u) =>
        [
          u.telegramId, u.username ?? '', u.firstName ?? '', u.name ?? '', u.language,
          u.zodiacSign ?? '', u.onboardingCompleted, u.crystals, u.messageCount,
          u.streakDays, u.isBlocked, u.isAdmin,
          u.lastSeenAt ? new Date(u.lastSeenAt).toISOString() : '',
          new Date(u.createdAt).toISOString(),
        ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')
      );
      const csv = [header, ...rows].join('\n');
      return new NextResponse(csv, {
        headers: { ...csvHeaders, 'Content-Disposition': 'attachment; filename=sofia_users.csv' },
      });
    }

    if (type === 'readings') {
      const readings = await db.reading.findMany({
        orderBy: { createdAt: 'desc' },
        take: 500,
        include: { user: { select: { telegramId: true, name: true, username: true } } },
      });
      const header = 'id,user_telegram_id,user_name,type,question,cards,cost,created_at';
      const rows = readings.map((r) =>
        [
          r.id, r.user.telegramId, r.user.name ?? r.user.username ?? '',
          r.type, (r.question ?? '').replace(/\n/g, ' '),
          r.cards.replace(/\n/g, ' ').replace(/"/g, '""'), r.cost,
          new Date(r.createdAt).toISOString(),
        ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')
      );
      const csv = [header, ...rows].join('\n');
      return new NextResponse(csv, {
        headers: { ...csvHeaders, 'Content-Disposition': 'attachment; filename=sofia_readings.csv' },
      });
    }

    if (type === 'transactions') {
      const txns = await db.transaction.findMany({
        orderBy: { createdAt: 'desc' },
        take: 500,
        include: { user: { select: { telegramId: true, name: true, username: true } } },
      });
      const header = 'id,user_telegram_id,user_name,type,amount,description,balance_after,created_at';
      const rows = txns.map((t) =>
        [
          t.id, t.user.telegramId, t.user.name ?? t.user.username ?? '',
          t.type, t.amount, (t.description ?? '').replace(/"/g, '""'),
          t.balanceAfter ?? '', new Date(t.createdAt).toISOString(),
        ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')
      );
      const csv = [header, ...rows].join('\n');
      return new NextResponse(csv, {
        headers: { ...csvHeaders, 'Content-Disposition': 'attachment; filename=sofia_transactions.csv' },
      });
    }

    return NextResponse.json({ error: 'unknown type. Use: users, readings, transactions' }, { status: 400 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[export] db unavailable:', msg.slice(0, 160));
    // Return a header-only CSV so the download still works (empty data).
    const header = type === 'readings'
      ? 'id,user_telegram_id,user_name,type,question,cards,cost,created_at'
      : type === 'transactions'
        ? 'id,user_telegram_id,user_name,type,amount,description,balance_after,created_at'
        : 'telegram_id,username,first_name,name,language,zodiac,onboarded,crystals,messages,streak,blocked,admin,last_seen,created_at';
    return new NextResponse(header, { headers: { ...csvHeaders, 'Content-Disposition': `attachment; filename=sofia_${type}.csv` } });
  }
}
