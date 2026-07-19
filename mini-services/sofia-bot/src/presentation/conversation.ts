// presentation/conversation.ts — CONVERSATION + PAID_HOOK + reading flows + edge states.
// Corrected billing (charge-before-generate, refund on failure, never replace LLM reply with billing text).

import type { Context } from "grammy";
import { deps } from "./deps.js";
import { env, behavior, pricing } from "../config/env.js";
import {
  SOFIA_SYSTEM_PROMPT, TAROT_READING_PROMPT, HOROSCOPE_PROMPT,
  SINGLE_CARD_PROMPT, CARD_OF_DAY_PROMPT, DREAM_PROMPT_RU, DREAM_PROMPT_EN,
  YES_NO_PROMPT_RU, YES_NO_PROMPT_EN,
} from "../domain/prompts.js";
import {
  SPREADS, getCardByNumber, getCardByNumberLocalized, type SpreadDefinition,
} from "../domain/tarot.js";
import { NumberList } from "../domain/valueObjects.js";
import { ValidationError, CooldownActiveError, InsufficientCrystalsError } from "../domain/exceptions.js";
import {
  mainMenuKeyboard, readingMenuKeyboard, buyMenuKeyboard, paidHookKeyboard,
  deleteConfirmKeyboard, backHomeKeyboard, broadcastConfirmKeyboard,
  historyPaginationKeyboard,
} from "./keyboards.js";
import {
  isRude, isSorry, isSkip, matchTrigger, detectReadingType, splitMessage, escapeHtml,
  formatReadingHistoryItem,
} from "./formatters.js";
import { isAdmin } from "../config/env.js";
import { InlineKeyboard } from "grammy";
import { t, type Locale } from "../domain/i18n.js";

const HTML = { parse_mode: "HTML" as const };

// ---- Main message dispatcher (called for every non-command text message) ----
export async function handleMessage(ctx: Context): Promise<void> {
  if (!ctx.from || !ctx.message?.text) return;
  const text = ctx.message.text;
  const d = deps();
  const tgId = ctx.from.id.toString();
  let user = (ctx as any).userDto ?? await d.repos.users.findByTelegramId(tgId);

  if (!user) {
    // Treat as first-time → /start logic.
    const { cmdStart } = await import("./commands.js");
    return cmdStart(ctx);
  }

  // Update lastSeenAt + username.
  await d.repos.users.update(tgId, {
    lastSeenAt: new Date(),
    username: ctx.from.username ?? user.username,
  });

  const state = user.onboardingStep as string;

  // Onboarding states → delegate.
  if (["ASK_NAME", "ASK_BIRTH_DATE", "ASK_BIRTH_TIME", "ASK_BIRTH_PLACE", "PROBING"].includes(state)) {
    const { handleOnboardingMessage } = await import("./onboarding.js");
    await handleOnboardingMessage(ctx, text);
    return;
  }

  // BLOCKED — only apology unblocks.
  if (state === "BLOCKED" || user.isBlocked) {
    const loc: Locale = user.language;
    if (isSorry(text)) {
      await d.repos.users.update(tgId, { rudenessCount: 0, isBlocked: false });
      await d.repos.users.setState(tgId, "CONVERSATION");
      await ctx.reply(loc === "en" ? "I forgive you. I am always here. 🌙" : "Прощаю. Я всегда здесь. 🌙", { ...HTML, reply_markup: mainMenuKeyboard(user) });
    } else {
      await ctx.reply(loc === "en" ? "Say \"sorry\" when you are ready. I will wait." : "Скажи «извини», когда будешь готов. Я подожду.");
    }
    return;
  }

  // AWAIT_DELETE_CONFIRM
  if (state === "AWAIT_DELETE_CONFIRM") {
    const loc: Locale = user.language;
    if (text.toLowerCase().match(/удалить навсегда|да, удалить|confirm|delete forever|yes, delete/)) {
      await d.repos.users.delete(tgId);
      await ctx.reply(t(loc, "profile_deleted"));
    } else {
      await d.repos.users.setState(tgId, "CONVERSATION");
      await ctx.reply(t(loc, "profile_delete_cancelled"), { ...HTML, reply_markup: mainMenuKeyboard(user) });
    }
    return;
  }

  // BROADCAST — admin typing the broadcast text.
  if (state === "BROADCAST") {
    if (!isAdmin(tgId)) {
      await d.repos.users.setState(tgId, "CONVERSATION");
      return;
    }
    const loc: Locale = user.language;
    const total = await d.repos.users.countAll();
    await d.repos.broadcasts.create(tgId, text, total);
    (ctx as any).__broadcastText = text;
    const previewHdr = loc === "en" ? `<b>Broadcast preview:</b>\n\n` : `<b>Превью рассылки:</b>\n\n`;
    const previewFtr = loc === "en" ? `\n\nRecipients: ${total} users. Confirm?` : `\n\nПолучат: ${total} пользователей. Подтвердить?`;
    await ctx.reply(
      previewHdr + escapeHtml(text) + previewFtr,
      { ...HTML, reply_markup: broadcastConfirmKeyboard(loc) },
    );
    return;
  }

  // TARO_ASK_NUMBERS — parse numbers for the chosen spread.
  if (state === "TARO_ASK_NUMBERS") {
    await handleTaroAskNumbers(ctx, user, text);
    return;
  }

  // DREAM — user is telling their dream.
  if (state === "DREAM") {
    await handleDreamMessage(ctx, user, text);
    return;
  }

  // YES_NO_ASK — user is typing their yes/no question.
  if (state === "YES_NO_ASK") {
    await handleYesNoMessage(ctx, user, text);
    return;
  }

  // PAID_HOOK
  if (state === "PAID_HOOK") {
    const loc: Locale = user.language;
    const lower = text.toLowerCase();
    if (isSkip(lower) || lower.match(/(нет|позже|не сейчас|later|no|not now)/)) {
      await d.repos.users.setState(tgId, "CONVERSATION");
      await ctx.reply(t(loc, "menu_later") === "Later" ? "Very well, I will wait. 🌙" : "Хорошо, я подожду. 🌙", { ...HTML, reply_markup: mainMenuKeyboard(user) });
      return;
    }
    await d.repos.users.setState(tgId, "CONVERSATION");
    await ctx.reply(t(loc, "reading_menu_title"), { ...HTML, reply_markup: readingMenuKeyboard(loc) });
    return;
  }

  // CONVERSATION (default hub)
  if (state === "CONVERSATION" || state === "FREE_READING") {
    await handleConversation(ctx, user, text);
    return;
  }

  // Fallback: reset to CONVERSATION.
  const loc0: Locale = user.language;
  await d.repos.users.setState(tgId, "CONVERSATION");
  await ctx.reply(loc0 === "en" ? "Something slipped. Let's begin again. What shall we talk about?" : "Что-то сбилось. Давай начнём заново. О чём поговорим?", {
    ...HTML, reply_markup: mainMenuKeyboard(user),
  });
}

// ---- CONVERSATION handler ----
async function handleConversation(ctx: Context, user: any, text: string): Promise<void> {
  const d = deps();
  const tgId = user.telegramId;

  const loc: Locale = user.language;
  // 1. Rudeness check (word-boundary).
  if (isRude(text)) {
    const newCount = user.rudenessCount + 1;
    if (newCount >= 5) {
      await d.repos.users.update(tgId, { rudenessCount: newCount, isBlocked: true });
      await d.repos.users.setState(tgId, "BLOCKED");
      await ctx.reply(loc === "en" ? "I need some time. Say \"sorry\" when you are ready." : "Мне нужно время. Скажи «извини», когда будешь готов.");
      return;
    }
    await d.repos.users.update(tgId, { rudenessCount: newCount });
    await ctx.reply(loc === "en" ? "That hurts a little to hear. But I am here." : "Мне немного больно слышать это. Но я здесь.");
    return;
  }

  // 2. Navigation triggers.
  const trigger = matchTrigger(text);
  if (trigger === "menu") {
    await d.repos.users.setState(tgId, "CONVERSATION");
    await ctx.reply(t(loc, "menu_title"), { ...HTML, reply_markup: mainMenuKeyboard(user) });
    return;
  }
  if (trigger === "balance") {
    const { formatBalance } = await import("./formatters.js");
    await ctx.reply(formatBalance(user), { ...HTML, reply_markup: buyMenuKeyboard(loc) });
    return;
  }
  if (trigger === "profile") {
    const { formatProfile } = await import("./formatters.js");
    await ctx.reply(formatProfile(user), {
      ...HTML,
      reply_markup: new InlineKeyboard().text(t(loc, "profile_delete_data"), "nav:delete").row().text(t(loc, "menu_home"), "nav:menu"),
    });
    return;
  }
  if (trigger === "history") {
    await showHistory(ctx, user, 1);
    return;
  }

  // 3. Reading type detection.
  const readingType = detectReadingType(text);
  if (readingType) {
    await startReadingFlow(ctx, user, readingType);
    return;
  }

  // 4. Daily quota check (corrected billing: never replace LLM reply with billing text).
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const isNewDay = !user.dailyMessageDate || new Date(user.dailyMessageDate).getTime() !== today.getTime();
  const dailyCount = isNewDay ? 1 : user.dailyMessageCount + 1;
  await d.repos.users.update(tgId, {
    dailyMessageCount: dailyCount,
    dailyMessageDate: today,
    messageCount: user.messageCount + 1,
  });
  user.dailyMessageCount = dailyCount;
  user.messageCount = user.messageCount + 1;

  // 5. Save user message.
  await d.repos.conversations.save(user.id, "user", text.slice(0, 2000));

  // 6. Paid hook every 7th message (only if not exceeded daily free tier).
  if (user.messageCount > 0 && user.messageCount % 7 === 0 && dailyCount <= behavior.dailyFreeMessages) {
    await d.repos.users.setState(tgId, "PAID_HOOK");
    await ctx.reply(
      loc === "en"
        ? `Remember when I said your card has another side? Now is the moment to look. A small spread will reveal what is still hidden. 🔮`
        : `Помнишь, я говорила, что в твоей карте есть ещё одна сторона? Сейчас самое время посмотреть. Малый расклад откроет то, что пока скрыто. 🔮`,
      { ...HTML, reply_markup: paidHookKeyboard(loc) },
    );
    return;
  }

  // 7. Daily quota exceeded → soft offer (not a wall).
  if (dailyCount > behavior.dailyFreeMessages) {
    const overBy = dailyCount - behavior.dailyFreeMessages;
    if (overBy === 1) {
      await ctx.reply(
        loc === "en"
          ? `We have talked a lot today, ${user.name ?? "dear"}. If you want five more messages — it is one crystal. Otherwise, I will answer, but more briefly.`
          : `Сегодня мы много говорим, ${user.name ?? "милый"}. Если хочешь ещё пять сообщений — это один кристалл. А так — я отвечу, но короче.`,
        { ...HTML, reply_markup: new InlineKeyboard().text(loc === "en" ? "Yes, 1💎 for +5" : "Да, 1💎 за +5", "buy:msg5").text(loc === "en" ? "Enough" : "Хватит", "nav:later").row().text(t(loc, "menu_home"), "nav:menu") },
      );
    }
    await generateSofiaReply(ctx, user, text, { short: true, loc });
    return;
  }

  // 8. Default: full Sofia reply + memory extraction.
  await generateSofiaReply(ctx, user, text, { short: false, loc });

  // Memory extraction runs after the reply is sent (long-polling process stays alive).
  if (user.messageCount % behavior.memoryExtractInterval === 0) {
    void d.services.memory.extractAndSave(tgId).catch((e) => {
      (ctx as any).log?.warn?.({ err: e }, "memory extraction failed");
    });
  }
}

// ---- Sofia reply generation ----
async function generateSofiaReply(ctx: Context, user: any, userText: string, opts: { short: boolean; loc: Locale }): Promise<void> {
  const d = deps();
  const shortSuffix = opts.loc === "en"
    ? "\n\nANSWER BRIEFLY NOW: 1-2 sentences, soft, without long reasoning."
    : "\n\nСЕЙЧАС ОТВЕЧАЙ КОРОЧЕ: 1-2 предложения, мягко, без длинных рассуждений.";
  const systemPrompt = opts.short
    ? SOFIA_SYSTEM_PROMPT + shortSuffix
    : SOFIA_SYSTEM_PROMPT;
  try {
    const messages = await d.services.context.buildMessages({
      systemPrompt,
      userTelegramId: user.telegramId,
      userName: user.name,
      userZodiac: user.zodiacSign,
      userAgeGroup: user.ageGroup,
      currentUserMessage: userText,
    });
    const res = await d.llm.generate(messages, { timeoutMs: 15000, maxTokens: opts.short ? 200 : 600 });
    await d.repos.conversations.save(user.id, "sofia", res.content.slice(0, 4000));
    for (const chunk of splitMessage(res.content)) {
      await ctx.reply(chunk, HTML);
    }
  } catch (e: any) {
    const { errorBoundaryMiddleware } = await import("./middleware.js");
    // Re-throw so the error boundary handles the user-facing message.
    throw e;
  }
}

// ---- Reading flow ----
export async function startReadingFlow(ctx: Context, user: any, type: string): Promise<void> {
  const d = deps();

  // Free readings (cooldown-gated, no crystals).
  if (type === "single_card") {
    const loc: Locale = user.language;
    if (!canGetFreeCard(user)) {
      const hoursLeft = Math.ceil((behavior.freeCardCooldownHours * 3600_000 - (Date.now() - new Date(user.lastFreeCardAt).getTime())) / 3600_000);
      await ctx.reply(t(loc, "free_card_cooldown", { hours: String(Math.max(1, hoursLeft)) }));
      return;
    }
    await d.repos.users.update(user.telegramId, { lastFreeCardAt: new Date() });
    await d.repos.users.setState(user.telegramId, "SINGLE_CARD");
    await deliverSingleCard(ctx, user, "single_card");
    return;
  }
  if (type === "card_of_day") {
    const loc: Locale = user.language;
    if (!canGetDailyCard(user)) {
      const hoursLeft = Math.ceil((behavior.dailyCardCooldownHours * 3600_000 - (Date.now() - new Date(user.lastDailyCardAt).getTime())) / 3600_000);
      await ctx.reply(t(loc, "card_of_day_cooldown", { hours: String(Math.max(1, hoursLeft)) }));
      return;
    }
    await d.repos.users.update(user.telegramId, { lastDailyCardAt: new Date(), streakDays: user.streakDays + 1 });
    await d.repos.users.setState(user.telegramId, "CARD_OF_DAY");
    await deliverSingleCard(ctx, user, "card_of_day");
    return;
  }
  if (type === "horoscope") {
    await chargeAndDeliver(ctx, user, "horoscope", pricing.horoscope);
    return;
  }

  // Paid tarot spreads → ask for numbers first.
  const spread = SPREADS[type];
  const loc: Locale = user.language;
  if (!spread) {
    await ctx.reply(loc === "en" ? "I couldn't find that spread. Pick one from the menu:" : "Что-то не нашла такой расклад. Выбери из меню:", { ...HTML, reply_markup: readingMenuKeyboard(loc) });
    return;
  }
  // Check balance up-front; if insufficient, show buy menu but still ask for numbers? No — show buy menu.
  const cost = costFor(type);
  if (user.crystals < cost) {
    await ctx.reply(
      loc === "en" ? `This spread costs ${cost} 💎, but you have ${user.crystals}. Want to top up?` : `За этот расклад нужно ${cost} 💎, а у тебя ${user.crystals}. Хочешь пополнить?`,
      { ...HTML, reply_markup: buyMenuKeyboard(loc) },
    );
    return;
  }
  await d.repos.users.setState(user.telegramId, type as any); // TARO_SMALL etc.
  await d.repos.users.update(user.telegramId, { lastTopicSummary: spread.type });
  await ctx.reply(`${spread.instruction}\n\n(${loc === "en" ? "Need" : "Нужно"} ${spread.cardCount} ${loc === "en" ? "numbers" : "чисел"}.)`);
}

function costFor(type: string): number {
  const map: Record<string, number> = {
    tarot_small: pricing.tarot_small,
    tarot_full: pricing.tarot_full,
    tarot_love: pricing.tarot_love,
    tarot_career: pricing.tarot_career,
    tarot_decision: pricing.tarot_decision,
    horoscope: pricing.horoscope,
    yes_no: 1,
  };
  return map[type] ?? 1;
}

function canGetFreeCard(user: any): boolean {
  if (!user.lastFreeCardAt) return true;
  return Date.now() - new Date(user.lastFreeCardAt).getTime() >= behavior.freeCardCooldownHours * 3600_000;
}
function canGetDailyCard(user: any): boolean {
  if (!user.lastDailyCardAt) return true;
  return Date.now() - new Date(user.lastDailyCardAt).getTime() >= behavior.dailyCardCooldownHours * 3600_000;
}

// ---- TARO_ASK_NUMBERS handler ----
async function handleTaroAskNumbers(ctx: Context, user: any, text: string): Promise<void> {
  const d = deps();
  const loc: Locale = user.language;
  const type = user.onboardingStep;
  const spread = SPREADS[type];
  if (!spread) {
    await d.repos.users.setState(user.telegramId, "CONVERSATION");
    await ctx.reply(loc === "en" ? "The spread slipped. Try again from the menu." : "Что-то сбилось с раскладом. Попробуй снова через меню.", { ...HTML, reply_markup: mainMenuKeyboard(user) });
    return;
  }
  try {
    const nums = NumberList.parse(text, spread.cardCount, 78);
    await chargeAndDeliverTarot(ctx, user, spread, nums.numbers);
  } catch (e) {
    if (e instanceof ValidationError) {
      await ctx.reply(e.message);
    } else throw e;
  }
}

// ---- Charge + deliver tarot reading (atomic spend, refund on failure) ----
async function chargeAndDeliverTarot(ctx: Context, user: any, spread: SpreadDefinition, nums: number[]): Promise<void> {
  const d = deps();
  const loc: Locale = user.language;
  const cost = costFor(spread.type);
  const cards = nums.map((n) => getCardByNumberLocalized(n, loc));
  const cardsWithPositions = cards.map((c, i) => `${spread.positions[i] ?? `Карта ${i+1}`}: ${c.name}${c.reversed ? (loc === "en" ? " (reversed)" : " (перевёрнута)") : ""}`).join("\n");
  const cardsJson = JSON.stringify(cards.map((c, i) => ({ name: c.name, reversed: c.reversed, position: spread.positions[i] ?? `Карта ${i+1}` })));

  // Charge BEFORE generate.
  let balance: number;
  try {
    balance = await d.services.billing.spend(user.telegramId, cost, loc === "en" ? `Reading ${spread.type}` : `Расклад ${spread.type}`);
  } catch (e) {
    if (e instanceof InsufficientCrystalsError) {
      await d.repos.users.setState(user.telegramId, "CONVERSATION");
      await ctx.reply(loc === "en" ? `Not enough crystals. Need ${cost} 💎, you have ${user.crystals}.` : `Не хватает кристаллов. Нужно ${cost} 💎, у тебя ${user.crystals}.`, { ...HTML, reply_markup: buyMenuKeyboard(loc) });
      return;
    }
    throw e;
  }

  await ctx.reply(loc === "en" ? "🔮 Shuffling the deck, gazing…" : "🔮 Тасую колоду, всматриваюсь…");
  try {
    const prompt = TAROT_READING_PROMPT
      .replace("{name}", user.name ?? "друг")
      .replace("{zodiac}", user.zodiacSign ?? "—")
      .replace("{spread_name}", spread.type)
      .replace("{cards_with_positions}", cardsWithPositions);
    const messages = await d.services.context.buildMessages({
      systemPrompt: SOFIA_SYSTEM_PROMPT,
      userTelegramId: user.telegramId,
      userName: user.name,
      userZodiac: user.zodiacSign,
      userAgeGroup: user.ageGroup,
      currentUserMessage: prompt,
    });
    const res = await d.llm.generate(messages, { timeoutMs: 30000, maxTokens: 2000 });
    await d.repos.readings.save(user.id, spread.type, null, cardsJson, res.content, cost);
    await d.repos.users.setState(user.telegramId, "CONVERSATION");
    const cardsLabel = loc === "en" ? "Your cards:" : "Твои карты:";
    await ctx.reply(`🎴 <b>${cardsLabel}</b>\n${cards.map((c,i) => `${i+1}. ${escapeHtml(c.name)}${c.reversed ? (loc === "en" ? " (reversed)" : " (перевёрнута)") : ""} — <i>${escapeHtml(spread.positions[i] ?? "")}</i>`).join("\n")}`, HTML);
    for (const chunk of splitMessage(res.content)) {
      await ctx.reply(chunk, HTML);
    }
    await ctx.reply(loc === "en" ? "🌙 The card has settled. Shall we talk about it?" : "🌙 Карта легла. Хочешь поговорим об этом?", { ...HTML, reply_markup: mainMenuKeyboard(user) });
  } catch (e) {
    await d.services.billing.refund(user.telegramId, cost, loc === "en" ? `Failure ${spread.type}` : `Сбой расклада ${spread.type}`);
    await d.repos.users.setState(user.telegramId, "CONVERSATION");
    (ctx as any).log?.error?.({ err: e }, "reading generation failed");
    throw e;
  }
}

// ---- Charge + deliver horoscope ----
async function chargeAndDeliver(ctx: Context, user: any, type: string, cost: number): Promise<void> {
  const d = deps();
  const loc: Locale = user.language;
  if (user.crystals < cost) {
    await ctx.reply(loc === "en" ? `Need ${cost} 💎, you have ${user.crystals}.` : `Нужно ${cost} 💎, у тебя ${user.crystals}.`, { ...HTML, reply_markup: buyMenuKeyboard(loc) });
    return;
  }
  let balance: number;
  try {
    balance = await d.services.billing.spend(user.telegramId, cost, loc === "en" ? "Horoscope" : "Гороскоп");
  } catch (e) { if (e instanceof InsufficientCrystalsError) { return; } throw e; }

  await ctx.reply(loc === "en" ? "♈ Gazing at the stars…" : "♈ Всматриваюсь в звёзды…");
  try {
    const prompt = HOROSCOPE_PROMPT.replace("{name}", user.name ?? "друг").replace("{zodiac}", user.zodiacSign ?? "—");
    const messages = await d.services.context.buildMessages({
      systemPrompt: SOFIA_SYSTEM_PROMPT,
      userTelegramId: user.telegramId,
      userName: user.name,
      userZodiac: user.zodiacSign,
      userAgeGroup: user.ageGroup,
      currentUserMessage: prompt,
    });
    const res = await d.llm.generate(messages, { timeoutMs: 15000, maxTokens: 500 });
    await d.repos.readings.save(user.id, "horoscope", null, "[]", res.content, cost);
    await d.repos.users.setState(user.telegramId, "CONVERSATION");
    for (const chunk of splitMessage(res.content)) {
      await ctx.reply(chunk, HTML);
    }
    await ctx.reply("🌙", { ...HTML, reply_markup: mainMenuKeyboard(user) });
  } catch (e) {
    await d.services.billing.refund(user.telegramId, cost, loc === "en" ? "Horoscope failure" : "Сбой гороскопа");
    await d.repos.users.setState(user.telegramId, "CONVERSATION");
    throw e;
  }
}

// ---- Single card / card of day (free) ----
async function deliverSingleCard(ctx: Context, user: any, type: string): Promise<void> {
  const d = deps();
  const loc: Locale = user.language;
  const n = Math.floor(Math.random() * 78) + 1;
  const card = getCardByNumberLocalized(n, loc);
  const reversedNote = card.reversed ? (loc === "en" ? " (reversed)" : " (перевёрнута)") : "";
  const prompt = (type === "card_of_day" ? CARD_OF_DAY_PROMPT : SINGLE_CARD_PROMPT)
    .replace("{name}", user.name ?? "друг")
    .replace("{zodiac}", user.zodiacSign ?? "—")
    .replace("{card_name}", card.name)
    .replace("{reversed_note}", reversedNote);
  try {
    const messages = await d.services.context.buildMessages({
      systemPrompt: SOFIA_SYSTEM_PROMPT,
      userTelegramId: user.telegramId,
      userName: user.name,
      userZodiac: user.zodiacSign,
      userAgeGroup: user.ageGroup,
      currentUserMessage: prompt,
    });
    const res = await d.llm.generate(messages, { timeoutMs: 15000, maxTokens: 400 });
    await d.repos.readings.save(user.id, type, null, JSON.stringify({ name: card.name, reversed: card.reversed }), res.content, 0);
    await d.repos.users.setState(user.telegramId, "CONVERSATION");
    await ctx.reply(`🎴 <b>${escapeHtml(card.name)}</b>${reversedNote}`, HTML);
    for (const chunk of splitMessage(res.content)) {
      await ctx.reply(chunk, HTML);
    }
    await ctx.reply("🌙", { ...HTML, reply_markup: mainMenuKeyboard(user) });
  } catch (e) {
    await d.repos.users.setState(user.telegramId, "CONVERSATION");
    throw e;
  }
}

// ---- History viewer ----
export async function showHistory(ctx: Context, user: any, page: number): Promise<void> {
  const d = deps();
  const loc: Locale = user.language;
  const limit = 5;
  const total = await d.repos.readings.countByUser(user.id);
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const p = Math.min(Math.max(1, page), totalPages);
  const items = await d.repos.readings.listByUser(user.id, limit, (p - 1) * limit);
  if (items.length === 0) {
    await ctx.reply(t(loc, "history_empty"), {
      ...HTML, reply_markup: new InlineKeyboard().text(t(loc, "history_make_first"), "rd:menu").row().text(t(loc, "menu_home"), "nav:menu"),
    });
    return;
  }
  const text = t(loc, "history_page", { page: String(p), total: String(totalPages) }) + "\n\n" +
    items.map((r, i) => formatReadingHistoryItem(r, (p - 1) * limit + i + 1, loc)).join("\n\n");
  await ctx.reply(text, { ...HTML, reply_markup: historyPaginationKeyboard(p, totalPages, loc) });
}

// ---- Dream interpretation handler ----
async function handleDreamMessage(ctx: Context, user: any, dreamText: string): Promise<void> {
  const d = deps();
  const loc: Locale = user.language;
  const prompt = (loc === "en" ? DREAM_PROMPT_EN : DREAM_PROMPT_RU)
    .replace("{name}", user.name ?? "друг")
    .replace("{zodiac}", user.zodiacSign ?? "—")
    .replace("{dream}", dreamText.slice(0, 1000));

  await d.repos.users.setState(user.telegramId, "CONVERSATION");
  await d.repos.conversations.save(user.id, "user", dreamText.slice(0, 2000));

  try {
    const messages = await d.services.context.buildMessages({
      systemPrompt: SOFIA_SYSTEM_PROMPT,
      userTelegramId: user.telegramId,
      userName: user.name,
      userZodiac: user.zodiacSign,
      userAgeGroup: user.ageGroup,
      currentUserMessage: prompt,
    });
    const res = await d.llm.generate(messages, { timeoutMs: 15000, maxTokens: 500 });
    await d.repos.conversations.save(user.id, "sofia", res.content.slice(0, 4000));
    for (const chunk of splitMessage(res.content)) {
      await ctx.reply(chunk, HTML);
    }
    await ctx.reply("🌙", { ...HTML, reply_markup: mainMenuKeyboard(user) });
  } catch (e) {
    (ctx as any).log?.error?.({ err: e }, "dream interpretation failed");
    await ctx.reply(loc === "en"
      ? "The images are still forming. Try again later. 🌙"
      : "Образы ещё формируются. Попробуй позже. 🌙",
      { ...HTML, reply_markup: mainMenuKeyboard(user) });
  }
}

// ---- Yes/No reading handler ----
async function handleYesNoMessage(ctx: Context, user: any, question: string): Promise<void> {
  const d = deps();
  const loc: Locale = user.language;
  const cost = 1;

  if (user.crystals < cost) {
    await d.repos.users.setState(user.telegramId, "CONVERSATION");
    await ctx.reply(t(loc, "billing_low_balance", { count: cost }), { ...HTML, reply_markup: buyMenuKeyboard(loc) });
    return;
  }

  // Charge before generate.
  try {
    await d.services.billing.spend(user.telegramId, cost, loc === "en" ? "Yes/No reading" : "Расклад Да/Нет");
  } catch (e) {
    if (e instanceof InsufficientCrystalsError) {
      await d.repos.users.setState(user.telegramId, "CONVERSATION");
      await ctx.reply(t(loc, "billing_low_balance", { count: cost }), { ...HTML, reply_markup: buyMenuKeyboard(loc) });
      return;
    }
    throw e;
  }

  await d.repos.users.setState(user.telegramId, "CONVERSATION");
  await ctx.reply(loc === "en" ? "✨ Drawing a card…" : "✨ Тасую колоду…");

  try {
    // Draw 1 random card.
    const n = Math.floor(Math.random() * 78) + 1;
    const card = getCardByNumberLocalized(n, loc);
    const reversedNote = card.reversed ? (loc === "en" ? " (reversed)" : " (перевёрнута)") : "";
    const prompt = (loc === "en" ? YES_NO_PROMPT_EN : YES_NO_PROMPT_RU)
      .replace("{name}", user.name ?? "друг")
      .replace("{zodiac}", user.zodiacSign ?? "—")
      .replace("{question}", question.slice(0, 500))
      .replace("{cards}", `${card.name}${reversedNote}`);

    const messages = await d.services.context.buildMessages({
      systemPrompt: SOFIA_SYSTEM_PROMPT,
      userTelegramId: user.telegramId,
      userName: user.name,
      userZodiac: user.zodiacSign,
      userAgeGroup: user.ageGroup,
      currentUserMessage: prompt,
    });
    const res = await d.llm.generate(messages, { timeoutMs: 15000, maxTokens: 400 });
    const cardsJson = JSON.stringify({ name: card.name, reversed: card.reversed, position: "Ответ" });
    await d.repos.readings.save(user.id, "yes_no", question.slice(0, 500), cardsJson, res.content, cost);

    await ctx.reply(`🎴 <b>${escapeHtml(card.name)}</b>${reversedNote}`, HTML);
    for (const chunk of splitMessage(res.content)) {
      await ctx.reply(chunk, HTML);
    }
    await ctx.reply("🌙", { ...HTML, reply_markup: mainMenuKeyboard(user) });
  } catch (e) {
    await d.services.billing.refund(user.telegramId, cost, loc === "en" ? "Yes/No failure" : "Сбой Да/Нет");
    (ctx as any).log?.error?.({ err: e }, "yes/no reading failed");
    throw e;
  }
}
