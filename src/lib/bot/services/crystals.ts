// Crystals service — crystal economy (spend, add, daily bonus, referral).
// Ported from python-bot/app/services/crystals.py.
// All state-changing operations go through this module so the logic stays
// in one place. Every spend / add records a `Transaction` row for audit.

import { db } from '@/lib/db';

export class InsufficientCrystalsError extends Error {
  needed: number;
  have: number;
  constructor(needed: number, have: number) {
    super(`Need ${needed} 💎, have ${have}`);
    this.needed = needed;
    this.have = have;
  }
}

export async function getBalance(userId: string): Promise<number> {
  const u = await db.user.findUnique({ where: { id: userId }, select: { crystals: true } });
  return u?.crystals ?? 0;
}

/**
 * Add crystals to a user. Creates an audit Transaction row.
 * Returns the new balance.
 */
export async function addCrystals(
  userId: string,
  amount: number,
  type: string = 'add',
  description?: string,
): Promise<number> {
  if (amount === 0) return getBalance(userId);
  // Atomic increment to avoid race conditions.
  const updated = await db.user.update({
    where: { id: userId },
    data: { crystals: { increment: amount } },
    select: { crystals: true, telegramId: true },
  });
  await db.transaction.create({
    data: {
      userId,
      type,
      amount,
      description: description ?? null,
      balanceAfter: updated.crystals,
    },
  });
  console.log('[crystals] add', {
    telegramId: updated.telegramId,
    amount,
    balance: updated.crystals,
    type,
  });
  return updated.crystals;
}

/**
 * Spend crystals. Atomic — returns false if insufficient.
 * On success records a Transaction row (amount negative) and returns true.
 */
export async function spendCrystals(
  userId: string,
  amount: number,
  description: string,
): Promise<boolean> {
  try {
    return await db.$transaction(async (tx) => {
      const u = await tx.user.findUnique({
        where: { id: userId },
        select: { crystals: true },
      });
      if (!u) return false;
      if (u.crystals < amount) return false;
      const updated = await tx.user.update({
        where: { id: userId },
        data: { crystals: { decrement: amount } },
        select: { crystals: true, telegramId: true },
      });
      await tx.transaction.create({
        data: {
          userId,
          type: 'spend',
          amount: -amount,
          description,
          balanceAfter: updated.crystals,
        },
      });
      console.log('[crystals] spend', {
        telegramId: updated.telegramId,
        amount,
        balance: updated.crystals,
        description,
      });
      return true;
    });
  } catch (e) {
    console.error('[crystals] spend failed', e);
    return false;
  }
}

/** Refund crystals (e.g. when LLM call fails after charging). */
export async function refundCrystals(
  userId: string,
  amount: number,
  description: string,
): Promise<void> {
  await addCrystals(userId, amount, 'add', `Refund: ${description}`);
}

/**
 * Daily bonus logic. Updates the streak based on lastActivityDay.
 * - If user already active today → no change.
 * - If last activity was yesterday → streak +1.
 * - Otherwise → streak resets to 1.
 *
 * Bonus: +1 crystal if streak >= 3 and not yet awarded today
 * (tracked by lastFreeCardAt).
 *
 * Returns { card: boolean (always false here), bonus: number }.
 */
export async function checkAndGiveDailyBonus(
  userId: string,
): Promise<{ card: boolean; bonus: number; streak: number }> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      streakDays: true,
      lastActivityDay: true,
      lastFreeCardAt: true,
    },
  });
  if (!user) return { card: false, bonus: 0, streak: 0 };

  const now = new Date();
  const today = new Date(now);
  today.setUTCHours(0, 0, 0, 0);
  const last = user.lastActivityDay;

  let newStreak: number;
  let bonus = 0;
  if (!last) {
    newStreak = 1;
  } else {
    const lastDay = new Date(last);
    lastDay.setUTCHours(0, 0, 0, 0);
    const diffDays = Math.round(
      (today.getTime() - lastDay.getTime()) / 86_400_000,
    );
    if (diffDays <= 0) {
      // Already counted today — no change.
      return { card: false, bonus: 0, streak: user.streakDays };
    }
    if (diffDays === 1) {
      newStreak = (user.streakDays ?? 0) + 1;
    } else {
      newStreak = 1;
    }
  }

  await db.user.update({
    where: { id: userId },
    data: { streakDays: newStreak, lastActivityDay: today },
  });

  // Bonus: +1 crystal if streak >= 3 and not yet awarded today.
  const lastFree = user.lastFreeCardAt;
  const lastFreeDay = lastFree
    ? new Date(new Date(lastFree).setUTCHours(0, 0, 0, 0))
    : null;
  if (newStreak >= 3 && (!lastFreeDay || lastFreeDay.getTime() < today.getTime())) {
    await addCrystals(
      userId,
      1,
      'daily_bonus',
      `Серия ${newStreak} дней — бонус`,
    );
    await db.user.update({
      where: { id: userId },
      data: { lastFreeCardAt: now },
    });
    bonus = 1;
  }

  return { card: false, bonus, streak: newStreak };
}

/** True if user has an active (not expired) subscription. */
export async function subscriptionActive(userId: string): Promise<boolean> {
  const u = await db.user.findUnique({
    where: { id: userId },
    select: { subscriptionType: true, subscriptionUntil: true },
  });
  if (!u?.subscriptionUntil) return false;
  return new Date(u.subscriptionUntil).getTime() > Date.now();
}

/**
 * Apply a subscription. weekly → +10 crystals. monthly → effectively unlimited.
 */
export async function applySubscription(
  userId: string,
  subType: 'weekly' | 'monthly',
  days: number,
): Promise<void> {
  const until = new Date(Date.now() + days * 86_400_000);
  const u = await db.user.findUnique({
    where: { id: userId },
    select: { crystals: true },
  });
  let newCrystals = u?.crystals ?? 0;
  if (subType === 'monthly') {
    newCrystals = Math.max(newCrystals, 9999);
  } else if (subType === 'weekly') {
    newCrystals = newCrystals + 10;
  }
  await db.user.update({
    where: { id: userId },
    data: {
      subscriptionType: subType,
      subscriptionUntil: until,
      crystals: newCrystals,
    },
  });
  await db.transaction.create({
    data: {
      userId,
      type: 'subscription',
      amount: subType === 'weekly' ? 10 : 9999,
      description: `Подписка ${subType} на ${days} дн.`,
      balanceAfter: newCrystals,
    },
  });
}

/** Reward the referrer when the referee completes onboarding (idempotent). */
export async function rewardReferral(
  referrerId: string,
  refereeId: string,
): Promise<void> {
  try {
    await db.referral.create({
      data: { referrerId, refereeId, rewardGiven: true },
    });
  } catch {
    // unique constraint → already rewarded
    return;
  }
  await addCrystals(
    referrerId,
    1,
    'referral',
    `Реферал: новый участник`,
  );
  await db.user.update({
    where: { id: referrerId },
    data: { referralRewardGiven: true },
  });
  await db.auditLog.create({
    data: {
      action: 'referral_reward',
      targetUserId: referrerId,
      details: `referee=${refereeId}`,
    },
  });
}

export function welcomeBonus(): number {
  return Number(process.env.WELCOME_CRYSTALS ?? 3);
}
