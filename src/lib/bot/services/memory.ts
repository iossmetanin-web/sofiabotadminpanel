// Memory service — user memory (facts + emotional context).
// Ported from python-bot/app/services/memory.py.

import { db } from '@/lib/db';
import type { Memory } from '@prisma/client';

export const FACT_CATEGORIES = new Set([
  'pain', 'relationship', 'work', 'family', 'goal', 'fear', 'promise',
  'personality', 'health',
]);

export const EMOTIONAL_CATEGORIES = new Set([
  'main_pain', 'loved_one', 'promise', 'unfinished_question', 'life_event',
  'fear', 'goal', 'breakthrough',
]);

export const FACT_CATEGORY_LABELS_RU: Record<string, string> = {
  pain: 'Боль',
  relationship: 'Отношения',
  work: 'Дело',
  family: 'Семья',
  goal: 'Цель',
  fear: 'Страх',
  promise: 'Обещание',
  personality: 'Характер',
  health: 'Здоровье',
};

export const EMOTIONAL_CATEGORY_LABELS_RU: Record<string, string> = {
  main_pain: 'Главная боль',
  loved_one: 'Близкий человек',
  promise: 'Обещание себе',
  unfinished_question: 'Незакрытый вопрос',
  life_event: 'Событие жизни',
  fear: 'Страх',
  goal: 'Цель',
  breakthrough: 'Прорыв',
};

export async function addFact(
  userId: string,
  category: string,
  content: string,
  importance = 3,
): Promise<void> {
  if (!FACT_CATEGORIES.has(category)) return;
  try {
    await db.memory.create({
      data: {
        userId,
        kind: 'fact',
        category,
        content: content.slice(0, 1000),
        importance: Math.max(1, Math.min(5, importance)),
      },
    });
  } catch {
    // unique constraint → duplicate, ignore
  }
}

export async function addEmotion(
  userId: string,
  category: string,
  content: string,
): Promise<void> {
  if (!EMOTIONAL_CATEGORIES.has(category)) return;
  try {
    await db.memory.create({
      data: {
        userId,
        kind: 'emotional',
        category,
        content: content.slice(0, 1000),
        importance: 3,
      },
    });
  } catch {
    // unique constraint → ignore
  }
}

export async function getFacts(userId: string): Promise<Memory[]> {
  return db.memory.findMany({
    where: { userId, kind: 'fact' },
    orderBy: [{ importance: 'desc' }, { createdAt: 'desc' }],
  });
}

export async function getEmotions(userId: string): Promise<Memory[]> {
  return db.memory.findMany({
    where: { userId, kind: 'emotional' },
    orderBy: [{ importance: 'desc' }, { createdAt: 'desc' }],
  });
}

export async function getUserMemory(userId: string): Promise<Memory[]> {
  return db.memory.findMany({
    where: { userId },
    orderBy: [{ importance: 'desc' }, { createdAt: 'desc' }],
  });
}

/**
 * Build a short memory context string for the LLM prompt.
 * Only the highest-importance memories are included, to keep token usage low.
 */
export async function summarizeForPrompt(
  userId: string,
  limit = 10,
): Promise<string> {
  const memories = await db.memory.findMany({
    where: { userId },
    orderBy: [{ importance: 'desc' }, { createdAt: 'desc' }],
    take: limit,
  });
  if (memories.length === 0) return '';
  const lines = memories.map((m) => {
    const label =
      FACT_CATEGORY_LABELS_RU[m.category] ??
      EMOTIONAL_CATEGORY_LABELS_RU[m.category] ??
      m.category;
    return `- ${label}: ${m.content}`;
  });
  return lines.join('\n');
}

/** Render the user's memory as a friendly HTML block for /memory command. */
export async function formatMemoryForUser(
  userId: string,
  lastTopicSummary: string | null,
): Promise<string> {
  const memories = await getUserMemory(userId);
  if (memories.length === 0) {
    return 'Я ещё ничего о тебе не запомнила. Поговори со мной — и я начну хранить то, что важно. 🌙';
  }
  const facts = memories.filter((m) => m.kind === 'fact');
  const emotional = memories.filter((m) => m.kind === 'emotional');
  const parts: string[] = ['📓 <b>Что я помню о тебе</b>\n'];
  if (facts.length > 0) {
    parts.push('<b>Факты:</b>');
    for (const m of facts) {
      const label = FACT_CATEGORY_LABELS_RU[m.category] ?? m.category;
      parts.push(`  • ${label}: ${m.content}`);
    }
  }
  if (emotional.length > 0) {
    parts.push('\n<b>Эмоциональные моменты:</b>');
    for (const m of emotional) {
      const label = EMOTIONAL_CATEGORY_LABELS_RU[m.category] ?? m.category;
      parts.push(`  • ${label}: ${m.content}`);
    }
  }
  if (lastTopicSummary) {
    parts.push(`\n<b>Последняя тема:</b> ${lastTopicSummary}`);
  }
  parts.push('\n\nЕсли хочешь, чтобы я забыла что-то — попроси в чате. 🌙');
  return parts.join('\n');
}

export async function deleteAll(userId: string): Promise<void> {
  await db.memory.deleteMany({ where: { userId } });
}
