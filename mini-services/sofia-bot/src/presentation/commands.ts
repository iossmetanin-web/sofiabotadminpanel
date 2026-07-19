// presentation/commands.ts — command handlers (/start, /menu, /profile, /balance, /help, /cancel, /admin, /today).
// Per Skill §5: thin handlers that delegate to services/repos; error handling; HTML parse mode.

import type { Context } from "grammy";
import { InlineKeyboard } from "grammy";
import { deps } from "./deps.js";
import { env, isAdmin } from "../config/env.js";
import { SOFIA_SYSTEM_PROMPT, RETURN_GREETING_PROMPT } from "../domain/prompts.js";
import { getZodiacFromIso, ageGroupFromYear } from "../domain/zodiac.js";
import { generateReferralCode } from "../infrastructure/repositories.js";
import { behavior } from "../config/env.js";
import {
  mainMenuKeyboard, readingMenuKeyboard, buyMenuKeyboard, adminPanelKeyboard,
  backHomeKeyboard, referralKeyboard,
} from "./keyboards.js";
import { formatProfile, formatBalance, escapeHtml } from "./formatters.js";

const HTML = { parse_mode: "HTML" as const };

// /start — entry point. Handles first-time, returning, long-absence, referral deep link.
export async function cmdStart(ctx: Context): Promise<void> {
  if (!ctx.from || !ctx.chat) return;
  const tgId = ctx.from.id.toString();
  const d = deps();
  const log = (ctx as any).log ?? console;

  // Parse deep link: ?start=ref_CODE  or  ?start=admin (BotFather sets the payload after /start )
  const payload = (ctx as any).startPayload ?? "";
  let referralCode: string | null = null;
  if (typeof payload === "string" && payload.startsWith("ref_")) {
    referralCode = payload.slice(4);
  }

  let user = await d.repos.users.findByTelegramId(tgId);

  if (!user) {
    // First time — create.
    const code = generateReferralCode();
    user = await d.repos.users.create({
      telegramId: tgId,
      username: ctx.from.username ?? null,
      firstName: ctx.from.first_name ?? null,
      referralCode: code,
      referredByReferralCode: referralCode,
      welcomeCrystals: env.WELCOME_CRYSTALS,
      isAdmin: isAdmin(tgId),
    });
    log.info({ userId: user.id, referralCode: code, referredBy: referralCode }, "new user created");

    await d.repos.users.setState(tgId, "ASK_NAME");
    await ctx.reply(
      `Здравствуй, милый человек. Я — София. Помню тайгу и руки, что сушили травы, и одновременно — слова складываются сами, как река.\n\nНе пугайся. Я здесь, чтобы послушать. Как мне тебя называть?`,
    );
    return;
  }

  // Returning user.
  await d.repos.users.update(tgId, {
    lastSeenAt: new Date(),
    username: ctx.from.username ?? user.username,
    isBlocked: false, // unblock on /start
    rudenessCount: 0,
  });

  const absenceMs = Date.now() - (user.lastSeenAt?.getTime() ?? Date.now());
  const absenceHours = absenceMs / (1000 * 60 * 60);

  if (absenceHours > behavior.returnAbsenceHours && user.onboardingCompleted) {
    // Long absence — return greeting.
    await d.repos.users.setState(tgId, "CONVERSATION");
    const messages = await d.services.context.buildMessages({
      systemPrompt: SOFIA_SYSTEM_PROMPT,
      userTelegramId: tgId,
      userName: user.name,
      userZodiac: user.zodiacSign,
      userAgeGroup: user.ageGroup,
      currentUserMessage: RETURN_GREETING_PROMPT
        .replace("{name}", user.name ?? "друг")
        .replace("{zodiac}", user.zodiacSign ?? "—")
        .replace("{hours}", String(Math.floor(absenceHours)))
        .replace("{last_topic}", user.lastTopicSummary ?? "последний наш разговор"),
    });
    const reply = await d.llm.generate(messages, { timeoutMs: 12000, maxTokens: 400 });
    await ctx.reply(reply.content, { ...HTML, reply_markup: mainMenuKeyboard(user) });
    return;
  }

  if (!user.onboardingCompleted) {
    // Resume onboarding — re-send the prompt for the current step.
    await resumeOnboarding(ctx, user.onboardingStep as any);
    return;
  }

  // Normal return.
  await d.repos.users.setState(tgId, "CONVERSATION");
  await ctx.reply(
    `Снова ты здесь, ${user.name ?? "мирной души"}. Я рада. О чём поговорим?`,
    { ...HTML, reply_markup: mainMenuKeyboard(user) },
  );
}

// Resume onboarding at the given step (re-send the prompt).
async function resumeOnboarding(ctx: Context, step: string): Promise<void> {
  const msgs: Record<string, string> = {
    ASK_NAME: "Как мне тебя называть?",
    ASK_BIRTH_DATE: "А когда ты родился? День и месяц (или полную дату) подскажи.",
    ASK_BIRTH_TIME: "А во сколько, если помнишь? Можно «пропустить».",
    ASK_BIRTH_PLACE: "А где это было? Можно «пропустить».",
    PROBING: "Ты ещё не ответил на мой вопрос. Помнишь, я спрашивала?",
  };
  await ctx.reply(msgs[step] ?? "Продолжим. Расскажи мне, что у тебя на душе.");
}

export async function cmdMenu(ctx: Context): Promise<void> {
  if (!ctx.from) return;
  const d = deps();
  const user = (ctx as any).userDto ?? await d.repos.users.findByTelegramId(ctx.from.id.toString());
  if (!user) { await cmdStart(ctx); return; }
  await d.repos.users.setState(user.telegramId, "CONVERSATION");
  await ctx.reply("Вот моё меню. Выбирай, что откликнется:", {
    parse_mode: "HTML",
    reply_markup: mainMenuKeyboard(user),
  });
}

export async function cmdProfile(ctx: Context): Promise<void> {
  if (!ctx.from) return;
  const d = deps();
  const user = (ctx as any).userDto ?? await d.repos.users.findByTelegramId(ctx.from.id.toString());
  if (!user) { await cmdStart(ctx); return; }
  const text = formatProfile(user);
  await ctx.reply(text, {
    parse_mode: "HTML",
    reply_markup: new InlineKeyboard().text("🗑 Удалить мои данные", "nav:delete").row().text("🏠 Меню", "nav:menu"),
  });
}

export async function cmdBalance(ctx: Context): Promise<void> {
  if (!ctx.from) return;
  const d = deps();
  const user = (ctx as any).userDto ?? await d.repos.users.findByTelegramId(ctx.from.id.toString());
  if (!user) { await cmdStart(ctx); return; }
  const text = formatBalance(user);
  await ctx.reply(text, { parse_mode: "HTML", reply_markup: buyMenuKeyboard() });
}

export async function cmdHelp(ctx: Context): Promise<void> {
  const text = `<b>Помощь</b>

Я — София, мудрая ведунья. Вот что я умею:

🔮 <b>Расклады</b> — малый (1💎), полный (3💎), любовный/карьера/решение (2💎)
🌟 <b>Карта дня</b> — бесплатно раз в 20 часов
🆓 <b>Бесплатная карта</b> — раз в 24 часа
📜 <b>История</b> — твои прошлые расклады
💬 <b>Разговор</b> — просто поговори со мной, 10 сообщений в день бесплатно

💎 Кристаллы — поддержка, чтобы разговор мог продолжаться. На старте у тебя 3.

Команды: /menu /profile /balance /cancel /help
Если что-то сломалось — /start.`;
  await ctx.reply(text, { parse_mode: "HTML", reply_markup: (await import("./keyboards.js")).homeOnlyKeyboard() });
}

export async function cmdCancel(ctx: Context): Promise<void> {
  if (!ctx.from) return;
  const d = deps();
  const user = await d.repos.users.findByTelegramId(ctx.from.id.toString());
  if (user) {
    if (user.onboardingCompleted) {
      await d.repos.users.setState(user.telegramId, "CONVERSATION");
    } else {
      // keep onboarding state — can't cancel onboarding
    }
  }
  await ctx.reply("Хорошо, вернёмся к началу. 🌙", {
    parse_mode: "HTML",
    reply_markup: user ? mainMenuKeyboard(user) : undefined,
  });
}

export async function cmdAdmin(ctx: Context): Promise<void> {
  if (!ctx.from) return;
  if (!isAdmin(ctx.from.id.toString())) {
    await ctx.reply("Это только для хранительницы. 🌙");
    return;
  }
  const d = deps();
  await d.repos.users.setState(ctx.from.id.toString(), "ADMIN_PANEL");
  await ctx.reply("🛠 <b>Админ-панель</b>", { parse_mode: "HTML", reply_markup: adminPanelKeyboard() });
}

// Edit-in-place navigation helper — rewrites the current message.
export async function editTo(ctx: Context, text: string, keyboard?: any): Promise<void> {
  const opts: any = { parse_mode: "HTML" };
  if (keyboard) opts.reply_markup = keyboard;
  try {
    if (ctx.callbackQuery?.message) {
      await ctx.api.editMessageText(
        ctx.callbackQuery.message.chat.id,
        ctx.callbackQuery.message.message_id,
        text,
        opts,
      );
    } else {
      await ctx.reply(text, opts);
    }
  } catch (e: any) {
    // edit may fail if text is identical — fall back to reply.
    if (e?.error_code === 400) {
      await ctx.reply(text, opts);
    } else throw e;
  }
}
