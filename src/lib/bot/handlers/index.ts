// Main update router — entry point for /api/telegram/webhook.
//
//   handleUpdate(update) → routes by update.message.text or update.callback_query.data
//
// State is in DB (User.onboardingStep), not in memory — survives across
// webhook invocations.

import { db } from '@/lib/db';
import type { TelegramUpdate, TelegramMessage, TelegramCallbackQuery } from '../types';
import { sendMessage } from '../telegram';
import { t, type Locale } from '../i18n';
import { findUserByTelegramId, isAdmin } from './_helpers';
import { handleStart, handleOnboardingMessage } from './start';
import { handleHelp } from './help';
import { handleDaily } from './daily';
import { handleReadings, handleReadingNumbersMessage } from './readings';
import { handleProfile } from './profile';
import { handleReferral } from './referral';
import { handleMemory } from './memory';
import { handleSubscription } from './subscription';
import { handleAdmin } from './admin';
import { handleCallback } from './callback';
import { mainMenuKeyboard } from '../keyboards';

// Heartbeat: write to BotHeartbeat singleton on each update so the admin
// panel can show "online" status even in webhook mode.
async function touchHeartbeat(): Promise<void> {
  try {
    await db.botHeartbeat.upsert({
      where: { id: 'singleton' },
      update: {
        lastBeatAt: new Date(),
        pollingMode: 'webhook',
      },
      create: {
        id: 'singleton',
        lastBeatAt: new Date(),
        pollingMode: 'webhook',
      },
    });
  } catch (e) {
    console.warn('[heartbeat] touch failed', e);
  }
}

/** Master update handler. Always resolves (never throws) so the webhook can return 200. */
export async function handleUpdate(update: TelegramUpdate): Promise<void> {
  if (!update) return;
  await touchHeartbeat();

  try {
    if (update.message) {
      await dispatchMessage(update.message);
    } else if (update.callback_query) {
      await handleCallback(update.callback_query);
    } else if (update.edited_message) {
      // Edited messages — ignore for now (no-op).
    }
  } catch (e) {
    console.error('[handleUpdate] unhandled error', e);
  }
}

async function dispatchMessage(message: TelegramMessage): Promise<void> {
  if (!message.from || !message.text) return;
  const text = message.text.trim();
  const tgId = String(message.from.id);

  // Update message counter (best-effort).
  try {
    const user = await findUserByTelegramId(tgId);
    if (user) {
      // Track daily message count.
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const dailyReset =
        user.dailyMessageDate &&
        new Date(user.dailyMessageDate).getTime() < today.getTime();
      await db.user.update({
        where: { id: user.id },
        data: {
          messageCount: { increment: 1 },
          dailyMessageCount: dailyReset ? 1 : { increment: 1 },
          dailyMessageDate: today,
        },
      });
    }
  } catch {
    /* ignore */
  }

  // Command routing.
  if (text.startsWith('/')) {
    const [cmdRaw, ...rest] = text.split(/\s+/);
    const cmd = cmdRaw.replace(/^\/+/, '').toLowerCase().split('@')[0]; // strip @botname
    const args = rest.join(' ');
    switch (cmd) {
      case 'start':
        await handleStart(message);
        return;
      case 'help':
        await handleHelp(message);
        return;
      case 'daily':
        await handleDaily(message);
        return;
      case 'readings':
        await handleReadings(message);
        return;
      case 'profile':
        await handleProfile(message);
        return;
      case 'memory':
        await handleMemory(message);
        return;
      case 'referral':
        await handleReferral(message);
        return;
      case 'subscription':
        await handleSubscription(message);
        return;
      case 'admin':
        await handleAdmin(message);
        return;
      case 'cancel':
        await handleCancelCommand(message);
        return;
      case 'broadcast':
        await handleBroadcastCommand(message, args);
        return;
      case 'gift':
        await handleGiftCommand(message, args);
        return;
      default:
        // Unknown command — fall through to FSM / echo.
        break;
    }
  }

  // FSM: onboarding states.
  const handledOnboarding = await handleOnboardingMessage(message);
  if (handledOnboarding) return;

  // FSM: AWAIT_NUMBERS (tarot reading flow).
  const handledNumbers = await handleReadingNumbersMessage(message);
  if (handledNumbers) return;

  // FSM: DREAM state.
  const user = await findUserByTelegramId(tgId);
  if (user && user.onboardingStep === 'DREAM') {
    await handleDreamMessage(message, user);
    return;
  }

  // FSM: AWAIT_DELETE_CONFIRM.
  if (user && user.onboardingStep === 'AWAIT_DELETE_CONFIRM') {
    // Treat anything as a non-confirm → cancel.
    await db.user.update({
      where: { id: user.id },
      data: { onboardingStep: 'CONVERSATION' },
    });
    const loc = (user.language as Locale) ?? 'ru';
    await sendMessage(
      message.chat.id,
      t('profile_delete_cancelled', loc),
      { reply_markup: mainMenuKeyboard(user, loc) },
    );
    return;
  }

  // Default: Sofia echo (light response).
  await handleEcho(message, user);
}

async function handleEcho(
  message: TelegramMessage,
  user: { id: string; language: string; onboardingCompleted: boolean; isAdmin: boolean } | null,
): Promise<void> {
  const loc = (user?.language as Locale) ?? 'ru';
  // If user hasn't finished onboarding — re-trigger /start flow.
  if (user && !user.onboardingCompleted) {
    await handleStart(message);
    return;
  }
  // Lightweight echo — invite the user to /readings.
  await sendMessage(
    message.chat.id,
    loc === 'en'
      ? "I'm listening. /readings — for a spread, /daily — for the card of the day. 🌙"
      : 'Я слушаю. /readings — расклад, /daily — карта дня. 🌙',
    { reply_markup: user ? mainMenuKeyboard({ isAdmin: user.isAdmin }, loc) : undefined },
  );
}

async function handleCancelCommand(message: TelegramMessage): Promise<void> {
  if (!message.from) return;
  const tgId = String(message.from.id);
  const user = await findUserByTelegramId(tgId);
  if (!user) {
    await sendMessage(message.chat.id, t('err_unknown_user', 'ru'));
    return;
  }
  const loc = (user.language as Locale) ?? 'ru';
  await db.user.update({
    where: { id: user.id },
    data: { onboardingStep: 'CONVERSATION', lastTopicSummary: null },
  });
  await sendMessage(message.chat.id, t('cancel_done', loc), {
    reply_markup: mainMenuKeyboard(user, loc),
  });
}

async function handleBroadcastCommand(
  message: TelegramMessage,
  args: string,
): Promise<void> {
  if (!message.from) return;
  const tgId = String(message.from.id);
  if (!isAdmin(tgId)) {
    await sendMessage(message.chat.id, t('admin_forbidden', 'ru'));
    return;
  }
  const text = args.trim();
  if (!text) {
    await sendMessage(
      message.chat.id,
      'Используй: /broadcast ТЕКСТ',
    );
    return;
  }
  // Enqueue broadcast via BotCommand queue (admin panel will pick up the same way).
  await db.botCommand.create({
    data: {
      type: 'broadcast',
      payload: JSON.stringify({ text, adminId: tgId }),
      status: 'pending',
    },
  });
  await sendMessage(
    message.chat.id,
    '✅ Рассылка поставлена в очередь. Администратор увидит прогресс в админ-панели.',
  );
}

async function handleGiftCommand(
  message: TelegramMessage,
  args: string,
): Promise<void> {
  if (!message.from) return;
  const tgId = String(message.from.id);
  if (!isAdmin(tgId)) {
    await sendMessage(message.chat.id, t('admin_forbidden', 'ru'));
    return;
  }
  const parts = args.trim().split(/\s+/);
  if (parts.length < 2) {
    await sendMessage(message.chat.id, 'Используй: /gift <telegram_id> <amount>');
    return;
  }
  const targetTgId = parts[0];
  const amount = Number.parseInt(parts[1], 10);
  if (!Number.isFinite(amount) || amount <= 0) {
    await sendMessage(message.chat.id, 'Сумма должна быть положительным числом.');
    return;
  }
  const target = await findUserByTelegramId(targetTgId);
  if (!target) {
    await sendMessage(message.chat.id, `Пользователь ${targetTgId} не найден.`);
    return;
  }
  await db.botCommand.create({
    data: {
      type: 'gift_crystals',
      payload: JSON.stringify({ telegramId: targetTgId, amount, adminId: tgId }),
      status: 'pending',
    },
  });
  await sendMessage(
    message.chat.id,
    `✅ Подарок ${amount} 💎 пользователю ${targetTgId} поставлен в очередь.`,
  );
}

async function handleDreamMessage(
  message: TelegramMessage,
  user: { id: string; name: string | null; zodiacSign: string | null; language: string; telegramId: string },
): Promise<void> {
  if (!message.text) return;
  const loc = (user.language as Locale) ?? 'ru';
  await db.conversation.create({
    data: { userId: user.id, role: 'user', content: message.text.slice(0, 2000) },
  });
  await sendMessage(message.chat.id, t('reading_processing', loc));
  try {
    const { dreamInterpretation } = await import('../services/ai');
    const text = await dreamInterpretation({
      name: user.name ?? 'друг',
      zodiac: user.zodiacSign,
      dream: message.text,
    });
    await sendMessage(message.chat.id, text, {
      reply_markup: mainMenuKeyboard({ isAdmin: false }, loc),
    });
  } catch (e) {
    console.warn('[dream] llm_failed', e);
    await sendMessage(message.chat.id, t('reading_refunded', loc), {
      reply_markup: mainMenuKeyboard({ isAdmin: false }, loc),
    });
  }
  await db.user.update({
    where: { id: user.id },
    data: { onboardingStep: 'CONVERSATION' },
  });
}

export { handleCallback };
export type { TelegramCallbackQuery };
