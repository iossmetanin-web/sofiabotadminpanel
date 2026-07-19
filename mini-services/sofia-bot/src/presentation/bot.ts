// presentation/bot.ts — Bot instance + Composer wiring.
// Per Skill §5: router composition (one Composer per feature), middleware order,
// error boundary outermost.

import { Bot, Composer } from "grammy";
import { env, isAdmin } from "../config/env.js";
import { setDeps, deps, type Deps } from "./deps.js";
import { logger } from "../infrastructure/logger.js";

import {
  loggingMiddleware, rateLimitMiddleware, typingMiddleware,
  userHydrationMiddleware, errorBoundaryMiddleware,
} from "./middleware.js";

import {
  cmdStart, cmdMenu, cmdProfile, cmdBalance, cmdHelp, cmdCancel, cmdAdmin,
  cmdLang, cmdAffirmation, cmdDream,
} from "./commands.js";
import { handleMessage } from "./conversation.js";
import { handleCallback } from "./callbacks.js";
import { handleInlineQuery } from "./inline.js";

export async function buildBot(depsValue: Deps): Promise<Bot> {
  const bot = depsValue.bot;
  setDeps(depsValue);

  // Outer middleware (order matters: outer-to-inner).
  bot.use(errorBoundaryMiddleware());
  bot.use(loggingMiddleware());
  bot.use(rateLimitMiddleware(env.DAILY_FREE_MESSAGES + 20)); // generous per-minute cap
  bot.use(typingMiddleware());
  bot.use(userHydrationMiddleware(depsValue.repos.users));

  // Commands.
  bot.command("start", cmdStart);
  bot.command("menu", cmdMenu);
  bot.command("profile", cmdProfile);
  bot.command("balance", cmdBalance);
  bot.command("help", cmdHelp);
  bot.command("cancel", cmdCancel);
  bot.command("admin", cmdAdmin);
  bot.command("lang", cmdLang);
  bot.command("affirmation", cmdAffirmation);
  bot.command("dream", cmdDream);

  // Inline mode (@sofia <query>) — viral entry from any chat. Requires inline mode
  // to be enabled via @BotFather (toggle /setinline). The handler is registered regardless;
  // it stays inert until the BotFather flag is on.
  bot.inlineQuery(/.*/, handleInlineQuery);

  // /add @username N — admin crystal gift.
  bot.command("add", async (ctx) => {
    if (!ctx.from || !isAdmin(ctx.from.id.toString())) return;
    const d = deps();
    const args = (ctx.match as string ?? "").trim().split(/\s+/);
    const username = args[0]?.replace(/^@/, "");
    const amount = parseInt(args[1] ?? "", 10);
    if (!username || !amount || amount <= 0 || amount > 1000) {
      await ctx.reply("Формат: <code>/add @username 5</code>", { parse_mode: "HTML" });
      return;
    }
    const target = await d.repos.users.findByUsername(username);
    if (!target) {
      await ctx.reply(`Не нашла @${username}.`);
      return;
    }
    const newBalance = await d.services.billing.add(target.telegramId, amount, `Админ-подарок от ${ctx.from.id}`, "admin_gift");
    await d.repos.audit.record(ctx.from.id.toString(), "add_crystals", target.telegramId, `+${amount} → ${newBalance}`);
    try {
      await bot.api.sendMessage(target.telegramId, `🌙 Хранительница поделилась с тобой кристаллами. +${amount} 💎. Теперь у тебя ${newBalance}.`);
    } catch { /* user may have blocked */ }
    await ctx.reply(`Начислено ${amount} 💎 пользователю @${username}. Баланс: ${newBalance}.`);
  });

  // Callback queries (inline buttons).
  bot.on("callback_query:data", handleCallback);

  // Text messages (the main conversation router).
  bot.on("message:text", handleMessage);

  // Fallback for non-text messages — Sofia acknowledges gently.
  bot.on("message", async (ctx) => {
    if (!ctx.from) return;
    const d = deps();
    const user = await d.repos.users.findByTelegramId(ctx.from.id.toString());
    if (!user) return;
    const loc = user.language;
    if (["ASK_NAME", "ASK_BIRTH_DATE", "ASK_BIRTH_TIME", "ASK_BIRTH_PLACE"].includes(user.onboardingStep)) {
      await ctx.reply(loc === "en" ? "I listen to words. Write to me in text. 🌙" : "Я слушаю слова. Напиши мне текстом. 🌙");
      return;
    }
    await ctx.reply(loc === "en" ? "I hear you, but I can only see words. Tell me in text what is on your heart. 🌙" : "Я слышу тебя, но вижу только слова. Расскажи мне текстом, что у тебя на душе. 🌙");
  });

  // bot.catch for any uncaught errors.
  bot.catch((err) => {
    logger.error({ err: err.error }, "uncaught bot error");
  });

  return bot;
}
