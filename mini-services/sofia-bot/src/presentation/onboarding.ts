// presentation/onboarding.ts — onboarding state handlers.
// Flow: ASK_NAME → ASK_BIRTH_DATE → ASK_BIRTH_TIME → ASK_BIRTH_PLACE → PROBING → FREE_READING → CONVERSATION.

import type { Context } from "grammy";
import { deps } from "./deps.js";
import { SOFIA_SYSTEM_PROMPT, PROBING_QUESTION_PROMPT, FATE_CARD_PROMPT } from "../domain/prompts.js";
import { BirthDate, MessageText } from "../domain/valueObjects.js";
import { getZodiacFromIso, ageGroupFromYear, inferGender } from "../domain/zodiac.js";
import { ValidationError } from "../domain/exceptions.js";
import { FATE_CARD_PARTS } from "../domain/tarot.js";
import { mainMenuKeyboard, paidHookKeyboard } from "./keyboards.js";
import { escapeHtml, splitMessage } from "./formatters.js";
import { env } from "../config/env.js";
import { t, type Locale } from "../domain/i18n.js";

const HTML = { parse_mode: "HTML" as const };

export async function handleOnboardingMessage(ctx: Context, text: string): Promise<boolean> {
  if (!ctx.from) return false;
  const d = deps();
  const tgId = ctx.from.id.toString();
  const user = (ctx as any).userDto ?? await d.repos.users.findByTelegramId(tgId);
  if (!user) return false;

  switch (user.onboardingStep) {
    case "ASK_NAME": return handleAskName(ctx, user, text);
    case "ASK_BIRTH_DATE": return handleAskBirthDate(ctx, user, text);
    case "ASK_BIRTH_TIME": return handleAskBirthTime(ctx, user, text);
    case "ASK_BIRTH_PLACE": return handleAskBirthPlace(ctx, user, text);
    case "PROBING": return handleProbing(ctx, user, text);
    case "FREE_READING": return true; // auto-handled on entry
    default: return false;
  }
}

async function handleAskName(ctx: Context, user: any, text: string): Promise<boolean> {
  const d = deps();
  const loc: Locale = user.language;
  try {
    const name = MessageText.from(text).forStorage(100);
    const gender = inferGender(name);
    await d.repos.users.update(user.telegramId, { name, gender });
    await d.repos.users.setState(user.telegramId, "ASK_BIRTH_DATE");
    await d.repos.conversations.save(user.id, "user", name);
    await ctx.reply(
      loc === "en"
        ? `${name}, a beautiful name. And when were you born? The day and month, or the full date — so I can see your sign better.`
        : `${name}, красивое имя. А когда ты родился? День и месяц подскажи, или полную дату — так я лучше увижу твой знак.`,
    );
  } catch (e) {
    if (e instanceof ValidationError) {
      await ctx.reply(loc === "en" ? "Hmm, I didn't catch the name. What shall I call you?" : "Hmm, я не расслышала имя. Как тебя называть?");
    } else throw e;
  }
  return true;
}

async function handleAskBirthDate(ctx: Context, user: any, text: string): Promise<boolean> {
  const d = deps();
  const loc: Locale = user.language;
  const lower = text.toLowerCase();
  try {
    const bd = BirthDate.parse(lower);
    const zodiac = getZodiacFromIso(bd.iso);
    const ageGroup = ageGroupFromYear(bd.year);
    await d.repos.users.update(user.telegramId, {
      birthDate: bd.iso, zodiacSign: zodiac?.name ?? null, ageGroup,
    });
    await d.repos.users.setState(user.telegramId, "ASK_BIRTH_TIME");
    const zodiacLine = zodiac ? (loc === "en" ? `Your sign is ${zodiac.emoji} ${zodiac.name}. ` : `Знак твой — ${zodiac.emoji} ${zodiac.name}. `) : "";
    await ctx.reply(
      loc === "en"
        ? `${zodiacLine}And at what time were you born, if you remember? You can say "skip" — it is not the main thing.`
        : `${zodiacLine}А во сколько ты родился, если помнишь? Можно «пропустить» — это не главное.`,
    );
  } catch (e) {
    if (e instanceof ValidationError) {
      await ctx.reply(loc === "en" ? "Hmm, I was waiting for a day and month like 12.05. Try once more? Or 'skip'." : "Hmm, я ждала день и месяц вроде 12.05. Попробуешь ещё раз? Или «пропустить».");
    } else throw e;
  }
  return true;
}

async function handleAskBirthTime(ctx: Context, user: any, text: string): Promise<boolean> {
  const d = deps();
  const loc: Locale = user.language;
  const lower = text.toLowerCase();
  if (lower.match(/^(пропустить|пропуск|skip|не помню|далее|дальше|don't remember|dont remember|next)/)) {
    await d.repos.users.setState(user.telegramId, "ASK_BIRTH_PLACE");
    await ctx.reply(loc === "en" ? "Very well. And where were you born? You can say 'skip'." : "Хорошо. А где ты родился? Можно «пропустить».");
    return true;
  }
  const timeMatch = lower.match(/(\d{1,2})[:.](\d{2})/);
  if (timeMatch) {
    await d.repos.users.update(user.telegramId, { birthTime: `${timeMatch[1]}:${timeMatch[2]}` });
  }
  await d.repos.users.setState(user.telegramId, "ASK_BIRTH_PLACE");
  await ctx.reply(loc === "en" ? "Remembered. And where were you born? You can say 'skip'." : "Запомнила. А где ты родился? Можно «пропустить».");
  return true;
}

async function handleAskBirthPlace(ctx: Context, user: any, text: string): Promise<boolean> {
  const d = deps();
  const loc: Locale = user.language;
  const lower = text.toLowerCase();
  if (!lower.match(/^(пропустить|пропуск|skip|не помню|далее|дальше|don't remember|dont remember|next)/)) {
    const place = MessageText.from(text).forStorage(200);
    await d.repos.users.update(user.telegramId, { birthPlace: place });
  }
  await d.repos.users.setState(user.telegramId, "PROBING");
  await ctx.reply(loc === "en" ? "Now I see you a little. Give me a moment to look closer…" : "Теперь я немного вижу тебя. Дай мне миг всмотреться…");
  try {
    const messages = await d.services.context.buildMessages({
      systemPrompt: SOFIA_SYSTEM_PROMPT,
      userTelegramId: user.telegramId,
      userName: user.name,
      userZodiac: user.zodiacSign,
      userAgeGroup: user.ageGroup,
      currentUserMessage: PROBING_QUESTION_PROMPT
        .replace("{name}", user.name ?? "друг")
        .replace("{zodiac}", user.zodiacSign ?? "—"),
    });
    const res = await d.llm.generate(messages, { timeoutMs: 12000, maxTokens: 200 });
    await ctx.reply(res.content);
  } catch (e) {
    await ctx.reply(loc === "en" ? "What brings you to me today? I want to hear." : "Что привело тебя ко мне сегодня? Я хочу услышать.");
  }
  return true;
}

async function handleProbing(ctx: Context, user: any, text: string): Promise<boolean> {
  const d = deps();
  // Save the probing answer, then enter FREE_READING.
  await d.repos.conversations.save(user.id, "user", text.slice(0, 2000));
  await d.repos.users.setState(user.telegramId, "FREE_READING");
  await deliverFateCard(ctx, user, text);
  return true;
}

// Deliver the 4-part fate card. Called once per user on onboarding completion.
export async function deliverFateCard(ctx: Context, user: any, probingAnswer: string): Promise<void> {
  const d = deps();
  const loc: Locale = user.language;
  await ctx.reply(loc === "en" ? "🔮 Gazing into your card… give me a moment." : "🔮 Всматриваюсь в твою карту… дай мне миг.");

  const prompt = FATE_CARD_PROMPT
    .replace("{name}", user.name ?? "друг")
    .replace("{zodiac}", user.zodiacSign ?? "—")
    .replace("{probing_q}", "(вопрос Софии)")
    .replace("{probing_a}", probingAnswer.slice(0, 500));

  try {
    const messages = await d.services.context.buildMessages({
      systemPrompt: SOFIA_SYSTEM_PROMPT,
      userTelegramId: user.telegramId,
      userName: user.name,
      userZodiac: user.zodiacSign,
      userAgeGroup: user.ageGroup,
      currentUserMessage: prompt,
    });
    const res = await d.llm.generate(messages, { timeoutMs: 20000, maxTokens: 1200 });
    const content = res.content;

    await d.repos.readings.save(user.id, "fate_card", null, "[]", content, 0);
    await d.repos.users.update(user.telegramId, { onboardingCompleted: true, lastTopicSummary: loc === "en" ? "fate card" : "карта судьбы" });
    await d.repos.users.setState(user.telegramId, "CONVERSATION");

    for (const chunk of splitMessage(content)) {
      await ctx.reply(chunk, HTML);
    }
    await ctx.reply(
      loc === "en" ? "There is another side to your card… shall I open it?" : "В твоей карте есть ещё одна сторона… хочешь, приоткрою?",
      { ...HTML, reply_markup: paidHookKeyboard(loc) },
    );
  } catch (e) {
    await ctx.reply(loc === "en" ? "The mist is thick today, dear. The card doesn't want to open fully. Drop by later — or we can simply talk. 🌙" : "Туман сегодня густой, милый. Карта не хочет открываться полностью. Загляни чуть позже — или просто поговорим. 🌙");
    await d.repos.users.update(user.telegramId, { onboardingCompleted: true });
    await d.repos.users.setState(user.telegramId, "CONVERSATION");
  }
}
