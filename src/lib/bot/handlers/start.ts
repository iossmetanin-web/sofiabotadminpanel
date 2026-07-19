// /start command + onboarding FSM.
// Ported from python-bot/app/handlers/start.py.
//
// FSM states are stored in `User.onboardingStep` column (NOT in memory) so
// they survive across webhook invocations.
//
//   START → ASK_NAME → ASK_BIRTH_DATE → ASK_BIRTH_TIME → ASK_BIRTH_PLACE
//         → ASK_GENDER → ASK_AGE_GROUP → PROBING → FREE_READING → CONVERSATION
// Transient: AWAIT_NUMBERS, DREAM, AWAIT_DELETE_CONFIRM, BROADCAST, ADMIN_PANEL

import { db } from '@/lib/db';
import type { TelegramMessage } from '../types';
import { sendMessage, sendChatAction } from '../telegram';
import {
  detectLocale,
  t,
  type Locale,
} from '../i18n';
import { mainMenuKeyboard, paidHookKeyboard } from '../keyboards';
import {
  newReferralCode,
  findUserByTelegramId,
  isAdmin,
  splitMessage,
  RETURN_ABSENCE_HOURS,
} from './_helpers';
import * as crystals from '../services/crystals';
import {
  ageGroupFromYear,
  getZodiacFromISO,
  inferGender,
  parseBirthDate,
} from '../services/zodiac';
import {
  affirmation,
  fateCard,
  probingQuestion,
  returnGreeting,
} from '../services/ai';

const SKIP_WORDS = new Set([
  'пропустить', 'пропуск', 'skip', 'не помню', 'далее', 'дальше',
  "don't remember", 'dont remember', 'next',
]);

/** Parse /start argument: ref_<code> | card | affirmation | question | lang. */
function parseStartArgs(args: string): {
  referralCode: string | null;
  deepAction: 'card' | 'affirmation' | 'question' | 'lang' | null;
} {
  const a = args.trim();
  if (!a) return { referralCode: null, deepAction: null };
  if (a.startsWith('ref_')) {
    return { referralCode: a.slice(4), deepAction: null };
  }
  if (a === 'card' || a === 'affirmation' || a === 'question' || a === 'lang') {
    return { referralCode: null, deepAction: a };
  }
  return { referralCode: null, deepAction: null };
}

/** /start handler. Creates user on first contact, resumes onboarding otherwise. */
export async function handleStart(message: TelegramMessage): Promise<void> {
  if (!message.from) return;
  const tgId = String(message.from.id);
  const args = (message.text ?? '').replace(/^\/start\s*/i, '').trim();
  const { referralCode, deepAction } = parseStartArgs(args);
  const chatId = message.chat.id;

  let user = await findUserByTelegramId(tgId);

  if (!user) {
    // First contact — create user, start onboarding.
    const detectedLocale = detectLocale(message.from.language_code);
    const welcomeCrystals = crystals.welcomeBonus();
    let referredById: string | null = null;
    if (referralCode) {
      const referrer = await db.user.findUnique({
        where: { referralCode },
        select: { id: true },
      });
      if (referrer) referredById = referrer.id;
    }
    user = await db.user.create({
      data: {
        telegramId: tgId,
        username: message.from.username ?? null,
        firstName: message.from.first_name ?? null,
        lastName: message.from.last_name ?? null,
        language: detectedLocale,
        referralCode: newReferralCode(),
        referredById,
        crystals: welcomeCrystals,
        isAdmin: isAdmin(tgId),
        onboardingStep: 'ASK_NAME',
      },
    });
    console.log('[start] new_user', { tgId, referralCode: user.referralCode, referredById });
    await sendMessage(chatId, t('onboarding_greeting', detectedLocale));
    return;
  }

  const loc = (user.language as Locale) ?? 'ru';
  if (user.isBlocked) {
    await sendMessage(chatId, t('err_blocked', loc));
    return;
  }

  // Returning user — bump lastSeenAt, reset rudeness counter.
  await db.user.update({
    where: { id: user.id },
    data: {
      lastSeenAt: new Date(),
      username: message.from.username ?? user.username,
      isBlocked: false,
      rudenessCount: 0,
    },
  });

  // Daily streak bonus.
  await crystals.checkAndGiveDailyBonus(user.id);

  // Resume onboarding if not completed.
  if (!user.onboardingCompleted) {
    await resumeOnboarding(message, user.onboardingStep || 'ASK_NAME', loc);
    return;
  }

  // Deep-link actions for returning users.
  if (deepAction) {
    await db.user.update({
      where: { id: user.id },
      data: { onboardingStep: 'CONVERSATION' },
    });
    if (deepAction === 'affirmation') {
      await sendAffirmation(message, user, loc);
      return;
    }
    if (deepAction === 'card' || deepAction === 'question') {
      await sendMessage(
        chatId,
        loc === 'en'
          ? '🃏 Let me draw a card for you. Use /readings.'
          : '🃏 Я вытяну для тебя карту. Используй /readings.',
        { reply_markup: mainMenuKeyboard(user, loc) },
      );
      return;
    }
    if (deepAction === 'lang') {
      await sendMessage(chatId, t('lang_select', loc));
      return;
    }
  }

  // Long absence → return greeting.
  const lastSeen = user.lastSeenAt;
  const absenceHours =
    lastSeen && Date.now() - new Date(lastSeen).getTime() > 0
      ? (Date.now() - new Date(lastSeen).getTime()) / 3_600_000
      : 0;

  if (absenceHours > RETURN_ABSENCE_HOURS && lastSeen) {
    try {
      const reply = await returnGreeting({
        name: user.name ?? 'друг',
        zodiac: user.zodiacSign,
        hours: Math.floor(absenceHours),
        lastTopic: user.lastTopicSummary,
      });
      await db.user.update({
        where: { id: user.id },
        data: { onboardingStep: 'CONVERSATION' },
      });
      await sendMessage(chatId, reply, {
        reply_markup: mainMenuKeyboard(user, loc),
      });
      return;
    } catch (e) {
      console.warn('[start] return_greeting failed', e);
    }
  }

  await db.user.update({
    where: { id: user.id },
    data: { onboardingStep: 'CONVERSATION' },
  });
  const name = user.name ?? t('return_greeting_default', loc);
  await sendMessage(chatId, t('return_known', loc, { name }), {
    reply_markup: mainMenuKeyboard(user, loc),
  });
}

async function resumeOnboarding(
  message: TelegramMessage,
  step: string,
  loc: Locale,
): Promise<void> {
  const keyMap: Record<string, string> = {
    ASK_NAME: 'onboarding_ask_name',
    ASK_BIRTH_DATE: 'onboarding_ask_birth_date',
    ASK_BIRTH_TIME: 'onboarding_ask_birth_time',
    ASK_BIRTH_PLACE: 'onboarding_ask_birth_place',
    ASK_GENDER: 'onboarding_ask_gender',
    ASK_AGE_GROUP: 'onboarding_ask_age_group',
    PROBING: 'onboarding_probing_resume',
  };
  const key = keyMap[step] ?? 'onboarding_unknown_step';
  await sendMessage(message.chat.id, t(key, loc));
}

/**
 * Handle a non-command text message when the user is in onboarding.
 * Returns true if handled (FSM state matched), false otherwise.
 */
export async function handleOnboardingMessage(message: TelegramMessage): Promise<boolean> {
  if (!message.from || !message.text) return false;
  const tgId = String(message.from.id);
  const user = await findUserByTelegramId(tgId);
  if (!user) return false;
  const step = user.onboardingStep ?? '';
  const loc = (user.language as Locale) ?? 'ru';
  const text = message.text;

  switch (step) {
    case 'ASK_NAME':
      return await hAskName(message, user, text, loc);
    case 'ASK_BIRTH_DATE':
      return await hAskBirthDate(message, user, text, loc);
    case 'ASK_BIRTH_TIME':
      return await hAskBirthTime(message, user, text, loc);
    case 'ASK_BIRTH_PLACE':
      return await hAskBirthPlace(message, user, text, loc);
    case 'ASK_GENDER':
      return await hAskGender(message, user, text, loc);
    case 'ASK_AGE_GROUP':
      return await hAskAgeGroup(message, user, text, loc);
    case 'PROBING':
      return await hProbing(message, user, text, loc);
    default:
      return false;
  }
}

async function hAskName(
  message: TelegramMessage,
  user: { id: string; telegramId: string; language: string },
  text: string,
  loc: Locale,
): Promise<boolean> {
  const name = text.trim().slice(0, 100);
  if (!name || name.length < 2) {
    await sendMessage(message.chat.id, t('onboarding_invalid_name', loc));
    return true;
  }
  const gender = inferGender(name);
  await db.user.update({
    where: { id: user.id },
    data: { name, gender },
  });
  await db.conversation.create({
    data: { userId: user.id, role: 'user', content: name },
  });
  await db.user.update({
    where: { id: user.id },
    data: { onboardingStep: 'ASK_BIRTH_DATE' },
  });
  const line = loc === 'en'
    ? `${name}, a beautiful name. And when were you born? The day and month, or the full date.`
    : `${name}, красивое имя. А когда ты родился? День и месяц подскажи, или полную дату — так я лучше увижу твой знак.`;
  await sendMessage(message.chat.id, line);
  return true;
}

async function hAskBirthDate(
  message: TelegramMessage,
  user: { id: string; telegramId: string },
  text: string,
  loc: Locale,
): Promise<boolean> {
  const parsed = parseBirthDate(text.trim());
  if (!parsed) {
    await sendMessage(message.chat.id, t('onboarding_invalid_date', loc));
    return true;
  }
  const zodiac = getZodiacFromISO(parsed.iso);
  const ageGroup = ageGroupFromYear(parsed.year);
  await db.user.update({
    where: { id: user.id },
    data: {
      birthDate: new Date(parsed.iso),
      zodiacSign: zodiac?.name ?? null,
      ageGroup,
      onboardingStep: 'ASK_BIRTH_TIME',
    },
  });
  const zodiacLine = zodiac
    ? (loc === 'en'
      ? `Your sign is ${zodiac.emoji} ${zodiac.nameEn}. `
      : `Знак твой — ${zodiac.emoji} ${zodiac.name}. `)
    : '';
  const tail = loc === 'en'
    ? 'And at what time were you born, if you remember? You can say "skip".'
    : 'А во сколько ты родился, если помнишь? Можно «пропустить» — это не главное.';
  await sendMessage(message.chat.id, zodiacLine + tail);
  return true;
}

async function hAskBirthTime(
  message: TelegramMessage,
  user: { id: string },
  text: string,
  loc: Locale,
): Promise<boolean> {
  const lower = text.toLowerCase().trim();
  if (SKIP_WORDS.has(lower)) {
    await db.user.update({
      where: { id: user.id },
      data: { onboardingStep: 'ASK_BIRTH_PLACE' },
    });
    await sendMessage(
      message.chat.id,
      loc === 'en'
        ? "Very well. And where were you born? You can say 'skip'."
        : 'Хорошо. А где ты родился? Можно «пропустить».',
    );
    return true;
  }
  const m = text.match(/(\d{1,2})[:.](\d{2})/);
  if (m) {
    await db.user.update({
      where: { id: user.id },
      data: { birthTime: `${m[1]}:${m[2]}` },
    });
  }
  await db.user.update({
    where: { id: user.id },
    data: { onboardingStep: 'ASK_BIRTH_PLACE' },
  });
  await sendMessage(
    message.chat.id,
    loc === 'en'
      ? "Remembered. And where were you born? You can say 'skip'."
      : 'Запомнила. А где ты родился? Можно «пропустить».',
  );
  return true;
}

async function hAskBirthPlace(
  message: TelegramMessage,
  user: { id: string },
  text: string,
  loc: Locale,
): Promise<boolean> {
  if (!SKIP_WORDS.has(text.trim().toLowerCase())) {
    await db.user.update({
      where: { id: user.id },
      data: { birthPlace: text.trim().slice(0, 200) },
    });
  }
  await db.user.update({
    where: { id: user.id },
    data: { onboardingStep: 'ASK_GENDER' },
  });
  await sendMessage(message.chat.id, t('onboarding_ask_gender', loc));
  return true;
}

async function hAskGender(
  message: TelegramMessage,
  user: { id: string },
  text: string,
  loc: Locale,
): Promise<boolean> {
  const lower = text.toLowerCase().trim();
  let gender: string | null = null;
  if (SKIP_WORDS.has(lower)) {
    // skip
  } else if (/(муж|male|\bm\b|^m$)/.test(lower)) {
    gender = 'male';
  } else if (/(жен|female|\bж\b|^f$)/.test(lower)) {
    gender = 'female';
  }
  const updateData: { gender?: string | null; onboardingStep: string } = {
    onboardingStep: 'ASK_AGE_GROUP',
  };
  if (gender) updateData.gender = gender;
  await db.user.update({ where: { id: user.id }, data: updateData });
  await sendMessage(message.chat.id, t('onboarding_ask_age_group', loc));
  return true;
}

async function hAskAgeGroup(
  message: TelegramMessage,
  user: { id: string; name: string | null; zodiacSign: string | null },
  text: string,
  loc: Locale,
): Promise<boolean> {
  const lower = text.toLowerCase().trim();
  let group: string | null = null;
  if (SKIP_WORDS.has(lower)) {
    // skip
  } else {
    const m = lower.match(/\d+/);
    if (m) {
      const age = Number.parseInt(m[0], 10);
      if (age < 18) group = 'young';
      else if (age < 25) group = 'young_adult';
      else if (age < 40) group = 'adult';
      else if (age < 60) group = 'mature';
      else group = 'senior';
    } else if (lower.includes('18') && lower.includes('25')) {
      group = 'young_adult';
    } else if (lower.includes('25') && lower.includes('40')) {
      group = 'adult';
    } else if (lower.includes('40') && lower.includes('60')) {
      group = 'mature';
    } else if (lower.includes('60')) {
      group = 'senior';
    }
  }
  const updateData: { ageGroup?: string | null; onboardingStep: string } = {
    onboardingStep: 'PROBING',
  };
  if (group) updateData.ageGroup = group;
  await db.user.update({ where: { id: user.id }, data: updateData });
  await askProbingQuestion(message, user, loc);
  return true;
}

async function askProbingQuestion(
  message: TelegramMessage,
  user: { id: string; name: string | null; zodiacSign: string | null },
  loc: Locale,
): Promise<void> {
  await sendMessage(message.chat.id, t('onboarding_completed', loc));
  try {
    const q = await probingQuestion(user.name ?? 'друг', user.zodiacSign);
    await sendMessage(message.chat.id, q);
  } catch (e) {
    console.warn('[start] probing_llm_failed', e);
    await sendMessage(
      message.chat.id,
      loc === 'en'
        ? 'What brings you to me today? I want to hear.'
        : 'Что привело тебя ко мне сегодня? Я хочу услышать.',
    );
  }
}

async function hProbing(
  message: TelegramMessage,
  user: { id: string; telegramId: string; name: string | null; zodiacSign: string | null; language: string },
  text: string,
  loc: Locale,
): Promise<boolean> {
  await db.conversation.create({
    data: { userId: user.id, role: 'user', content: text.slice(0, 2000) },
  });
  await db.user.update({
    where: { id: user.id },
    data: { onboardingStep: 'FREE_READING' },
  });
  await deliverFateCard(message, user, text, loc);
  return true;
}

async function deliverFateCard(
  message: TelegramMessage,
  user: { id: string; telegramId: string; name: string | null; zodiacSign: string | null; language: string },
  probingAnswer: string,
  loc: Locale,
): Promise<void> {
  await sendMessage(message.chat.id, t('reading_processing', loc));
  await sendChatAction(message.chat.id, 'typing');
  try {
    const content = await fateCard(
      user.name ?? 'друг',
      user.zodiacSign,
      probingAnswer,
    );
    await db.reading.create({
      data: {
        userId: user.id,
        type: 'fate_card',
        cards: '[]',
        interpretation: content,
        cost: 0,
      },
    });
    await db.user.update({
      where: { id: user.id },
      data: {
        onboardingCompleted: true,
        onboardingStep: 'CONVERSATION',
        lastTopicSummary: loc === 'en' ? 'fate card' : 'карта судьбы',
      },
    });
    for (const chunk of splitMessage(content, 4000)) {
      await sendMessage(message.chat.id, chunk);
    }
    await sendMessage(
      message.chat.id,
      t('fate_card_hook', loc),
      { reply_markup: paidHookKeyboard(loc) },
    );

    // Reward referrer (if any) on onboarding completion.
    if (user.telegramId) {
      const fresh = await db.user.findUnique({
        where: { id: user.id },
        select: { referredById: true },
      });
      if (fresh?.referredById) {
        await crystals.rewardReferral(fresh.referredById, user.id).catch(() => {});
      }
    }
  } catch (e) {
    console.warn('[start] fate_card_llm_failed', e);
    await db.user.update({
      where: { id: user.id },
      data: { onboardingCompleted: true, onboardingStep: 'CONVERSATION' },
    });
    await sendMessage(message.chat.id, t('fate_card_failed', loc));
  }
}

async function sendAffirmation(
  message: TelegramMessage,
  user: { id: string; language: string },
  loc: Locale,
): Promise<void> {
  let body = t('affirmation_fallback', loc);
  try {
    const text = await affirmation(loc);
    if (text) body = text;
  } catch (e) {
    console.warn('[start] affirmation_llm_failed', e);
  }
  await sendMessage(
    message.chat.id,
    `${t('affirmation_intro', loc)}\n\n${body}`,
    { reply_markup: mainMenuKeyboard({ isAdmin: false }, loc) },
  );
}

// End of start.ts
