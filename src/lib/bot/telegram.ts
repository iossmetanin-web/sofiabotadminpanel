// Lightweight Telegram Bot API client built on fetch.
// No SDK — keeps the bundle small for Vercel serverless.
//
// All functions return the parsed JSON response from Telegram, or throw on
// network / API errors. Callers are expected to wrap in try/catch and
// degrade gracefully (the webhook handler must always return 200).

import type {
  TelegramInlineKeyboardMarkup,
  TelegramWebhookInfo,
  TelegramBotCommand,
} from './types';

export type { TelegramBotCommand };

const BOT_TOKEN = process.env.BOT_TOKEN ?? '';
const BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

/** Returns true if a bot token is configured. */
export function hasBotToken(): boolean {
  return Boolean(BOT_TOKEN);
}

/**
 * Verifies the X-Telegram-Bot-Api-Secret-Token header (optional).
 * Returns true if no secret is configured, or if the secret matches.
 */
export function verifyWebhookSecret(headerValue: string | null): boolean {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expected) return true; // no secret configured → skip check
  return headerValue === expected;
}

interface ApiError extends Error {
  ok: false;
  error_code?: number;
  description?: string;
}

async function call<T = unknown>(
  method: string,
  params?: Record<string, unknown>,
): Promise<T> {
  if (!BOT_TOKEN) {
    throw new Error(`BOT_TOKEN is not set (method: ${method})`);
  }
  const url = `${BASE}/${method}`;
  const init: RequestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  };
  if (params) init.body = JSON.stringify(params);

  const resp = await fetch(url, init);
  let data: unknown = null;
  try {
    data = await resp.json();
  } catch {
    /* ignore */
  }
  if (!resp.ok || (data && typeof data === 'object' && 'ok' in data && (data as { ok: boolean }).ok === false)) {
    const err = new Error(
      `Telegram ${method} failed: ${resp.status} ${resp.statusText}`,
    ) as ApiError;
    err.ok = false;
    err.error_code = resp.status;
    if (data && typeof data === 'object') {
      err.description = (data as { description?: string }).description;
    }
    throw err;
  }
  // Telegram success: { ok: true, result: ... }
  if (data && typeof data === 'object' && 'result' in data) {
    return (data as { result: T }).result;
  }
  return data as T;
}

// ─── sendMessage / editMessageText / answerCallbackQuery ───────────────

export async function sendMessage(
  chatId: number | string,
  text: string,
  opts?: {
    parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
    reply_markup?: TelegramInlineKeyboardMarkup;
    disable_web_page_preview?: boolean;
    disable_notification?: boolean;
    reply_to_message_id?: number;
  },
): Promise<{ message_id: number }> {
  return call<{ message_id: number }>('sendMessage', {
    chat_id: chatId,
    text,
    ...opts,
  });
}

export async function answerCallbackQuery(
  callbackQueryId: string,
  text?: string,
  showAlert?: boolean,
): Promise<void> {
  try {
    await call('answerCallbackQuery', {
      callback_query_id: callbackQueryId,
      text,
      show_alert: showAlert,
    });
  } catch (e) {
    // query ID may have expired or be invalid — swallow so the rest of the
    // callback handler can still send the response message.
    console.warn('[telegram] answerCallbackQuery failed:', e instanceof Error ? e.message : String(e));
  }
}

export async function editMessageText(
  chatId: number | string,
  messageId: number,
  text: string,
  opts?: {
    parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
    reply_markup?: TelegramInlineKeyboardMarkup;
    disable_web_page_preview?: boolean;
  },
): Promise<void> {
  try {
    await call('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text,
      ...opts,
    });
  } catch (e) {
    // "message is not modified" — harmless, ignore.
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('not modified')) return;
    throw e;
  }
}

export async function editMessageReplyMarkup(
  chatId: number | string,
  messageId: number,
  replyMarkup?: TelegramInlineKeyboardMarkup,
): Promise<void> {
  try {
    await call('editMessageReplyMarkup', {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: replyMarkup,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('not modified')) return;
    throw e;
  }
}

export async function sendPhoto(
  chatId: number | string,
  photo: string,
  opts?: {
    caption?: string;
    parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
    reply_markup?: TelegramInlineKeyboardMarkup;
  },
): Promise<{ message_id: number }> {
  return call<{ message_id: number }>('sendPhoto', {
    chat_id: chatId,
    photo,
    ...opts,
  });
}

export async function sendChatAction(
  chatId: number | string,
  action:
    | 'typing'
    | 'upload_photo'
    | 'record_video'
    | 'upload_video'
    | 'record_voice'
    | 'upload_voice'
    | 'upload_document'
    | 'find_location'
    | 'record_video_note'
    | 'upload_video_note',
): Promise<void> {
  await call('sendChatAction', { chat_id: chatId, action });
}

export async function setMyCommands(
  commands: TelegramBotCommand[],
): Promise<void> {
  await call('setMyCommands', { commands });
}

export async function deleteMessage(
  chatId: number | string,
  messageId: number,
): Promise<void> {
  try {
    await call('deleteMessage', { chat_id: chatId, message_id: messageId });
  } catch {
    /* ignore */
  }
}

export async function sendDice(
  chatId: number | string,
  emoji = '🎲',
): Promise<{ message_id: number }> {
  return call<{ message_id: number }>('sendDice', { chat_id: chatId, emoji });
}

export async function getUserProfilePhotos(
  userId: number,
  limit = 1,
): Promise<{ total_count: number; photos: unknown[][] }> {
  return call('getUserProfilePhotos', { user_id: userId, limit });
}

// ─── Webhook management ────────────────────────────────────────────────

export async function setWebhook(
  url: string,
  opts?: {
    secret_token?: string;
    max_connections?: number;
    allowed_updates?: string[];
  },
): Promise<void> {
  await call('setWebhook', { url, ...opts });
}

export async function deleteWebhook(): Promise<void> {
  await call('deleteWebhook');
}

export async function getWebhookInfo(): Promise<TelegramWebhookInfo> {
  return call<TelegramWebhookInfo>('getWebhookInfo');
}

export async function getMe(): Promise<{
  id: number;
  is_bot: boolean;
  first_name: string;
  username: string;
  can_join_groups: boolean;
  can_read_all_group_messages: boolean;
  supports_inline_queries: boolean;
}> {
  return call('getMe');
}
