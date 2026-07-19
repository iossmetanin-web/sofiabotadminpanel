import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Activity timeseries — last N days of messages + readings, for sparkline charts.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const days = Math.min(Math.max(parseInt(url.searchParams.get('days') ?? '14', 10) || 14, 1), 90);

  try {
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    since.setUTCDate(since.getUTCDate() - (days - 1));

    const [conversations, readings, newUsers, transactions] = await Promise.all([
      db.conversation.findMany({
        where: { createdAt: { gte: since } },
        select: { createdAt: true, role: true },
      }),
      db.reading.findMany({
        where: { createdAt: { gte: since } },
        select: { createdAt: true, type: true, cost: true },
      }),
      db.user.findMany({
        where: { createdAt: { gte: since } },
        select: { createdAt: true },
      }),
      db.transaction.findMany({
        where: { type: 'spend', createdAt: { gte: since } },
        select: { createdAt: true, amount: true },
      }),
    ]);

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const buckets: { date: string; messages: number; sofiaMsgs: number; userMsgs: number; readings: number; newUsers: number; crystalsSpent: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const day = new Date(today);
      day.setUTCDate(today.getUTCDate() - i);
      buckets.push({
        date: day.toISOString().slice(0, 10),
        messages: 0, sofiaMsgs: 0, userMsgs: 0,
        readings: 0, newUsers: 0, crystalsSpent: 0,
      });
    }
    const bucketMap = new Map(buckets.map((b) => [b.date, b]));

    const dayOf = (d: Date): string => {
      const x = new Date(d);
      x.setUTCHours(0, 0, 0, 0);
      return x.toISOString().slice(0, 10);
    };

    for (const c of conversations) {
      const b = bucketMap.get(dayOf(c.createdAt));
      if (b) {
        b.messages++;
        if (c.role === 'sofia') b.sofiaMsgs++;
        else b.userMsgs++;
      }
    }
    for (const r of readings) {
      const b = bucketMap.get(dayOf(r.createdAt));
      if (b) b.readings++;
    }
    for (const u of newUsers) {
      const b = bucketMap.get(dayOf(u.createdAt));
      if (b) b.newUsers++;
    }
    for (const t of transactions) {
      const b = bucketMap.get(dayOf(t.createdAt));
      if (b) b.crystalsSpent += t.amount;
    }

    return NextResponse.json({ days, buckets });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[activity] db unavailable:', msg.slice(0, 160));
    // Return zeroed buckets so sparklines render flat instead of erroring.
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const buckets: { date: string; messages: number; sofiaMsgs: number; userMsgs: number; readings: number; newUsers: number; crystalsSpent: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const day = new Date(today);
      day.setUTCDate(today.getUTCDate() - i);
      buckets.push({ date: day.toISOString().slice(0, 10), messages: 0, sofiaMsgs: 0, userMsgs: 0, readings: 0, newUsers: 0, crystalsSpent: 0 });
    }
    return NextResponse.json({ days, buckets });
  }
}
