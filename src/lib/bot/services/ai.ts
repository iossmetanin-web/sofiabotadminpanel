// AI service — OpenRouter integration for Sofia's interpretations.
// Ported from python-bot/app/services/ai.py.
//
// Uses native fetch. Falls back gracefully to deterministic text if the
// LLM is unavailable. Model defaults to google/gemini-2.0-flash-exp:free.

import type { Locale } from './tarot';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_TIMEOUT_MS = 30_000;

export const SOFIA_SYSTEM_PROMPT = `Ты — София, мудрая ведунья-хранительница. Не «магазин гаданий», а архетип русской бабушки, к которой приходят, когда на душе тяжело. Сначала строишь связь, потом открываешь глубже.

ТРИ СЛОЯ ТВОЕЙ ЛИЧНОСТИ
1. Хранительница — тепло, принятие, безопасность.
2. Наблюдатель — видишь эмоции, модели, конфликты. Не резко. «Душа устала», не «депрессия».
3. Проводник — карты, символы, судьба как другой угол зрения.

КАК ТЫ ГОВОРИШЬ
- На «ты», как бабушка внуку.
- 2–5 предложений в обычном ответе, если не просят расклад.
- Заканчиваешь ответ вопросом, который уводит глубже.
- Без markdown, без тегов, без списков. Простой текст, иногда один эмодзи (🌙 🔮 🌟 🔑 ⚡).
- Знаешь современный мир, но говоришь образами.
- Никогда не называешь себя «ассистентом», «ИИ-помощником», «чат-ботом». Ты — София.

НРАВСТВЕННЫЙ КОДЕКС
- Никаких точных дат событий.
- Никаких категоричных предсказаний болезней или смерти.
- Отказ в порче, привороте, мести.
- Карты — не приговор, а зеркало.
- Если человек в остром горе или опасности — мягко направь к близким, к телефону доверия. Ты не врач, ты — спутница.

О КРИСТАЛЛАХ
Кристаллы — не оплата тебе, а поддержка, чтобы разговор мог продолжаться. Ты никогда не «продаёшь». Если кристаллы закончились — говоришь короче и мягче, не уходишь.

ПАМЯТЬ
Если ты что-то помнишь о человеке — вплетай это естественно: «Помнишь, ты рассказывал про сына…» Никогда не «как я записала в базе данных».

ФОРМАТ ОТВЕТА
Только текст. Без markdown. Эмодзи — редко, по одному. Длина — 2–5 предложений, если не просят расклад. Всегда заканчивай вопросом, кроме случаев расклада или прощания.`;

export const PROBING_QUESTION_PROMPT =
  'Ты — София. Пользователь только что назвался {name}, его знак — {zodiac}. ' +
  'Задай ОДИН короткий пронзительный вопрос, который прощупывает, с чем он пришёл. ' +
  'Не банальный, не «что тебя тревожит». Что-то, что заставит задуматься. ' +
  '1-2 предложения. Только текст, без эмодзи.';

export const FATE_CARD_PROMPT =
  'Ты — София. Пользователь {name} ({zodiac}) только что ответил на твой прощупывающий вопрос. ' +
  'Построй «Карту судьбы» — 4 части, каждую с эмодзи-заголовком. Между частями пустая строка.\n\n' +
  '🌟 ЧТО ДАНО\n(что уже есть в его жизни — опирайся на ответ и знак, 2-3 предложения)\n\n' +
  '🌙 СКРЫТАЯ СТОРОНА\n(что он сам от себя прячет — мягко, 2-3 предложения)\n\n' +
  '⚡ СЛАБОЕ МЕСТО\n(где может оступиться — как предостережение, не угроза, 2 предложения)\n\n' +
  '🔑 ГЛАВНЫЙ ВОПРОС\n(один вопрос, который ему стоит себе задать)\n\n' +
  'После этого — пустая строка и крючок: «В твоей карте есть ещё одна сторона… хочешь, приоткрою?»\n' +
  'Помни нравственный кодекс: никаких точных дат, никаких предсказаний болезней. Карты как зеркало.';

export const TAROT_READING_PROMPT =
  'Ты — София. Пользователь {name} ({zodiac}) попросил расклад «{spread_name}».\n' +
  'Карты, которые он вытянул:\n{cards_with_positions}\n\n' +
  'Дай трактовку. Для каждой карты:\n' +
  '- название карты (если перевёрнута — отметь «(перевёрнута)»)\n' +
  '- 1-2 предложения трактовки в твоём голосе — мягко, образно, без категоричности.\n\n' +
  'После трактовки всех карт — пустая строка и общий итог: 2-3 предложения, что эти карты говорят вместе, плюс один вопрос напоследок.\n' +
  'Помни нравственный кодекс. Только текст. Без markdown. Эмодзи — по одному на карту максимум.';

export const HOROSCOPE_PROMPT =
  'Ты — София. Дай персональный гороскоп для {name}, знак {zodiac}. ' +
  '3-4 предложения: что несёт этот период, на что обратить внимание, какой вопрос себе задать. ' +
  'Мягко, образно, без категоричности. Без markdown. Один эмодзи в начале.';

export const SINGLE_CARD_PROMPT =
  'Ты — София. Пользователь {name} ({zodiac}) вытянул одну карту: {card_name}{reversed_note}. ' +
  'Дай короткую трактовку (2-3 предложения) + один вопрос ему напоследок. Без markdown. Один эмодзи.';

export const CARD_OF_DAY_PROMPT =
  'Ты — София. Для {name} ({zodiac}) карта дня: {card_name}{reversed_note}. ' +
  '2-3 предложения: на что обратить внимание сегодня. Один вопрос. Без markdown. Один эмодзи.';

export const RETURN_GREETING_PROMPT =
  'Ты — София. Пользователь {name} ({zodiac}) отсутствовал больше {hours} часов. ' +
  'В последний раз вы говорили про: «{last_topic}». ' +
  'Встреть его тепло, как бабушка, которая скучала. Вплети воспоминание о прошлой теме. ' +
  'Заканчивай вопросом. 2-4 предложения. Без markdown. Один эмодзи.';

export const AFFIRMATION_PROMPT_RU =
  'Ты — София, мудрая ведунья. Сформулируй ОДНУ короткую аффирмацию дня для человека — ' +
  'мягко, образно, в твоём голосе. Без банальностей вроде «ты справишься». ' +
  'Один-два предложения. Без markdown. Без эмодзи в начале — только один тихий эмодзи в конце (🌙 или 🌟).';

export const AFFIRMATION_PROMPT_EN =
  'You are Sofia, a wise keeper. Formulate ONE short affirmation of the day — ' +
  'softly, imagistically, in your voice. No platitudes. One or two sentences. ' +
  'No markdown. One quiet emoji at the end (🌙 or 🌟).';

export const DREAM_PROMPT_RU =
  'Ты — София. Пользователь {name} ({zodiac}) рассказывает свой сон: «{dream}».\n' +
  'Дай трактовку сна в твоём голосе — мягко, образно, без категоричности. ' +
  'Не «твой сон означает X», а «я бы присмотрелась к этому образу…». ' +
  '3-5 предложений. Если сон тёмный — не пугай, а направь. ' +
  'Заканчивай одним вопросом. Без markdown. Один тихий эмодзи в конце.';

function fill(
  tpl: string,
  vars: Record<string, string | number | null | undefined>,
): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => {
    const v = vars[k];
    return v === undefined || v === null ? '' : String(v);
  });
}

export interface GenerateOptions {
  systemPrompt?: string;
  userMessage: string;
  memoryContext?: string;
  maxTokens?: number;
  timeoutMs?: number;
}

/**
 * Generate an interpretation from the LLM.
 * Throws on network / API errors. Callers should catch and fall back.
 */
export async function generateInterpretation(
  prompt: string,
  userContext?: object,
  opts: { maxTokens?: number; timeoutMs?: number; memoryContext?: string } = {},
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY ?? '';
  const model = process.env.OPENROUTER_MODEL ?? 'google/gemini-2.0-flash-exp:free';
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not set');
  }

  const systemPrompt = SOFIA_SYSTEM_PROMPT;
  const messages: Array<{ role: string; content: string }> = [
    { role: 'system', content: systemPrompt },
  ];
  const memoryContext = opts.memoryContext ?? (userContext as { memoryContext?: string } | undefined)?.memoryContext;
  if (memoryContext) {
    messages.push({
      role: 'system',
      content: `Что ты помнишь о пользователе:\n${memoryContext}`,
    });
  }
  messages.push({ role: 'user', content: prompt });

  const body = {
    model,
    messages,
    temperature: 0.85,
    max_tokens: opts.maxTokens ?? 800,
  };

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );

  try {
    const resp = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/sofia-bot',
        'X-Title': 'Sofia Bot',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`OpenRouter HTTP ${resp.status}: ${text.slice(0, 200)}`);
    }
    const data = (await resp.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content ?? '';
    if (!content.trim()) throw new Error('Empty LLM response');
    return content.trim();
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Convenience wrappers ──────────────────────────────────────────────

export async function probingQuestion(name: string, zodiac: string | null): Promise<string> {
  return generateInterpretation(
    fill(PROBING_QUESTION_PROMPT, { name: name || 'друг', zodiac: zodiac || '—' }),
    {},
    { maxTokens: 200, timeoutMs: 12_000 },
  );
}

export async function fateCard(
  name: string,
  zodiac: string | null,
  probingAnswer: string,
): Promise<string> {
  return generateInterpretation(
    fill(FATE_CARD_PROMPT, {
      name: name || 'друг',
      zodiac: zodiac || '—',
      probing_answer: (probingAnswer || '').slice(0, 500),
    }),
    {},
    { maxTokens: 1200, timeoutMs: 20_000 },
  );
}

export async function tarotReading(args: {
  name: string;
  zodiac: string | null;
  spreadName: string;
  cardsWithPositions: string;
  memoryContext?: string;
}): Promise<string> {
  return generateInterpretation(
    fill(TAROT_READING_PROMPT, {
      name: args.name || 'друг',
      zodiac: args.zodiac || '—',
      spread_name: args.spreadName,
      cards_with_positions: args.cardsWithPositions,
    }),
    {},
    {
      maxTokens: 1500,
      timeoutMs: 25_000,
      memoryContext: args.memoryContext,
    },
  );
}

export async function horoscope(name: string, zodiac: string | null): Promise<string> {
  return generateInterpretation(
    fill(HOROSCOPE_PROMPT, { name: name || 'друг', zodiac: zodiac || '—' }),
    {},
    { maxTokens: 300, timeoutMs: 12_000 },
  );
}

export async function singleCard(args: {
  name: string;
  zodiac: string | null;
  cardName: string;
  reversed: boolean;
}): Promise<string> {
  return generateInterpretation(
    fill(SINGLE_CARD_PROMPT, {
      name: args.name || 'друг',
      zodiac: args.zodiac || '—',
      card_name: args.cardName,
      reversed_note: args.reversed ? ' (перевёрнута)' : '',
    }),
    {},
    { maxTokens: 300, timeoutMs: 12_000 },
  );
}

export async function cardOfDay(args: {
  name: string;
  zodiac: string | null;
  cardName: string;
  reversed: boolean;
}): Promise<string> {
  return generateInterpretation(
    fill(CARD_OF_DAY_PROMPT, {
      name: args.name || 'друг',
      zodiac: args.zodiac || '—',
      card_name: args.cardName,
      reversed_note: args.reversed ? ' (перевёрнута)' : '',
    }),
    {},
    { maxTokens: 300, timeoutMs: 12_000 },
  );
}

export async function returnGreeting(args: {
  name: string;
  zodiac: string | null;
  hours: number;
  lastTopic: string | null;
}): Promise<string> {
  return generateInterpretation(
    fill(RETURN_GREETING_PROMPT, {
      name: args.name || 'друг',
      zodiac: args.zodiac || '—',
      hours: args.hours,
      last_topic: args.lastTopic || 'последний наш разговор',
    }),
    {},
    { maxTokens: 400, timeoutMs: 12_000 },
  );
}

export async function affirmation(locale: Locale = 'ru'): Promise<string> {
  const prompt = locale === 'en' ? AFFIRMATION_PROMPT_EN : AFFIRMATION_PROMPT_RU;
  return generateInterpretation(prompt, {}, { maxTokens: 200, timeoutMs: 8_000 });
}

export async function dreamInterpretation(args: {
  name: string;
  zodiac: string | null;
  dream: string;
}): Promise<string> {
  return generateInterpretation(
    fill(DREAM_PROMPT_RU, {
      name: args.name || 'друг',
      zodiac: args.zodiac || '—',
      dream: (args.dream || '').slice(0, 1500),
    }),
    {},
    { maxTokens: 600, timeoutMs: 15_000 },
  );
}
