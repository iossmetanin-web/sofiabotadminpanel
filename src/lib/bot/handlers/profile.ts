// /profile — show user profile.

import { db } from '@/lib/db';
import type { TelegramMessage } from '../types';
import { sendMessage } from '../telegram';
import { mainMenuKeyboard } from '../keyboards';
import { t, type Locale } from '../i18n';
import { findUserByTelegramId } from './_helpers';
import { zodiacEmoji } from '../services/zodiac';
import type { User } from '@prisma/client';

export async function handleProfile(message: TelegramMessage): Promise<void> {
  if (!message.from) return;
  const tgId = String(message.from.id);
  const user = await findUserByTelegramId(tgId);
  if (!user) {
    await sendMessage(message.chat.id, t('err_unknown_user', 'ru'));
    return;
  }
  const loc = (user.language as Locale) ?? 'ru';
  if (user.isBlocked) {
    await sendMessage(message.chat.id, t('err_blocked', loc));
    return;
  }
  await sendMessage(
    message.chat.id,
    formatProfile(user, loc),
    { parse_mode: 'HTML', reply_markup: mainMenuKeyboard(user, loc) },
  );
}

export function formatProfile(user: User, loc: Locale): string {
  const name = user.name ?? user.firstName ?? '—';
  const zodiacSign = user.zodiacSign ?? '—';
  const zodiacWithEmoji = user.zodiacSign ? `${zodiacEmoji(user.zodiacSign)} ${zodiacSign}` : zodiacSign;
  const ageGroup = user.ageGroup ?? '—';
  const messages = user.messageCount ?? 0;
  const streak = user.streakDays ?? 0;
  const crystalsCount = user.crystals ?? 0;
  const subType = user.subscriptionType;
  const subUntil = user.subscriptionUntil;

  let subLine: string;
  if (subType && subUntil && new Date(subUntil).getTime() > Date.now()) {
    subLine = t('profile_subscription', loc, {
      type: subType,
      until: new Date(subUntil).toISOString().slice(0, 10),
    });
  } else {
    subLine = t('profile_no_subscription', loc);
  }

  const lines = [
    t('profile_title', loc),
    t('profile_name', loc, { name }),
    t('profile_zodiac', loc, { sign: zodiacWithEmoji }),
    t('profile_age_group', loc, { group: ageGroup }),
    t('profile_messages', loc, { count: messages }),
    t('profile_streak', loc, { days: streak }),
    t('profile_crystals', loc, { count: crystalsCount }),
    subLine,
    t('profile_referral_code', loc, { code: user.referralCode }),
  ];
  return lines.join('\n');
}

export async function handleBalance(message: TelegramMessage): Promise<void> {
  if (!message.from) return;
  const tgId = String(message.from.id);
  const user = await findUserByTelegramId(tgId);
  if (!user) return;
  const loc = (user.language as Locale) ?? 'ru';
  const subType = user.subscriptionType;
  const subUntil = user.subscriptionUntil;
  const lines = [
    t('balance_title', loc),
    t('balance_crystals', loc, { count: user.crystals ?? 0 }),
  ];
  if (subType && subUntil && new Date(subUntil).getTime() > Date.now()) {
    lines.push(
      t('balance_subscription', loc, {
        type: subType,
        until: new Date(subUntil).toISOString().slice(0, 10),
      }),
    );
  } else {
    lines.push(t('balance_no_subscription', loc));
  }
  // Inline keyboard with subscription buttons (reuse buy menu).
  const { buyMenuKeyboard } = await import('../keyboards');
  await sendMessage(message.chat.id, lines.join('\n'), {
    parse_mode: 'HTML',
    reply_markup: buyMenuKeyboard(loc),
  });
}
