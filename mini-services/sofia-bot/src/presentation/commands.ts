// presentation/commands.ts — command handlers (/start, /menu, /profile, /balance, /help, /cancel, /admin, /today, /lang, /affirmation).
// Per Skill §5: thin handlers that delegate to services/repos; error handling; HTML parse mode.

import type { Context } from "grammy";
import { InlineKeyboard } from "grammy";
import { deps } from "./deps.js";
import { env, isAdmin } from "../config/env.js";
import { SOFIA_SYSTEM_PROMPT, RETURN_GREETING_PROMPT, AFFIRMATION_PROMPT_RU, AFFIRMATION_PROMPT_EN, DREAM_PROMPT_RU, DREAM_PROMPT_EN } from "../domain/prompts.js";
import { getZodiacFromIso, ageGroupFromYear } from "../domain/zodiac.js";
import { generateReferralCode } from "../infrastructure/repositories.js";
import { behavior } from "../config/env.js";
import { t, type Locale, isLocale, localeLabel } from "../domain/i18n.js";
import {
  mainMenuKeyboard, readingMenuKeyboard, buyMenuKeyboard, adminPanelKeyboard,
  backHomeKeyboard, referralKeyboard, homeOnlyKeyboard, languageKeyboard,
  settingsKeyboard,
} from "./keyboards.js";
import { formatProfile, formatBalance, escapeHtml } from "./formatters.js";

const HTML = { parse_mode: "HTML" as const };

// /start — entry point. Handles first-time, returning, long-absence, referral + new deep links (card, affirmation, question).
export async function cmdStart(ctx: Context): Promise<void> {
  if (!ctx.from || !ctx.chat) return;
  const tgId = ctx.from.id.toString();
  const d = deps();
  const log = (ctx as any).log ?? console;

  // Parse deep link: ?start=ref_CODE | card | affirmation | question | lang
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
    await ctx.reply(t(user.language, "onboarding_greeting"));
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

  // Handle deep-link actions for returning user.
  if (typeof payload === "string" && payload.length > 0 && !referralCode) {
    if (payload === "card") {
      await d.repos.users.setState(tgId, "CONVERSATION");
      await ctx.reply(user.language === "en"
        ? "🃏 Let me draw a card for you. Choose a spread from the menu below."
        : "🃏 Я вытяну для тебя карту. Выбери расклад из меню ниже.",
        { ...HTML, reply_markup: readingMenuKeyboard(user.language) });
      return;
    }
    if (payload === "affirmation") {
      await d.repos.users.setState(tgId, "CONVERSATION");
      await sendAffirmation(ctx, user);
      return;
    }
    if (payload === "question") {
      await d.repos.users.setState(tgId, "CONVERSATION");
      await ctx.reply(user.language === "en"
        ? "🔮 Tell me — what is on your heart? Ask, and I will answer."
        : "🔮 Скажи мне — что у тебя на сердце? Спроси, и я отвечу.",
        { ...HTML, reply_markup: mainMenuKeyboard(user) });
      return;
    }
    if (payload === "lang") {
      await d.repos.users.setState(tgId, "CONVERSATION");
      await ctx.reply(t(user.language, "lang_select"), {
        ...HTML,
        reply_markup: languageKeyboard(user.language),
      });
      return;
    }
  }

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
    await resumeOnboarding(ctx, user.onboardingStep as any, user.language);
    return;
  }

  // Normal return.
  await d.repos.users.setState(tgId, "CONVERSATION");
  await ctx.reply(
    t(user.language, "return_known", { name: user.name ?? t(user.language, "return_greeting_default") }),
    { ...HTML, reply_markup: mainMenuKeyboard(user) },
  );
}

// Resume onboarding at the given step (re-send the prompt).
async function resumeOnboarding(ctx: Context, step: string, loc: Locale): Promise<void> {
  const map: Record<string, keyof typeof import("../domain/i18n.js").translations.ru> = {
    ASK_NAME: "onboarding_ask_name",
    ASK_BIRTH_DATE: "onboarding_ask_birth_date",
    ASK_BIRTH_TIME: "onboarding_ask_birth_time",
    ASK_BIRTH_PLACE: "onboarding_ask_birth_place",
    PROBING: "onboarding_probing_resume",
  };
  const key = map[step] ?? "onboarding_unknown_step";
  await ctx.reply(t(loc, key));
}

export async function cmdMenu(ctx: Context): Promise<void> {
  if (!ctx.from) return;
  const d = deps();
  const user = (ctx as any).userDto ?? await d.repos.users.findByTelegramId(ctx.from.id.toString());
  if (!user) { await cmdStart(ctx); return; }
  await d.repos.users.setState(user.telegramId, "CONVERSATION");
  await ctx.reply(t(user.language, "menu_title"), {
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
    reply_markup: new InlineKeyboard().text(t(user.language, "profile_delete_data"), "nav:delete").row().text(t(user.language, "menu_home"), "nav:menu"),
  });
}

export async function cmdBalance(ctx: Context): Promise<void> {
  if (!ctx.from) return;
  const d = deps();
  const user = (ctx as any).userDto ?? await d.repos.users.findByTelegramId(ctx.from.id.toString());
  if (!user) { await cmdStart(ctx); return; }
  const text = formatBalance(user);
  await ctx.reply(text, { parse_mode: "HTML", reply_markup: buyMenuKeyboard(user.language) });
}

export async function cmdHelp(ctx: Context): Promise<void> {
  if (!ctx.from) return;
  const d = deps();
  const user = (ctx as any).userDto ?? await d.repos.users.findByTelegramId(ctx.from.id.toString());
  const loc: Locale = user?.language ?? "ru";
  await ctx.reply(t(loc, "help_body"), { parse_mode: "HTML", reply_markup: homeOnlyKeyboard(loc) });
}

export async function cmdCancel(ctx: Context): Promise<void> {
  if (!ctx.from) return;
  const d = deps();
  const user = await d.repos.users.findByTelegramId(ctx.from.id.toString());
  if (user) {
    if (user.onboardingCompleted) {
      await d.repos.users.setState(user.telegramId, "CONVERSATION");
    }
  }
  await ctx.reply(t(user?.language ?? "ru", "cancel_body"), {
    parse_mode: "HTML",
    reply_markup: user ? mainMenuKeyboard(user) : undefined,
  });
}

// /lang — change language.
export async function cmdLang(ctx: Context): Promise<void> {
  if (!ctx.from) return;
  const d = deps();
  const user = (ctx as any).userDto ?? await d.repos.users.findByTelegramId(ctx.from.id.toString());
  const loc: Locale = user?.language ?? "ru";
  await ctx.reply(t(loc, "lang_select"), {
    parse_mode: "HTML",
    reply_markup: languageKeyboard(loc),
  });
}

// /affirmation — daily affirmation (LLM-generated, short).
export async function cmdAffirmation(ctx: Context): Promise<void> {
  if (!ctx.from) return;
  const d = deps();
  const user = (ctx as any).userDto ?? await d.repos.users.findByTelegramId(ctx.from.id.toString());
  if (!user) { await cmdStart(ctx); return; }
  await sendAffirmation(ctx, user);
}

// Internal: build the affirmation text via LLM.
async function sendAffirmation(ctx: Context, user: { telegramId: string; language: Locale; name: string | null; zodiacSign: string | null }): Promise<void> {
  const d = deps();
  const loc = user.language;
  const prompt = loc === "en" ? AFFIRMATION_PROMPT_EN : AFFIRMATION_PROMPT_RU;
  const messages = await d.services.context.buildMessages({
    systemPrompt: SOFIA_SYSTEM_PROMPT,
    userTelegramId: user.telegramId,
    userName: user.name,
    userZodiac: user.zodiacSign,
    userAgeGroup: null,
    currentUserMessage: prompt,
  });
  try {
    const reply = await d.llm.generate(messages, { timeoutMs: 8000, maxTokens: 200 });
    const text = reply.content?.trim();
    if (text) {
      await ctx.reply(`${t(loc, "affirmation_intro")}\n\n${text}`, {
        parse_mode: "HTML",
        reply_markup: homeOnlyKeyboard(loc),
      });
      return;
    }
  } catch (e) {
    (ctx as any).log?.warn?.({ err: e }, "affirmation LLM call failed");
  }
  // Fallback: deterministic seed-based affirmation (no LLM).
  await ctx.reply(`${t(loc, "affirmation_intro")}\n\n${loc === "en" ? "Be like still water today. 🌙" : "Будь как тихая вода сегодня. 🌙"}`, {
    parse_mode: "HTML",
    reply_markup: homeOnlyKeyboard(loc),
  });
}

// /dream — dream interpretation (free, uses LLM).
export async function cmdDream(ctx: Context): Promise<void> {
  if (!ctx.from) return;
  const d = deps();
  const user = (ctx as any).userDto ?? await d.repos.users.findByTelegramId(ctx.from.id.toString());
  if (!user) { await cmdStart(ctx); return; }
  const loc: Locale = user.language;
  await d.repos.users.setState(user.telegramId, "DREAM");
  await ctx.reply(t(loc, "dream_ask"), {
    parse_mode: "HTML",
    reply_markup: new InlineKeyboard().text(t(loc, "menu_back"), "nav:back"),
  });
}

export async function cmdAdmin(ctx: Context): Promise<void> {
  if (!ctx.from) return;
  const d = deps();
  const user = (ctx as any).userDto ?? await d.repos.users.findByTelegramId(ctx.from.id.toString());
  const loc: Locale = user?.language ?? "ru";
  if (!isAdmin(ctx.from.id.toString())) {
    await ctx.reply(t(loc, "admin_forbidden"));
    return;
  }
  await d.repos.users.setState(ctx.from.id.toString(), "ADMIN_PANEL");
  await ctx.reply(t(loc, "admin_panel_title"), { parse_mode: "HTML", reply_markup: adminPanelKeyboard(loc) });
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
