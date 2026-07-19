// domain/tarot.ts — 78-card Ryder-Waite map + spread definitions.
// Ported from old bot's fsm.py as design (the card names are public domain tarot).

export type TarotCard = {
  name: string;
  arcana: "major" | "minor";
  suit?: "wands" | "cups" | "swords" | "pentacles";
  rank?: string;
};

// 22 Major Arcana (0-21)
export const MAJOR_ARCANA: string[] = [
  "Шут", "Маг", "Жрица", "Императрица", "Император", "Иерофант", "Влюблённые",
  "Колесница", "Сила", "Отшельник", "Колесо Фортуны", "Справедливость", "Повешенный",
  "Смерть", "Умеренность", "Дьявол", "Башня", "Звезда", "Луна", "Солнце", "Суд", "Мир",
];

// Minor Arcana: 4 suits × 14 ranks (Ace, 2-10, Page, Knight, Queen, King)
export const SUITS = ["wands", "cups", "swords", "pentacles"] as const;
export const SUIT_NAMES_RU: Record<string, string> = {
  wands: "Жезлы",
  cups: "Кубки",
  swords: "Мечи",
  pentacles: "Пентакли",
};
export const RANKS = [
  "Туз", "Двойка", "Тройка", "Четвёрка", "Пятёрка", "Шестёрка", "Семёрка",
  "Восьмёрка", "Девятка", "Десятка", "Паж", "Рыцарь", "Королева", "Король",
];

// Full 78-card deck indexed 0-77.
export const FULL_DECK: TarotCard[] = (() => {
  const deck: TarotCard[] = MAJOR_ARCANA.map((name) => ({
    name, arcana: "major" as const,
  }));
  for (const suit of SUITS) {
    for (let i = 0; i < RANKS.length; i++) {
      deck.push({
        name: `${RANKS[i]} ${SUIT_NAMES_RU[suit]}`,
        arcana: "minor" as const,
        suit,
        rank: RANKS[i],
      });
    }
  }
  return deck;
})();

export function getCardByNumber(n: number): { name: string; reversed: boolean } {
  // User gives 1-78; map to 0-77. Reversed if the picked index is even (deterministic from number).
  const idx = ((n - 1) % 78 + 78) % 78;
  const card = FULL_DECK[idx];
  // Deterministic "reversed" based on the number itself — feels random to the user.
  const reversed = (n % 3) === 0;
  return { name: card.name, reversed };
}

export type SpreadDefinition = {
  type: string;
  cardCount: number;
  positions: string[]; // labels for each position
  instruction: string;
};

export const SPREADS: Record<string, SpreadDefinition> = {
  tarot_small: {
    type: "tarot_small",
    cardCount: 5,
    positions: ["Прошлое", "Настоящее", "Скрытое", "Совет", "Итог"],
    instruction: "Загадай пять чисел от 1 до 78 — они выберут карты.",
  },
  tarot_full: {
    type: "tarot_full",
    cardCount: 20,
    positions: Array.from({ length: 20 }, (_, i) => `Карта ${i + 1}`),
    instruction: "Загадай двадцать чисел от 1 до 78 — они откроют полный расклад.",
  },
  tarot_love: {
    type: "tarot_love",
    cardCount: 3,
    positions: ["Ты", "Партнёр", "Связь между вами"],
    instruction: "Загадай три числа от 1 до 78 — они покажут вашу связь.",
  },
  tarot_career: {
    type: "tarot_career",
    cardCount: 5,
    positions: ["Где ты сейчас", "Что движет тобой", "Что мешает", "Возможность", "Совет"],
    instruction: "Загадай пять чисел от 1 до 78 — они укажут путь в деле.",
  },
  tarot_decision: {
    type: "tarot_decision",
    cardCount: 3,
    positions: ["Путь А", "Путь Б", "Что скажет сердце"],
    instruction: "Загадай три числа от 1 до 78 — они помогут выбрать.",
  },
};

export const FATE_CARD_PARTS = [
  { emoji: "🌟", label: "Что дано" },
  { emoji: "🌙", label: "Скрытая сторона" },
  { emoji: "⚡", label: "Слабое место" },
  { emoji: "🔑", label: "Главный вопрос" },
];
