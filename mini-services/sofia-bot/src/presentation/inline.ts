// presentation/inline.ts — inline mode handler (@bot <query> in any chat).
// Per Skill §5: inline mode enables viral growth — users can summon Sofia in any chat.
// Returns Article results for: card draw, question preview, affirmation.

import type { Context } from "grammy";
import type { InlineQueryResultArticle } from "grammy/types";
import { deps } from "./deps.js";
import { t, type Locale, DEFAULT_LOCALE } from "../domain/i18n.js";
import {
  MAJOR_ARCANA, MAJOR_ARCANA_EN,
  MAJOR_ARCANA_KEYWORDS_RU, MAJOR_ARCANA_KEYWORDS_EN,
  AFFIRMATION_SEEDS_RU, AFFIRMATION_SEEDS_EN,
} from "../domain/tarot.js";
import {
  AFFIRMATION_PROMPT_RU, AFFIRMATION_PROMPT_EN,
  INLINE_QUESTION_PROMPT_RU, INLINE_QUESTION_PROMPT_EN,
} from "../domain/prompts.js";

// Resolve locale for an inline user. Falls back to default if unknown.
async function resolveLocale(telegramId: string): Promise<Locale> {
  try {
    const u = await deps().repos.users.findByTelegramId(telegramId);
    return (u?.language as Locale) ?? DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

// Deterministic card pick based on day-of-year + offset.
function dailyCardIndex(offset: number): number {
  const now = new Date();
  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86_400_000);
  return ((dayOfYear + offset * 7) % 22 + 22) % 22; // 22 Major Arcana only — small, meaningful pool.
}

export async function handleInlineQuery(ctx: Context): Promise<void> {
  if (!ctx.inlineQuery) return;
  const q = ctx.inlineQuery.query?.trim() ?? "";
  const d = deps();
  const log = (ctx as any).log;
  const locale = await resolveLocale(ctx.inlineQuery.from.id.toString());
  const isEn = locale === "en";

  const results: InlineQueryResultArticle[] = [];

  // 1. Card of the moment — always offered first.
  {
    const idx = dailyCardIndex(0);
    const name = isEn ? MAJOR_ARCANA_EN[idx] : MAJOR_ARCANA[idx];
    const meaning = (isEn ? MAJOR_ARCANA_KEYWORDS_EN : MAJOR_ARCANA_KEYWORDS_RU)[name] ?? "";
    results.push({
      type: "article",
      id: `card-${idx}`,
      title: t(locale, "inline_card_title", { name }),
      description: t(locale, "inline_card_desc", { meaning }),
      input_message_content: {
        message_text: `🃏 <b>${name}</b>\n\n${meaning}\n\n— ${isEn ? "Sofia" : "София"} ${isEn ? "(open the chat for a deeper reading)" : "(загляни в чат, чтобы открыть глубже)"}`,
        parse_mode: "HTML",
      },
      reply_markup: {
        inline_keyboard: [[
          { text: t(locale, "inline_card_btn"), url: `https://t.me/${d.botUsername}?start=card` },
        ]],
      },
    });
  }

  // 2. Affirmation of the moment — second.
  {
    const seedIdx = (dailyCardIndex(1)) % (isEn ? AFFIRMATION_SEEDS_EN.length : AFFIRMATION_SEEDS_RU.length);
    const seed = isEn ? AFFIRMATION_SEEDS_EN[seedIdx] : AFFIRMATION_SEEDS_RU[seedIdx];
    // Build a brief description; the actual affirmation is generated on click (cached below).
    results.push({
      type: "article",
      id: "affirmation",
      title: t(locale, "inline_affirmation_title"),
      description: isEn ? "A quiet word from Sofia for this moment." : "Тихое слово Софии для этого момента.",
      input_message_content: {
        message_text: isEn
          ? `🌙 <b>Affirmation of the moment</b>\n\nBe like ${seed}.\n\n— Sofia`
          : `🌙 <b>Аффирмация момента</b>\n\nБудь как ${seed}.\n\n— София`,
        parse_mode: "HTML",
      },
      reply_markup: {
        inline_keyboard: [[
          { text: t(locale, "inline_affirmation_btn"), url: `https://t.me/${d.botUsername}?start=affirmation` },
        ]],
      },
    });
  }

  // 3. If the user typed a question — fetch a short LLM answer as a preview.
  if (q.length >= 3) {
    try {
      const prompt = (isEn ? INLINE_QUESTION_PROMPT_EN : INLINE_QUESTION_PROMPT_RU).replace("{q}", q.slice(0, 500));
      const reply = await d.llm.generate(
        [{ role: "user", content: prompt }],
        { timeoutMs: 6000, maxTokens: 120 },
      );
      const text = reply.content?.trim() || (isEn ? "The mist hasn't lifted yet." : "Туман ещё не разошёлся.");
      results.push({
        type: "article",
        id: "question",
        title: t(locale, "inline_question_title", { q: q.slice(0, 80) }),
        description: text.slice(0, 200),
        input_message_content: {
          message_text: `🔮 <b>${escapeHtml(q)}</b>\n\n${escapeHtml(text)}\n\n— ${isEn ? "Sofia" : "София"}`,
          parse_mode: "HTML",
        },
        reply_markup: {
          inline_keyboard: [[
            { text: t(locale, "inline_question_btn"), url: `https://t.me/${d.botUsername}?start=question` },
          ]],
        },
      });
    } catch (e: any) {
      log?.warn?.({ err: e }, "inline question LLM call failed — skipping question result");
    }
  }

  try {
    await ctx.answerInlineQuery(results, {
      cache_time: 60,
      is_personal: true,
      next_offset: "",
    });
  } catch (e: any) {
    log?.warn?.({ err: e }, "answerInlineQuery failed");
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
