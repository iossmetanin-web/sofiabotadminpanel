// /readings — 7 reading types + the reading flow FSM.
// Ported from python-bot/app/handlers/readings.py.
//
// Reading flow:
//   /readings → menu (callback rd:menu / rd:pick:<type> / rd:random:<type>)
//   tarot_*   → ask N numbers OR draw random → finalize reading
//   horoscope → LLM straight (no cards)
//   fate_card → LLM straight (no cards, post-onboarding)

import { db } from '@/lib/db';
import type { TelegramMessage } from '../types';
import { sendMessage } from '../telegram';
import { mainMenuKeyboard, readingMenuKeyboard, readingNumbersKeyboard, buyMenuKeyboard } from '../keyboards';
import { t, type Locale } from '../i18n';
import { findUserByTelegramId, readingPrice, splitMessage } from './_helpers';
import * as crystals from '../services/crystals';
import {
  SPREADS,
  drawRandomCards,
  formatCardsForPrompt,
  getCardByNumber,
  parseUserNumbers,
  cardsToJSON,
  type TarotCard,
} from '../services/tarot';
import { fateCard, horoscope, tarotReading } from '../services/ai';
import { summarizeForPrompt } from '../services/memory';
import type { User } from '@prisma/client';

/** /readings — show the menu. */
export async function handleReadings(message: TelegramMessage): Promise<void> {
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
  await db.user.update({
    where: { id: user.id },
    data: { onboardingStep: 'CONVERSATION' },
  });
  await sendMessage(message.chat.id, t('reading_menu_title', loc), {
    reply_markup: readingMenuKeyboard(loc),
  });
}

/**
 * Start a reading flow from a callback (rd:pick:<type> / rd:random:<type>).
 * `useRandom=true` skips the numbers prompt and draws automatically.
 */
export async function startReadingFlow(
  message: TelegramMessage,
  user: User,
  readingType: string,
  opts: { useRandom?: boolean } = {},
): Promise<void> {
  const loc = (user.language as Locale) ?? 'ru';
  if (!(readingType in SPREADS)) {
    await sendMessage(message.chat.id, t('err_unknown_callback', loc));
    return;
  }

  const spread = SPREADS[readingType];
  const price = readingPrice(readingType);

  // Check balance (free: card_of_day, single_card).
  if (price > 0) {
    const ok = await crystals.spendCrystals(
      user.id,
      price,
      `Расклад ${readingType}`,
    );
    if (!ok) {
      await sendMessage(
        message.chat.id,
        t('billing_low_balance', loc, { count: price }),
        { reply_markup: buyMenuKeyboard(loc) },
      );
      return;
    }
  }

  // horoscope — no cards.
  if (readingType === 'horoscope') {
    await sendMessage(message.chat.id, t('reading_processing', loc));
    try {
      const text = await horoscope(user.name ?? 'друг', user.zodiacSign);
      await db.reading.create({
        data: {
          userId: user.id,
          type: readingType,
          cards: '[]',
          interpretation: text,
          cost: price,
        },
      });
      await sendMessage(message.chat.id, text, {
        reply_markup: mainMenuKeyboard(user, loc),
      });
    } catch (e) {
      console.warn('[readings] horoscope_llm_failed', e);
      await refundAndApologise(message, user, loc, price, readingType);
    }
    return;
  }

  // fate_card — no cards (post-onboarding re-read).
  if (readingType === 'fate_card') {
    await sendMessage(message.chat.id, t('reading_processing', loc));
    try {
      const text = await fateCard(
        user.name ?? 'друг',
        user.zodiacSign,
        '(повторный расклад)',
      );
      await db.reading.create({
        data: {
          userId: user.id,
          type: readingType,
          cards: '[]',
          interpretation: text,
          cost: price,
        },
      });
      for (const chunk of splitMessage(text, 4000)) {
        await sendMessage(message.chat.id, chunk);
      }
      await sendMessage(message.chat.id, t('reading_done', loc), {
        reply_markup: mainMenuKeyboard(user, loc),
      });
    } catch (e) {
      console.warn('[readings] fate_card_llm_failed', e);
      await refundAndApologise(message, user, loc, price, readingType);
    }
    return;
  }

  // Tarot spreads — need user-supplied numbers (or random).
  if (opts.useRandom) {
    const cards = drawRandomCards(spread.cardCount, loc);
    await finalizeReading(message, user, readingType, cards, price);
    return;
  }

  // Ask user for numbers.
  await db.user.update({
    where: { id: user.id },
    data: {
      onboardingStep: 'AWAIT_NUMBERS',
      lastTopicSummary: `__reading:${readingType}:${price}`,
    },
  });
  await sendMessage(
    message.chat.id,
    t('reading_ask_numbers', loc, { count: spread.cardCount }),
    { reply_markup: readingNumbersKeyboard(readingType, loc) },
  );
}

async function finalizeReading(
  message: TelegramMessage,
  user: User,
  readingType: string,
  cards: TarotCard[],
  price: number,
): Promise<void> {
  const loc = (user.language as Locale) ?? 'ru';
  const spread = SPREADS[readingType];
  // Attach positions.
  const positionedCards: TarotCard[] = cards.map((c, i) => ({
    name: c.name,
    reversed: c.reversed,
    position: i < spread.positions.length ? spread.positions[i] : null,
  }));
  const cardsWithPositions = formatCardsForPrompt(positionedCards, spread.positions, loc);
  await sendMessage(message.chat.id, t('reading_processing', loc));

  try {
    const memoryCtx = await summarizeForPrompt(user.id, 8);
    const interpretation = await tarotReading({
      name: user.name ?? 'друг',
      zodiac: user.zodiacSign,
      spreadName: spread.type,
      cardsWithPositions,
      memoryContext: memoryCtx,
    });
    await db.reading.create({
      data: {
        userId: user.id,
        type: readingType,
        cards: cardsToJSON(positionedCards),
        interpretation,
        cost: price,
      },
    });
    await db.user.update({
      where: { id: user.id },
      data: { onboardingStep: 'CONVERSATION', lastTopicSummary: readingType },
    });
    // Show cards first, then interpretation.
    const cardsStr = positionedCards
      .map((c) => {
        const rev = c.reversed ? ' (перевёрнута)' : '';
        const pos = c.position ? ` — ${c.position}` : '';
        return `🃏 ${c.name}${rev}${pos}`;
      })
      .join('\n');
    await sendMessage(message.chat.id, cardsStr);
    for (const chunk of splitMessage(interpretation, 4000)) {
      await sendMessage(message.chat.id, chunk);
    }
    await sendMessage(message.chat.id, t('reading_done', loc), {
      reply_markup: mainMenuKeyboard(user, loc),
    });
  } catch (e) {
    console.warn('[readings] tarot_llm_failed', e);
    await refundAndApologise(message, user, loc, price, readingType);
  }
}

async function refundAndApologise(
  message: TelegramMessage,
  user: User,
  loc: Locale,
  price: number,
  readingType: string,
): Promise<void> {
  if (price > 0) {
    await crystals.refundCrystals(user.id, price, `Расклад ${readingType} (сбой)`);
  }
  await db.user.update({
    where: { id: user.id },
    data: { onboardingStep: 'CONVERSATION' },
  });
  await sendMessage(message.chat.id, t('reading_refunded', loc), {
    reply_markup: mainMenuKeyboard(user, loc),
  });
}

/**
 * Handle non-command text in AWAIT_NUMBERS state. Returns true if handled.
 */
export async function handleReadingNumbersMessage(message: TelegramMessage): Promise<boolean> {
  if (!message.from || !message.text) return false;
  const tgId = String(message.from.id);
  const user = await findUserByTelegramId(tgId);
  if (!user) return false;
  if (user.onboardingStep !== 'AWAIT_NUMBERS') return false;
  const loc = (user.language as Locale) ?? 'ru';

  const topic = user.lastTopicSummary ?? '';
  if (!topic.startsWith('__reading:')) return false;
  const parts = topic.split(':');
  if (parts.length < 3) return false;
  const readingType = parts[1];
  const price = Number.parseInt(parts[2], 10);
  if (!(readingType in SPREADS)) {
    await db.user.update({
      where: { id: user.id },
      data: { onboardingStep: 'CONVERSATION' },
    });
    return false;
  }

  const spread = SPREADS[readingType];
  const numbers = parseUserNumbers(message.text, spread.cardCount);
  if (!numbers) {
    await sendMessage(
      message.chat.id,
      t('reading_ask_numbers', loc, { count: spread.cardCount }),
      { reply_markup: readingNumbersKeyboard(readingType, loc) },
    );
    return true;
  }

  const cards = numbers.map((n) => getCardByNumber(n, loc));
  await finalizeReading(message, user, readingType, cards, Number.isFinite(price) ? price : 0);
  return true;
}

/** Cancel an in-progress reading (rd:cancel callback). */
export async function cancelReading(
  chatId: number,
  user: User,
): Promise<void> {
  const loc = (user.language as Locale) ?? 'ru';
  await db.user.update({
    where: { id: user.id },
    data: {
      onboardingStep: 'CONVERSATION',
      lastTopicSummary: null,
    },
  });
  await sendMessage(chatId, t('cancel_done', loc), {
    reply_markup: mainMenuKeyboard(user, loc),
  });
}


