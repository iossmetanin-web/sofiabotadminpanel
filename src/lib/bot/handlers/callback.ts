// Callback query router — handles all inline button presses.
// Callback data convention: "ns:action[:payload]".
// Ported from python-bot/app/handlers/callback.py.

import { db } from '@/lib/db';
import type { TelegramCallbackQuery } from '../types';
import {
  answerCallbackQuery,
  sendMessage,
  editMessageText,
} from '../telegram';
import {
  mainMenuKeyboard,
  readingMenuKeyboard,
  readingNumbersKeyboard,
  buyMenuKeyboard,
  adminPanelKeyboard,
  languageKeyboard,
  referralKeyboard,
  backHomeKeyboard,
  deleteConfirmKeyboard,
  usersPaginationKeyboard,
  historyPaginationKeyboard,
} from '../keyboards';
import { t, localeLabel, type Locale } from '../i18n';
import { findUserByTelegramId, isAdmin } from './_helpers';
import { startReadingFlow, cancelReading } from './readings';
import { formatProfile, handleBalance } from './profile';
import { renderStats, renderUsersPage } from './admin';
import { formatMemoryForUser } from '../services/memory';
import * as crystals from '../services/crystals';
import { affirmation } from '../services/ai';
import type { User } from '@prisma/client';

export async function handleCallback(query: TelegramCallbackQuery): Promise<void> {
  if (!query.from || !query.data) {
    if (query.id) await answerCallbackQuery(query.id);
    return;
  }
  const data = query.data;
  const tgId = String(query.from.id);

  // Always answer the callback first (dismiss spinner).
  await answerCallbackQuery(query.id);

  const user = await findUserByTelegramId(tgId);
  if (!user) {
    try {
      await sendMessage(tgId, t('err_unknown_user', 'ru'));
    } catch {
      /* ignore */
    }
    return;
  }

  const loc = (user.language as Locale) ?? 'ru';
  const parts = data.split(':');
  const ns = parts[0] ?? '';
  const action = parts[1] ?? '';
  const payload = parts[2] ?? '';

  try {
    switch (ns) {
      case 'nav':
        await handleNav(query, user, action, payload, loc);
        break;
      case 'rd':
        await handleReading(query, user, action, payload, loc);
        break;
      case 'buy':
        await handleBuy(query, user, action, loc);
        break;
      case 'admin':
        await handleAdminCallback(query, user, action, payload, loc);
        break;
      case 'lang':
        await handleLang(query, user, action, payload, loc);
        break;
      case 'share':
        await handleShare(query, user, payload, loc);
        break;
      default:
        console.warn('[callback] unknown', { data });
    }
  } catch (e) {
    console.error('[callback] failed', { data, err: e instanceof Error ? e.message : String(e) });
    try {
      await sendMessage(tgId, t('err_generic', loc));
    } catch {
      /* ignore */
    }
  }
}

// Edit the callback message in place, or send a new one if that fails.
async function editOrReply(
  query: TelegramCallbackQuery,
  text: string,
  opts: {
    reply_markup?: ReturnType<typeof mainMenuKeyboard>;
    parse_mode?: 'HTML';
  } = {},
): Promise<void> {
  const chatId = query.message?.chat.id;
  const messageId = query.message?.message_id;
  if (chatId && messageId) {
    try {
      await editMessageText(chatId, messageId, text, opts);
      return;
    } catch {
      // fall through to send
    }
  }
  await sendMessage(query.from.id, text, opts);
}

// ─── nav namespace ─────────────────────────────────────────────────────

async function handleNav(
  query: TelegramCallbackQuery,
  user: User,
  action: string,
  payload: string,
  loc: Locale,
): Promise<void> {
  const chatId = query.from.id;

  if (action === 'menu' || action === 'back' || action === 'later') {
    await db.user.update({
      where: { id: user.id },
      data: { onboardingStep: 'CONVERSATION' },
    });
    const text =
      action === 'later'
        ? (loc === 'en' ? 'Very well, I will wait. 🌙' : 'Хорошо, я подожду. 🌙')
        : t('menu_title', loc);
    await editOrReply(query, text, { reply_markup: mainMenuKeyboard(user, loc) });
    return;
  }

  if (action === 'profile') {
    await editOrReply(query, formatProfile(user, loc), {
      parse_mode: 'HTML',
      reply_markup: mainMenuKeyboard(user, loc),
    });
    return;
  }

  if (action === 'balance') {
    // Reuse profile handler logic.
    await handleBalance({ chat: { id: chatId }, from: query.from } as never);
    return;
  }

  if (action === 'memory') {
    const text = await formatMemoryForUser(user.id, user.lastTopicSummary);
    await editOrReply(query, text, {
      parse_mode: 'HTML',
      reply_markup: mainMenuKeyboard(user, loc),
    });
    return;
  }

  if (action === 'help') {
    await editOrReply(query, t('help_body', loc), {
      reply_markup: backHomeKeyboard(loc),
    });
    return;
  }

  if (action === 'referral') {
    const botUsername = process.env.BOT_USERNAME ?? 'oracultetris_bot';
    const link = `https://t.me/${botUsername}?start=ref_${user.referralCode}`;
    const text = `${t('referral_title', loc)}\n\n${t('referral_body', loc, { link })}`;
    await editOrReply(query, text, {
      parse_mode: 'HTML',
      reply_markup: referralKeyboard(user.referralCode, loc),
    });
    return;
  }

  if (action === 'subscription') {
    const subUntil = user.subscriptionUntil;
    const subType = user.subscriptionType;
    const active =
      subType && subUntil && new Date(subUntil).getTime() > Date.now();
    const line = active
      ? t('subscription_active_until', loc, {
          until: new Date(subUntil!).toISOString().slice(0, 10),
        })
      : t('subscription_none', loc);
    const text = `${t('subscription_title', loc)}\n\n${line}`;
    await editOrReply(query, text, {
      parse_mode: 'HTML',
      reply_markup: buyMenuKeyboard(loc),
    });
    return;
  }

  if (action === 'affirmation') {
    let body = t('affirmation_fallback', loc);
    try {
      const txt = await affirmation(loc);
      if (txt) body = txt;
    } catch (e) {
      console.warn('[callback] affirmation failed', e);
    }
    await editOrReply(
      query,
      `${t('affirmation_intro', loc)}\n\n${body}`,
      { reply_markup: mainMenuKeyboard(user, loc) },
    );
    return;
  }

  if (action === 'delete') {
    await db.user.update({
      where: { id: user.id },
      data: { onboardingStep: 'AWAIT_DELETE_CONFIRM' },
    });
    const text =
      t('profile_delete_confirm_title', loc) +
      '\n\n' +
      t('profile_delete_confirm_body', loc);
    await editOrReply(query, text, {
      parse_mode: 'HTML',
      reply_markup: deleteConfirmKeyboard(loc),
    });
    return;
  }

  if (action === 'cancel_delete') {
    await db.user.update({
      where: { id: user.id },
      data: { onboardingStep: 'CONVERSATION' },
    });
    await editOrReply(query, t('profile_delete_cancelled', loc), {
      reply_markup: mainMenuKeyboard(user, loc),
    });
    return;
  }

  if (action === 'confirm_delete') {
    await db.user.delete({ where: { id: user.id } });
    await db.auditLog.create({
      data: {
        actorId: user.id,
        action: 'delete_own_data',
        targetUserId: user.id,
      },
    });
    await editOrReply(query, t('profile_deleted', loc));
    return;
  }

  if (action === 'history') {
    const page = Number.parseInt(payload, 10) || 1;
    await showHistory(query, user, page, loc);
    return;
  }

  if (action === 'none') {
    // Static label button — do nothing.
    return;
  }
}

async function showHistory(
  query: TelegramCallbackQuery,
  user: User,
  page: number,
  loc: Locale,
): Promise<void> {
  const limit = 5;
  const total = await db.reading.count({ where: { userId: user.id } });
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.max(1, Math.min(page, totalPages));
  const offset = (safePage - 1) * limit;
  const items = await db.reading.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    skip: offset,
    take: limit,
    select: { type: true, interpretation: true, createdAt: true },
  });
  if (items.length === 0) {
    await editOrReply(query, t('history_empty', loc), {
      reply_markup: readingMenuKeyboard(loc),
    });
    return;
  }
  const lines = [t('history_page', loc, { page: safePage, total: totalPages }), ''];
  items.forEach((r, i) => {
    const preview = (r.interpretation ?? '').replace(/\n/g, ' ').slice(0, 80);
    const dateStr = new Date(r.createdAt).toISOString().slice(0, 16).replace('T', ' ');
    lines.push(`${offset + i + 1}. [${r.type}] ${dateStr}\n   ${preview}…`);
  });
  await editOrReply(query, lines.join('\n\n'), {
    reply_markup: historyPaginationKeyboard(safePage, totalPages, loc),
  });
}

// ─── rd namespace (readings) ───────────────────────────────────────────

async function handleReading(
  query: TelegramCallbackQuery,
  user: User,
  action: string,
  payload: string,
  loc: Locale,
): Promise<void> {
  if (action === 'menu') {
    await editOrReply(query, t('reading_menu_title', loc), {
      reply_markup: readingMenuKeyboard(loc),
    });
    return;
  }

  if (action === 'pick') {
    // payload = reading_type
    if (!query.message) return;
    await startReadingFlow(query.message, user, payload);
    return;
  }

  if (action === 'random') {
    if (!query.message) return;
    await startReadingFlow(query.message, user, payload, { useRandom: true });
    return;
  }

  if (action === 'cardday') {
    await sendMessage(
      query.from.id,
      loc === 'en'
        ? 'Use /daily to draw your card of the day. 🌟'
        : 'Используй /daily, чтобы вытянуть карту дня. 🌟',
      { reply_markup: mainMenuKeyboard(user, loc) },
    );
    return;
  }

  if (action === 'freecard') {
    if (!query.message) return;
    await startReadingFlow(query.message, user, 'single_card', { useRandom: true });
    return;
  }

  if (action === 'cancel') {
    if (!query.message) return;
    await cancelReading(query.message.chat.id, user);
    return;
  }
}

// ─── buy namespace ─────────────────────────────────────────────────────

async function handleBuy(
  query: TelegramCallbackQuery,
  user: User,
  action: string,
  loc: Locale,
): Promise<void> {
  if (action === 'weekly' || action === 'monthly') {
    const days = action === 'weekly' ? 7 : 30;
    await crystals.applySubscription(user.id, action, days);
    const fresh = await db.user.findUnique({
      where: { id: user.id },
      select: { subscriptionUntil: true },
    });
    const untilStr = fresh?.subscriptionUntil
      ? new Date(fresh.subscriptionUntil).toISOString().slice(0, 10)
      : '?';
    const text =
      loc === 'en'
        ? `⭐ Subscription active: ${action} until ${untilStr}.`
        : `⭐ Подписка активна: ${action} до ${untilStr}.`;
    await editOrReply(query, text, { reply_markup: mainMenuKeyboard(user, loc) });
    return;
  }
  await editOrReply(query, t('billing_buy_soon', loc), {
    reply_markup: buyMenuKeyboard(loc),
  });
}

// ─── admin namespace ───────────────────────────────────────────────────

async function handleAdminCallback(
  query: TelegramCallbackQuery,
  user: User,
  action: string,
  payload: string,
  loc: Locale,
): Promise<void> {
  if (!isAdmin(user.telegramId)) {
    await editOrReply(query, t('admin_forbidden', loc));
    return;
  }
  if (action === 'panel') {
    await db.user.update({
      where: { id: user.id },
      data: { onboardingStep: 'ADMIN_PANEL' },
    });
    await editOrReply(query, t('admin_panel_title', loc), {
      parse_mode: 'HTML',
      reply_markup: adminPanelKeyboard(loc),
    });
    return;
  }
  if (action === 'stats') {
    const text = await renderStats(loc);
    await editOrReply(query, text, {
      parse_mode: 'HTML',
      reply_markup: adminPanelKeyboard(loc),
    });
    return;
  }
  if (action === 'users') {
    const page = Number.parseInt(payload, 10) || 1;
    const { text, totalPages } = await renderUsersPage(page, loc);
    await editOrReply(query, text, {
      parse_mode: 'HTML',
      reply_markup: usersPaginationKeyboard(page, totalPages, loc),
    });
    return;
  }
  if (action === 'add') {
    await editOrReply(query, t('admin_add_format', loc), {
      reply_markup: adminPanelKeyboard(loc),
    });
    return;
  }
  if (action === 'broadcast') {
    const hint =
      loc === 'en' ? 'Use /broadcast TEXT' : 'Используй /broadcast ТЕКСТ';
    await editOrReply(
      query,
      `${t('admin_broadcast_prompt', loc)}\n\n(${hint})`,
      { reply_markup: adminPanelKeyboard(loc) },
    );
    return;
  }
  if (action === 'none') {
    return;
  }
}

// ─── lang namespace ────────────────────────────────────────────────────

async function handleLang(
  query: TelegramCallbackQuery,
  user: User,
  action: string,
  payload: string,
  loc: Locale,
): Promise<void> {
  if (action === 'menu') {
    await editOrReply(query, t('lang_select', loc), {
      reply_markup: languageKeyboard(loc),
    });
    return;
  }
  if (action === 'set') {
    if (payload !== 'ru' && payload !== 'en') return;
    await db.user.update({ where: { id: user.id }, data: { language: payload } });
    const text = t('lang_changed', payload, { lang: localeLabel(payload) });
    await editOrReply(query, `${text}\n\n${t('menu_title', payload)}`, {
      reply_markup: mainMenuKeyboard({ isAdmin: user.isAdmin }, payload),
    });
    return;
  }
}

// ─── share namespace ───────────────────────────────────────────────────

async function handleShare(
  query: TelegramCallbackQuery,
  user: User,
  code: string,
  loc: Locale,
): Promise<void> {
  const botUsername = process.env.BOT_USERNAME ?? 'oracultetris_bot';
  const link = `https://t.me/${botUsername}?start=ref_${code}`;
  await editOrReply(
    query,
    `${t('referral_title', loc)}\n\n<code>${link}</code>`,
    { parse_mode: 'HTML', reply_markup: referralKeyboard(code, loc) },
  );
}

// `handleMemory` re-exported for the index router to use as a /memory command.
// (imported directly from ./memory in index.ts)
