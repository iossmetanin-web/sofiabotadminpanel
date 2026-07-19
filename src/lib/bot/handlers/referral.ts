// /referral — show referral link + count.

import { db } from '@/lib/db';
import type { TelegramMessage } from '../types';
import { sendMessage } from '../telegram';
import { referralKeyboard } from '../keyboards';
import { t, type Locale } from '../i18n';
import { findUserByTelegramId } from './_helpers';

export async function handleReferral(message: TelegramMessage): Promise<void> {
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

  const code = user.referralCode ?? '';
  const botUsername = process.env.BOT_USERNAME ?? 'oracultetris_bot';
  const link = `https://t.me/${botUsername}?start=ref_${code}`;
  const madeCount = await db.referral.count({
    where: { referrerId: user.id },
  });

  let text = `${t('referral_title', loc)}\n\n${t('referral_body', loc, { link })}`;
  if (madeCount > 0) {
    text +=
      loc === 'en'
        ? `\n\nYou've invited ${madeCount} friend(s) so far.`
        : `\n\nТы уже пригласил ${madeCount} друга(ей).`;
  }
  await sendMessage(message.chat.id, text, {
    parse_mode: 'HTML',
    reply_markup: referralKeyboard(code, loc),
  });
}

export async function handleReferralFromCallback(
  chatId: number,
  user: { id: string; referralCode: string; language: string },
): Promise<void> {
  const loc = (user.language as Locale) ?? 'ru';
  const botUsername = process.env.BOT_USERNAME ?? 'oracultetris_bot';
  const link = `https://t.me/${botUsername}?start=ref_${user.referralCode}`;
  const madeCount = await db.referral.count({
    where: { referrerId: user.id },
  });
  let text = `${t('referral_title', loc)}\n\n${t('referral_body', loc, { link })}`;
  if (madeCount > 0) {
    text +=
      loc === 'en'
        ? `\n\nYou've invited ${madeCount} friend(s) so far.`
        : `\n\nТы уже пригласил ${madeCount} друга(ей).`;
  }
  await sendMessage(chatId, text, {
    parse_mode: 'HTML',
    reply_markup: referralKeyboard(user.referralCode, loc),
  });
}


