// /subscription — show subscription plans.

import type { TelegramMessage } from '../types';
import { sendMessage } from '../telegram';
import { subscriptionKeyboard } from '../keyboards';
import { t, type Locale } from '../i18n';
import { findUserByTelegramId } from './_helpers';

export async function handleSubscription(message: TelegramMessage): Promise<void> {
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
  const subUntil = user.subscriptionUntil;
  const subType = user.subscriptionType;
  const active =
    subType &&
    subUntil &&
    new Date(subUntil).getTime() > Date.now();
  const line = active
    ? t('subscription_active_until', loc, {
        until: new Date(subUntil!).toISOString().slice(0, 10),
      })
    : t('subscription_none', loc);
  await sendMessage(
    message.chat.id,
    `${t('subscription_title', loc)}\n\n${line}\n\n${t('subscription_pay_contact', loc)}`,
    { parse_mode: 'HTML', reply_markup: subscriptionKeyboard(loc) },
  );
}
