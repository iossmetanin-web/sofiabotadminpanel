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
  yes_no: {
    type: "yes_no",
    cardCount: 1,
    positions: ["Ответ"],
    instruction: "Загадай одно число от 1 до 78 — карта ответит «да» или «нет».",
  },
};

export const FATE_CARD_PARTS = [
  { emoji: "🌟", label: "Что дано" },
  { emoji: "🌙", label: "Скрытая сторона" },
  { emoji: "⚡", label: "Слабое место" },
  { emoji: "🔑", label: "Главный вопрос" },
];

// English card-name mapping (public-domain tarot names).
export const MAJOR_ARCANA_EN: string[] = [
  "The Fool", "The Magician", "The High Priestess", "The Empress", "The Emperor",
  "The Hierophant", "The Lovers", "The Chariot", "Strength", "The Hermit",
  "Wheel of Fortune", "Justice", "The Hanged Man", "Death", "Temperance",
  "The Devil", "The Tower", "The Star", "The Moon", "The Sun", "Judgement", "The World",
];

export const SUIT_NAMES_EN: Record<string, string> = {
  wands: "Wands",
  cups: "Cups",
  swords: "Swords",
  pentacles: "Pentacles",
};

export const RANKS_EN = [
  "Ace", "Two", "Three", "Four", "Five", "Six", "Seven",
  "Eight", "Nine", "Ten", "Page", "Knight", "Queen", "King",
];

// Full English deck (parallel to FULL_DECK).
export const FULL_DECK_EN: TarotCard[] = (() => {
  const deck: TarotCard[] = MAJOR_ARCANA_EN.map((name) => ({ name, arcana: "major" as const }));
  for (const suit of SUITS) {
    for (let i = 0; i < RANKS_EN.length; i++) {
      deck.push({
        name: `${RANKS_EN[i]} of ${SUIT_NAMES_EN[suit]}`,
        arcana: "minor" as const,
        suit,
        rank: RANKS_EN[i],
      });
    }
  }
  return deck;
})();

export function getCardByNumberLocalized(n: number, locale: "ru" | "en"): { name: string; reversed: boolean } {
  const idx = ((n - 1) % 78 + 78) % 78;
  const deck = locale === "en" ? FULL_DECK_EN : FULL_DECK;
  const card = deck[idx];
  const reversed = (n % 3) === 0;
  return { name: card.name, reversed };
}

// Short one-line keywords for inline mode previews (Major Arcana only — most relevant for quick draws).
export const MAJOR_ARCANA_KEYWORDS_RU: Record<string, string> = {
  "Шут": "Новый путь. Шагнуть, не зная дороги.",
  "Маг": "Сила в твоих руках. Время действовать.",
  "Жрица": "Слушай тишину — там ответ.",
  "Императрица": "Рост. Забота. Плоды созревают.",
  "Император": "Опора. Структура. Найди твердую землю.",
  "Иерофант": "Традиция. Учитель. Опора на древнее.",
  "Влюблённые": "Выбор сердца. Не ума — сердца.",
  "Колесница": "Воля. Движение. Победа через усилие.",
  "Сила": "Мягкая сила. Терпение побеждает.",
  "Отшельник": "Тишина. Внутренний свет. Помедли.",
  "Колесо Фортуны": "Перемены. Цикл. Колесо повернулось.",
  "Справедливость": "Равновесие. Правда. Что посеял — то и жнёшь.",
  "Повешенный": "Пауза. Другой угол. Отпустить контроль.",
  "Смерть": "Конец главы. Не конец книги. Трансформация.",
  "Умеренность": "Баланс. Смешивание. Искусство середины.",
  "Дьявол": "Привязанность. Тень. Что тебя держит?",
  "Башня": "Старое рушится. Освобождение через слом.",
  "Звезда": "Надежда. Свет в темноте. Доверие.",
  "Луна": "Туман. Подсознание. Не всё ясно.",
  "Солнце": "Радость. Ясность. Свет на лице.",
  "Суд": "Возрождение. Призыв. Время услышать.",
  "Мир": "Завершение. Целостность. Круг замкнулся.",
};

export const MAJOR_ARCANA_KEYWORDS_EN: Record<string, string> = {
  "The Fool": "A new path. Step without knowing the road.",
  "The Magician": "Power in your hands. Time to act.",
  "The High Priestess": "Listen to the silence — the answer is there.",
  "The Empress": "Growth. Care. Fruit ripening.",
  "The Emperor": "Support. Structure. Find solid ground.",
  "The Hierophant": "Tradition. Teacher. Lean on the ancient.",
  "The Lovers": "A choice of heart, not mind.",
  "The Chariot": "Will. Motion. Victory through effort.",
  "Strength": "Soft strength. Patience wins.",
  "The Hermit": "Stillness. Inner light. Linger.",
  "Wheel of Fortune": "Change. Cycle. The wheel has turned.",
  "Justice": "Balance. Truth. As you sow, so you reap.",
  "The Hanged Man": "Pause. A different angle. Let go of control.",
  "Death": "End of a chapter, not the book. Transformation.",
  "Temperance": "Balance. Blending. The art of the middle.",
  "The Devil": "Attachment. Shadow. What holds you?",
  "The Tower": "The old crumbles. Freedom through breakage.",
  "The Star": "Hope. Light in the dark. Trust.",
  "The Moon": "Mist. The subconscious. Not all is clear.",
  "The Sun": "Joy. Clarity. Light on the face.",
  "Judgement": "Rebirth. A call. Time to hear.",
  "The World": "Completion. Wholeness. The circle closes.",
};

// Pool of short affirmation prompts (rotated deterministically by day).
export const AFFIRMATION_SEEDS_RU = [
  "тишина и принятие сегодняшнего дня",
  "доверие к тому, что ещё не видно",
  "прощение себе за прошлые шаги",
  "смелость быть неидеальным",
  "благодарность за маленькое тепло",
];

export const AFFIRMATION_SEEDS_EN = [
  "stillness and acceptance of today",
  "trust in what is not yet visible",
  "forgiveness for past steps",
  "courage to be imperfect",
  "gratitude for small warmth",
];

