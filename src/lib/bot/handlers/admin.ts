// /admin — admin-only panel + stats.

import { db } from '@/lib/db';
import type { TelegramMessage } from '../types';
import { sendMessage } from '../telegram';
import { adminPanelKeyboard } from '../keyboards';
import { t, type Locale } from '../i18n';
import { findUserByTelegramId, isAdmin } from './_helpers';

export async function handleAdmin(message: TelegramMessage): Promise<void> {
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
  if (!isAdmin(tgId)) {
    await sendMessage(message.chat.id, t('admin_forbidden', loc));
    return;
  }
  await db.user.update({
    where: { id: user.id },
    data: { onboardingStep: 'ADMIN_PANEL' },
  });
  const stats = await renderStats(loc);
  await sendMessage(message.chat.id, stats, {
    parse_mode: 'HTML',
    reply_markup: adminPanelKeyboard(loc),
  });
}

/** Build the admin stats block (users, active 24h, readings, crystals). */
export async function renderStats(loc: Locale): Promise<string> {
  const since24h = new Date(Date.now() - 86_400_000);
  const [totalUsers, active24h, totalReadings, crystalsAgg] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { lastSeenAt: { gte: since24h } } }),
    db.reading.count(),
    db.user.aggregate({ _sum: { crystals: true } }),
  ]);
  const lines = [
    t('admin_panel_title', loc),
    `${t('admin_stats_users', loc)}: ${totalUsers}`,
    `${t('admin_stats_active24', loc)}: ${active24h}`,
    `${t('admin_stats_readings', loc)}: ${totalReadings}`,
    `${t('admin_stats_crystals', loc)}: ${crystalsAgg._sum.crystals ?? 0} 💎`,
  ];
  return lines.join('\n');
}

/** Render a page of users for the admin panel. */
export async function renderUsersPage(
  page: number,
  loc: Locale,
): Promise<{ text: string; totalPages: number }> {
  const limit = 10;
  const total = await db.user.count();
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const offset = (page - 1) * limit;
  const users = await db.user.findMany({
    orderBy: { createdAt: 'desc' },
    skip: offset,
    take: limit,
    select: {
      telegramId: true,
      name: true,
      firstName: true,
      username: true,
      crystals: true,
      createdAt: true,
      onboardingCompleted: true,
    },
  });
  const lines = [
    loc === 'en' ? '👥 <b>Users</b>' : '👥 <b>Пользователи</b>',
    `Page ${page} / ${totalPages}`,
    '',
  ];
  for (const u of users) {
    const name = u.name ?? u.firstName ?? u.username ?? u.telegramId;
    const status = u.onboardingCompleted ? '✓' : '…';
    lines.push(`${status} ${name} — ${u.crystals} 💎 (${u.telegramId})`);
  }
  return { text: lines.join('\n'), totalPages };
}

/** Send the admin panel (used from callback). */
export async function sendAdminPanel(
  chatId: number,
  user: { id: string; language: string },
): Promise<void> {
  const loc = (user.language as Locale) ?? 'ru';
  const stats = await renderStats(loc);
  await sendMessage(chatId, stats, {
    parse_mode: 'HTML',
    reply_markup: adminPanelKeyboard(loc),
  });
}



