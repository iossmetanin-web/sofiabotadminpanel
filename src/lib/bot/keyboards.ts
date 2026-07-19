// Inline keyboards for the Sofia bot.
// Ported from python-bot/app/keyboards/inline.py.
//
// Callback data convention: "ns:action[:payload]".
//   nav:   navigation (menu, back, profile, balance, history, settings, help,
//          referral, delete, confirm_delete, cancel_delete, dream, affirmation)
//   rd:    readings (menu, pick:<type>, cardday, freecard, random:<type>)
//   buy:   buy menu (weekly, monthly, pack3, pack10, pack25)
//   admin: admin (panel, stats, users, users:<page>, add, broadcast)
//   lang:  language (menu, set:ru, set:en)
//   share: share referral link

import type { TelegramInlineKeyboardMarkup } from './types';
import type { Locale } from './i18n';
import { t } from './i18n';
import type { User } from '@prisma/client';

export type Kbd = TelegramInlineKeyboardMarkup;

function kbd(rows: Array<Array<{ text: string; callback_data?: string; url?: string }>>): Kbd {
  return { inline_keyboard: rows };
}

/** Main menu — shown after /start, /cancel, /readings etc. */
export function mainMenuKeyboard(user: Pick<User, 'isAdmin'>, locale: Locale = 'ru'): Kbd {
  const rows: Array<Array<{ text: string; callback_data?: string }>> = [
    [
      { text: t('menu_readings', locale), callback_data: 'rd:menu' },
      { text: t('menu_daily', locale), callback_data: 'rd:cardday' },
    ],
    [
      { text: t('menu_profile', locale), callback_data: 'nav:profile' },
      { text: t('menu_memory', locale), callback_data: 'nav:memory' },
    ],
    [
      { text: t('menu_referral', locale), callback_data: 'nav:referral' },
      { text: t('menu_subscription', locale), callback_data: 'nav:subscription' },
    ],
    [
      { text: t('menu_help', locale), callback_data: 'nav:help' },
    ],
  ];
  if (user.isAdmin) {
    rows.push([{ text: t('menu_admin', locale), callback_data: 'admin:panel' }]);
  }
  return kbd(rows);
}

export function homeOnlyKeyboard(locale: Locale = 'ru'): Kbd {
  return kbd([
    [{ text: t('menu_home', locale), callback_data: 'nav:menu' }],
  ]);
}

export function backHomeKeyboard(locale: Locale = 'ru'): Kbd {
  return kbd([
    [
      { text: t('menu_back', locale), callback_data: 'nav:back' },
      { text: t('menu_home', locale), callback_data: 'nav:menu' },
    ],
  ]);
}

export function languageKeyboard(_locale: Locale = 'ru'): Kbd {
  return kbd([
    [
      { text: 'Русский', callback_data: 'lang:set:ru' },
      { text: 'English', callback_data: 'lang:set:en' },
    ],
    [{ text: t('menu_home', 'ru'), callback_data: 'nav:menu' }],
  ]);
}

export function readingMenuKeyboard(locale: Locale = 'ru'): Kbd {
  return kbd([
    [{ text: t('reading_fate_card', locale), callback_data: 'rd:pick:fate_card' }],
    [
      { text: t('reading_tarot_small', locale), callback_data: 'rd:pick:tarot_small' },
      { text: t('reading_tarot_love', locale), callback_data: 'rd:pick:tarot_love' },
    ],
    [
      { text: t('reading_tarot_career', locale), callback_data: 'rd:pick:tarot_career' },
      { text: t('reading_tarot_decision', locale), callback_data: 'rd:pick:tarot_decision' },
    ],
    [
      { text: t('reading_tarot_full', locale), callback_data: 'rd:pick:tarot_full' },
      { text: t('reading_horoscope', locale), callback_data: 'rd:pick:horoscope' },
    ],
    [{ text: t('reading_cancel', locale), callback_data: 'rd:cancel' }],
  ]);
}

export function readingNumbersKeyboard(readingType: string, locale: Locale = 'ru'): Kbd {
  return kbd([
    [
      { text: t('reading_random', locale), callback_data: `rd:random:${readingType}` },
    ],
    [{ text: t('reading_cancel', locale), callback_data: 'rd:cancel' }],
  ]);
}

export function buyMenuKeyboard(locale: Locale = 'ru'): Kbd {
  return kbd([
    [{ text: t('subscription_weekly', locale), callback_data: 'buy:weekly' }],
    [{ text: t('subscription_monthly', locale), callback_data: 'buy:monthly' }],
    [{ text: t('menu_home', locale), callback_data: 'nav:menu' }],
  ]);
}

export function subscriptionKeyboard(locale: Locale = 'ru'): Kbd {
  return kbd([
    [{ text: t('subscription_weekly', locale), callback_data: 'buy:weekly' }],
    [{ text: t('subscription_monthly', locale), callback_data: 'buy:monthly' }],
    [{ text: t('menu_home', locale), callback_data: 'nav:menu' }],
  ]);
}

export function referralKeyboard(_referralCode: string, locale: Locale = 'ru'): Kbd {
  const botUsername = process.env.BOT_USERNAME ?? 'oracultetris_bot';
  const link = `https://t.me/${botUsername}?start=ref_${_referralCode}`;
  return kbd([
    [{ text: t('referral_share', locale), url: `https://t.me/share/url?url=${encodeURIComponent(link)}` }],
    [{ text: t('menu_home', locale), callback_data: 'nav:menu' }],
  ]);
}

export function deleteConfirmKeyboard(locale: Locale = 'ru'): Kbd {
  return kbd([
    [
      { text: '🗑 ' + (locale === 'en' ? 'Yes, delete' : 'Да, удалить'), callback_data: 'nav:confirm_delete' },
      { text: t('menu_back', locale), callback_data: 'nav:cancel_delete' },
    ],
  ]);
}

export function paidHookKeyboard(locale: Locale = 'ru'): Kbd {
  return kbd([
    [
      { text: t('reading_fate_card', locale), callback_data: 'rd:pick:fate_card' },
      { text: t('menu_subscription', locale), callback_data: 'nav:subscription' },
    ],
    [{ text: t('menu_home', locale), callback_data: 'nav:menu' }],
  ]);
}

export function adminPanelKeyboard(locale: Locale = 'ru'): Kbd {
  return kbd([
    [
      { text: '📊 ' + t('admin_stats_users', locale), callback_data: 'admin:stats' },
      { text: '👥 ' + (locale === 'en' ? 'Users' : 'Пользователи'), callback_data: 'admin:users' },
    ],
    [
      { text: '📢 ' + (locale === 'en' ? 'Broadcast' : 'Рассылка'), callback_data: 'admin:broadcast' },
      { text: '🎁 ' + (locale === 'en' ? 'Gift' : 'Подарить'), callback_data: 'admin:add' },
    ],
    [{ text: t('menu_home', locale), callback_data: 'nav:menu' }],
  ]);
}

export function historyPaginationKeyboard(
  page: number,
  totalPages: number,
  locale: Locale = 'ru',
): Kbd {
  const rows: Array<Array<{ text: string; callback_data?: string }>> = [];
  const navRow: Array<{ text: string; callback_data?: string }> = [];
  if (page > 1) {
    navRow.push({ text: '←', callback_data: `nav:history:${page - 1}` });
  }
  navRow.push({ text: `${page} / ${totalPages}`, callback_data: 'nav:none' });
  if (page < totalPages) {
    navRow.push({ text: '→', callback_data: `nav:history:${page + 1}` });
  }
  rows.push(navRow);
  rows.push([{ text: t('menu_home', locale), callback_data: 'nav:menu' }]);
  return kbd(rows);
}

export function usersPaginationKeyboard(
  page: number,
  totalPages: number,
  locale: Locale = 'ru',
): Kbd {
  const rows: Array<Array<{ text: string; callback_data?: string }>> = [];
  const navRow: Array<{ text: string; callback_data?: string }> = [];
  if (page > 1) {
    navRow.push({ text: '←', callback_data: `admin:users:${page - 1}` });
  }
  navRow.push({ text: `${page} / ${totalPages}`, callback_data: 'admin:none' });
  if (page < totalPages) {
    navRow.push({ text: '→', callback_data: `admin:users:${page + 1}` });
  }
  rows.push(navRow);
  rows.push([{ text: t('menu_back', locale), callback_data: 'admin:panel' }]);
  return kbd(rows);
}
