// /daily — card of the day. Free, 1/day per user. Updates streak.
// Ported from python-bot/app/handlers/daily.py.

import { db } from '@/lib/db';
import type { TelegramMessage } from '../types';
import { sendMessage } from '../telegram';
import { mainMenuKeyboard } from '../keyboards';
import { t, type Locale } from '../i18n';
import {
  findUserByTelegramId,
  DAILY_CARD_COOLDOWN_HOURS,
} from './_helpers';
import * as crystals from '../services/crystals';
import { drawRandomCards, cardsToJSON } from '../services/tarot';
import { cardOfDay } from '../services/ai';

export async function handleDaily(message: TelegramMessage): Promise<void> {
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

  const now = new Date();
  const last = user.lastDailyCardAt;
  if (last && now.getTime() - new Date(last).getTime() < DAILY_CARD_COOLDOWN_HOURS * 3_600_000) {
    const remainingMs = DAILY_CARD_COOLDOWN_HOURS * 3_600_000 - (now.getTime() - new Date(last).getTime());
    const remainingHours = Math.max(0, Math.floor(remainingMs / 3_600_000));
    await sendMessage(
      message.chat.id,
      t('card_of_day_cooldown', loc, { hours: remainingHours }),
      { reply_markup: mainMenuKeyboard(user, loc) },
    );
    return;
  }

  // Update streak + maybe give bonus.
  const bonusInfo = await crystals.checkAndGiveDailyBonus(user.id);

  // Draw a card.
  const cards = drawRandomCards(1, loc);
  const card = cards[0];
  await sendMessage(message.chat.id, t('reading_processing', loc));

  let interpretation: string;
  try {
    interpretation = await cardOfDay({
      name: user.name ?? 'друг',
      zodiac: user.zodiacSign,
      cardName: card.name,
      reversed: card.reversed,
    });
  } catch (e) {
    console.warn('[daily] card_of_day_llm_failed', e);
    const revNote = card.reversed ? ' (перевёрнута)' : '';
    interpretation =
      `🃏 ${card.name}${revNote}\n\n` + t('card_of_day_fallback', loc);
  }

  await db.reading.create({
    data: {
      userId: user.id,
      type: 'card_of_day',
      cards: cardsToJSON(cards),
      interpretation,
      cost: 0,
    },
  });
  await db.user.update({
    where: { id: user.id },
    data: { lastDailyCardAt: now },
  });

  if (bonusInfo.bonus > 0) {
    await sendMessage(
      message.chat.id,
      t('daily_bonus_received', loc, { days: bonusInfo.streak }),
    );
  }

  const revNote = card.reversed ? ' (перевёрнута)' : '';
  await sendMessage(
    message.chat.id,
    `🃏 ${card.name}${revNote}\n\n${interpretation}`,
    { reply_markup: mainMenuKeyboard(user, loc) },
  );
}


