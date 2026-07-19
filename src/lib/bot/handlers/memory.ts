// /memory — show what Sofia remembers about the user.

import type { TelegramMessage } from '../types';
import { sendMessage } from '../telegram';
import { homeOnlyKeyboard } from '../keyboards';
import { t, type Locale } from '../i18n';
import { findUserByTelegramId } from './_helpers';
import { formatMemoryForUser } from '../services/memory';

export async function handleMemory(message: TelegramMessage): Promise<void> {
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
  const text = await formatMemoryForUser(user.id, user.lastTopicSummary);
  await sendMessage(message.chat.id, text, {
    parse_mode: 'HTML',
    reply_markup: homeOnlyKeyboard(loc),
  });
}
