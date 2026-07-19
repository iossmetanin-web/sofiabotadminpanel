// /help — show all commands + descriptions.

import type { TelegramMessage } from '../types';
import { sendMessage } from '../telegram';
import { backHomeKeyboard } from '../keyboards';
import { t, type Locale } from '../i18n';
import { findUserByTelegramId } from './_helpers';

export async function handleHelp(message: TelegramMessage): Promise<void> {
  if (!message.from) return;
  const tgId = String(message.from.id);
  const user = await findUserByTelegramId(tgId);
  const loc = (user?.language as Locale) ?? 'ru';
  if (user?.isBlocked) {
    await sendMessage(message.chat.id, t('err_blocked', loc));
    return;
  }
  await sendMessage(message.chat.id, t('help_body', loc), {
    reply_markup: backHomeKeyboard(loc),
  });
}
