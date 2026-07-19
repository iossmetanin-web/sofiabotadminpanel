// Shared helpers for the bot handlers.

import { db } from '@/lib/db';
import type { User } from '@prisma/client';

/** Generate a 6-character referral code from random chars. */
export function newReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) {
    s += chars[Math.floor(Math.random() * chars.length)];
  }
  return s;
}

/** Split long text on paragraph boundaries (Telegram 4096-char limit). */
export function splitMessage(text: string, maxLen = 4000): string[] {
  if (text.length <= maxLen) return [text];
  const chunks: string[] = [];
  let current = '';
  for (const paragraph of text.split('\n\n')) {
    if (current && current.length + paragraph.length + 2 > maxLen) {
      chunks.push(current);
      current = paragraph;
    } else {
      current = current ? `${current}\n\n${paragraph}` : paragraph;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

/** Find a user by telegramId. Returns null if not found. */
export function findUserByTelegramId(telegramId: string | number): Promise<User | null> {
  return db.user.findUnique({ where: { telegramId: String(telegramId) } });
}

/** True if the given Telegram user ID is in ADMIN_IDS env. */
export function isAdmin(telegramId: string | number): boolean {
  const ids = (process.env.ADMIN_IDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return ids.includes(String(telegramId));
}

/** Read the reading price (in crystals) from env. Default prices if unset. */
export function readingPrice(readingType: string): number {
  const defaults: Record<string, number> = {
    fate_card: 1,
    tarot_small: 1,
    tarot_full: 3,
    tarot_love: 2,
    tarot_career: 2,
    tarot_decision: 2,
    horoscope: 1,
    card_of_day: 0,
    single_card: 0,
  };
  const envKey = `PRICE_${readingType.toUpperCase()}`;
  const envVal = process.env[envKey];
  if (envVal !== undefined) {
    const n = Number.parseInt(envVal, 10);
    if (Number.isFinite(n)) return n;
  }
  return defaults[readingType] ?? 1;
}

export const DAILY_CARD_COOLDOWN_HOURS = Number(process.env.DAILY_CARD_COOLDOWN_HOURS ?? 20);
export const RETURN_ABSENCE_HOURS = Number(process.env.RETURN_ABSENCE_HOURS ?? 12);
