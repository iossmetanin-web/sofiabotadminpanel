// presentation/middleware.ts — grammY middleware for cross-cutting concerns.
// Per Skill §5: logging, session, typing, rate limit, error boundary.

import type { Bot, Context, NextFunction } from "grammy";
import { childLogger } from "../infrastructure/logger.js";
import type { UserRepository } from "../application/ports.js";
import { DomainError, LLMError, LLMTimeoutError, LLMRateLimitError, LLMContentFilterError } from "../domain/exceptions.js";

// Bind correlation context + log every update.
export function loggingMiddleware() {
  return async (ctx: Context, next: NextFunction) => {
    const log = childLogger({
      correlation_id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      user_id: ctx.from?.id?.toString() ?? "unknown",
      chat_id: ctx.chat?.id?.toString() ?? "unknown",
      update_type: ctx.update.update_id ? Object.keys(ctx.update).find((k) => k !== "update_id") ?? "unknown" : "unknown",
    });
    (ctx as any).log = log;
    const t0 = Date.now();
    log.debug("update received");
    try {
      await next();
      log.debug({ ms: Date.now() - t0 }, "update processed");
    } catch (e) {
      log.error({ err: e, ms: Date.now() - t0 }, "update failed");
      throw e;
    }
  };
}

// Per-user rate limiting (in-memory sliding window). Single-process bot, so OK.
const rateBuckets = new Map<string, number[]>(); // key: telegramId -> timestamps
export function rateLimitMiddleware(maxPerMinute = 30) {
  const windowMs = 60_000;
  return async (ctx: Context, next: NextFunction) => {
    const key = ctx.from?.id?.toString();
    if (!key) return next();
    const now = Date.now();
    const arr = (rateBuckets.get(key) ?? []).filter((t) => now - t < windowMs);
    if (arr.length >= maxPerMinute) {
      if (ctx.callbackQuery) {
        await ctx.answerCallbackQuery({ text: "Слишком быстро, милый. Минутку передохни.", show_alert: false });
      } else if (ctx.message) {
        await ctx.reply("Слишком быстро, милый. Минутку передохни. 🌙");
      }
      return;
    }
    arr.push(now);
    rateBuckets.set(key, arr);
    return next();
  };
}

// Typing indicator loop — sends "typing" every 4s until the handler completes.
export function typingMiddleware() {
  return async (ctx: Context, next: NextFunction) => {
    if (!ctx.chat) return next();
    const chatId = ctx.chat.id;
    let active = true;
    const sendTyping = async () => {
      while (active) {
        try { await ctx.api.sendChatAction(chatId, "typing"); } catch { /* ignore */ }
        await new Promise((r) => setTimeout(r, 4000));
      }
    };
    const loop = setTimeout(() => { void sendTyping(); }, 300);
    try {
      await next();
    } finally {
      active = false;
      clearTimeout(loop);
    }
  };
}

// Hydrate user from DB into ctx.user + ctx.userDto. Creates user on first /start.
export function userHydrationMiddleware(userRepo: UserRepository) {
  return async (ctx: Context, next: NextFunction) => {
    const tgId = ctx.from?.id?.toString();
    if (tgId) {
      const user = await userRepo.findByTelegramId(tgId);
      (ctx as any).userDto = user; // may be null — handlers decide
    }
    return next();
  };
}

// Error boundary — catches domain errors, shows Sofia-voice message.
export function errorBoundaryMiddleware() {
  return async (ctx: Context, next: NextFunction) => {
    try {
      await next();
    } catch (e) {
      const log = (ctx as any).log ?? console;
      if (e instanceof DomainError) {
        log.warn({ err: e }, "domain error");
        const msg = userMessageForError(e);
        try {
          if (ctx.callbackQuery) await ctx.answerCallbackQuery({ text: msg, show_alert: false });
          else if (ctx.message) await ctx.reply(msg);
        } catch { /* ignore */ }
      } else {
        log.error({ err: e }, "unexpected error");
        try {
          if (ctx.callbackQuery) await ctx.answerCallbackQuery({ text: "Что-то сбилось во взгляде. Попробуй ещё раз.", show_alert: false });
          else if (ctx.message) await ctx.reply("Что-то сбилось во взгляде, милый. Попробуй ещё раз, или начни с /start.");
        } catch { /* ignore */ }
      }
    }
  };
}

function userMessageForError(e: DomainError): string {
  if (e instanceof LLMTimeoutError) return "Туман сегодня густой, милый. Дай мне миг…";
  if (e instanceof LLMRateLimitError) return "Много говорим сегодня. Минутку передохни. 🌙";
  if (e instanceof LLMContentFilterError) return "Что-то в твоих словах я не смогла разобрать. Перескажи иначе?";
  if (e instanceof LLMError) return "Голос мой сегодня тих. Загляни чуть позже?";
  if (e.name === "InsufficientCrystalsError") return "Кристаллы закончились, но я не оставлю тебя. 🌙";
  if (e.name === "CooldownActiveError") return "Луна ещё не встала. Загляни позже. 🌙";
  return "Что-то пошло не так. Попробуй ещё раз, или /start.";
}
