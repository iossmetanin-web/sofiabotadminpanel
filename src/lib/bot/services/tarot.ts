// Tarot service — 78-card Ryder–Waite deck + spread definitions.
// Ported from python-bot/app/services/tarot.py.
//
// Card names are public-domain tarot terminology.

export type Locale = 'ru' | 'en';

// 22 Major Arcana (indices 0..21)
export const MAJOR_ARCANA_RU: string[] = [
  'Шут', 'Маг', 'Жрица', 'Императрица', 'Император', 'Иерофант', 'Влюблённые',
  'Колесница', 'Сила', 'Отшельник', 'Колесо Фортуны', 'Справедливость',
  'Повешенный', 'Смерть', 'Умеренность', 'Дьявол', 'Башня', 'Звезда',
  'Луна', 'Солнце', 'Суд', 'Мир',
];

export const MAJOR_ARCANA_EN: string[] = [
  'The Fool', 'The Magician', 'The High Priestess', 'The Empress',
  'The Emperor', 'The Hierophant', 'The Lovers', 'The Chariot',
  'Strength', 'The Hermit', 'Wheel of Fortune', 'Justice',
  'The Hanged Man', 'Death', 'Temperance', 'The Devil',
  'The Tower', 'The Star', 'The Moon', 'The Sun', 'Judgement', 'The World',
];

const SUITS = ['wands', 'cups', 'swords', 'pentacles'] as const;

const SUIT_NAMES_RU: Record<string, string> = {
  wands: 'Жезлы',
  cups: 'Кубки',
  swords: 'Мечи',
  pentacles: 'Пентакли',
};

const SUIT_NAMES_EN: Record<string, string> = {
  wands: 'Wands',
  cups: 'Cups',
  swords: 'Swords',
  pentacles: 'Pentacles',
};

const RANKS_RU: string[] = [
  'Туз', 'Двойка', 'Тройка', 'Четвёрка', 'Пятёрка', 'Шестёрка', 'Семёрка',
  'Восьмёрка', 'Девятка', 'Десятка', 'Паж', 'Рыцарь', 'Королева', 'Король',
];

const RANKS_EN: string[] = [
  'Ace', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven',
  'Eight', 'Nine', 'Ten', 'Page', 'Knight', 'Queen', 'King',
];

function buildDeck(locale: Locale): string[] {
  const deck: string[] = [];
  if (locale === 'en') {
    deck.push(...MAJOR_ARCANA_EN);
    for (const suit of SUITS) {
      const suitName = SUIT_NAMES_EN[suit];
      for (const rank of RANKS_EN) deck.push(`${rank} of ${suitName}`);
    }
  } else {
    deck.push(...MAJOR_ARCANA_RU);
    for (const suit of SUITS) {
      const suitName = SUIT_NAMES_RU[suit];
      for (const rank of RANKS_RU) deck.push(`${rank} ${suitName}`);
    }
  }
  return deck;
}

const DECK_RU = buildDeck('ru');
const DECK_EN = buildDeck('en');

export const KEYWORDS_RU: Record<string, string> = {
  'Шут': 'Новый путь. Шагнуть, не зная дороги.',
  'Маг': 'Сила в твоих руках. Время действовать.',
  'Жрица': 'Слушай тишину — там ответ.',
  'Императрица': 'Рост. Забота. Плоды созревают.',
  'Император': 'Опора. Структура. Найди твердую землю.',
  'Иерофант': 'Традиция. Учитель. Опора на древнее.',
  'Влюблённые': 'Выбор сердца. Не ума — сердца.',
  'Колесница': 'Воля. Движение. Победа через усилие.',
  'Сила': 'Мягкая сила. Терпение побеждает.',
  'Отшельник': 'Тишина. Внутренний свет. Помедли.',
  'Колесо Фортуны': 'Перемены. Цикл. Колесо повернулось.',
  'Справедливость': 'Равновесие. Правда. Что посеял — то и жнёшь.',
  'Повешенный': 'Пауза. Другой угол. Отпустить контроль.',
  'Смерть': 'Конец главы. Не конец книги. Трансформация.',
  'Умеренность': 'Баланс. Смешивание. Искусство середины.',
  'Дьявол': 'Привязанность. Тень. Что тебя держит?',
  'Башня': 'Старое рушится. Освобождение через слом.',
  'Звезда': 'Надежда. Свет в темноте. Доверие.',
  'Луна': 'Туман. Подсознание. Не всё ясно.',
  'Солнце': 'Радость. Ясность. Свет на лице.',
  'Суд': 'Возрождение. Призыв. Время услышать.',
  'Мир': 'Завершение. Целостность. Круг замкнулся.',
};

export const KEYWORDS_EN: Record<string, string> = {
  'The Fool': 'A new path. Step without knowing the road.',
  'The Magician': 'Power in your hands. Time to act.',
  'The High Priestess': 'Listen to the silence — the answer is there.',
  'The Empress': 'Growth. Care. Fruit ripening.',
  'The Emperor': 'Support. Structure. Find solid ground.',
  'The Hierophant': 'Tradition. Teacher. Lean on the ancient.',
  'The Lovers': 'A choice of heart, not mind.',
  'The Chariot': 'Will. Motion. Victory through effort.',
  'Strength': 'Soft strength. Patience wins.',
  'The Hermit': 'Stillness. Inner light. Linger.',
  'Wheel of Fortune': 'Change. Cycle. The wheel has turned.',
  'Justice': 'Balance. Truth. As you sow, so you reap.',
  'The Hanged Man': 'Pause. A different angle. Let go of control.',
  'Death': 'End of a chapter, not the book. Transformation.',
  'Temperance': 'Balance. Blending. The art of the middle.',
  'The Devil': 'Attachment. Shadow. What holds you?',
  'The Tower': 'The old crumbles. Freedom through breakage.',
  'The Star': 'Hope. Light in the dark. Trust.',
  'The Moon': 'Mist. The subconscious. Not all is clear.',
  'The Sun': 'Joy. Clarity. Light on the face.',
  'Judgement': 'Rebirth. A call. Time to hear.',
  'The World': 'Completion. Wholeness. The circle closes.',
};

export const FATE_CARD_PARTS_RU: Array<[string, string]> = [
  ['🌟', 'ЧТО ДАНО'],
  ['🌙', 'СКРЫТАЯ СТОРОНА'],
  ['⚡', 'СЛАБОЕ МЕСТО'],
  ['🔑', 'ГЛАВНЫЙ ВОПРОС'],
];

export const FATE_CARD_PARTS_EN: Array<[string, string]> = [
  ['🌟', 'WHAT IS GIVEN'],
  ['🌙', 'THE HIDDEN SIDE'],
  ['⚡', 'THE WEAK SPOT'],
  ['🔑', 'THE KEY QUESTION'],
];

export interface TarotCard {
  name: string;
  reversed: boolean;
  position?: string | null;
}

export interface SpreadDefinition {
  type: string;
  cardCount: number;
  positions: string[];
  instruction: string;
}

export const SPREADS: Record<string, SpreadDefinition> = {
  tarot_small: {
    type: 'tarot_small',
    cardCount: 5,
    positions: ['Прошлое', 'Настоящее', 'Скрытое', 'Совет', 'Итог'],
    instruction: 'Загадай пять чисел от 1 до 78 — они выберут карты.',
  },
  tarot_full: {
    type: 'tarot_full',
    cardCount: 20,
    positions: Array.from({ length: 20 }, (_, i) => `Карта ${i + 1}`),
    instruction: 'Загадай двадцать чисел от 1 до 78 — полный расклад.',
  },
  tarot_love: {
    type: 'tarot_love',
    cardCount: 3,
    positions: ['Ты', 'Партнёр', 'Связь между вами'],
    instruction: 'Загадай три числа от 1 до 78 — они покажут вашу связь.',
  },
  tarot_career: {
    type: 'tarot_career',
    cardCount: 5,
    positions: [
      'Где ты сейчас', 'Что движет тобой', 'Что мешает',
      'Возможность', 'Совет',
    ],
    instruction: 'Загадай пять чисел от 1 до 78 — путь в деле.',
  },
  tarot_decision: {
    type: 'tarot_decision',
    cardCount: 3,
    positions: ['Путь А', 'Путь Б', 'Что скажет сердце'],
    instruction: 'Загадай три числа от 1 до 78 — помогут выбрать.',
  },
  fate_card: {
    type: 'fate_card',
    cardCount: 4,
    positions: ['Что дано', 'Скрытая сторона', 'Слабое место', 'Главный вопрос'],
    instruction: 'Четыре части карты судьбы — София открывает слой за слоем.',
  },
  horoscope: {
    type: 'horoscope',
    cardCount: 0,
    positions: [],
    instruction: 'Персональный гороскоп — без карт, по знаку.',
  },
  card_of_day: {
    type: 'card_of_day',
    cardCount: 1,
    positions: ['Карта дня'],
    instruction: 'Одна карта на день — что она хочет сказать.',
  },
  single_card: {
    type: 'single_card',
    cardCount: 1,
    positions: ['Карта'],
    instruction: 'Одна карта — короткий ответ.',
  },
};

/** Map 1..78 (any int) to a card; reversed is deterministic from n. */
export function getCardByNumber(n: number, locale: Locale = 'ru'): TarotCard {
  const idx = (((n - 1) % 78) + 78) % 78;
  const deck = locale === 'en' ? DECK_EN : DECK_RU;
  const name = deck[idx];
  const reversed = n % 3 === 0;
  return { name, reversed };
}

/** Pick `count` random cards (no repeats) with ~50% reversed. */
export function drawRandomCards(count: number, locale: Locale = 'ru'): TarotCard[] {
  const deck = locale === 'en' ? DECK_EN : DECK_RU;
  const n = Math.min(count, 78);
  const indices: number[] = [];
  const taken = new Set<number>();
  while (indices.length < n) {
    const i = Math.floor(Math.random() * 78);
    if (taken.has(i)) continue;
    taken.add(i);
    indices.push(i);
  }
  return indices.map((i) => ({
    name: deck[i],
    reversed: Math.random() < 0.5,
  }));
}

/**
 * Pull integers out of a user message.
 * Accepts space/comma/newline separated. Returns null if not enough numbers.
 */
export function parseUserNumbers(
  text: string,
  expectedCount: number,
): number[] | null {
  if (!text) return null;
  const cleaned = text.replace(/[,]/g, ' ').replace(/[\n]/g, ' ');
  const tokens: number[] = [];
  for (const tok of cleaned.split(/\s+/)) {
    const n = Number.parseInt(tok, 10);
    if (Number.isFinite(n)) tokens.push(n);
  }
  if (tokens.length < expectedCount) return null;
  return tokens.slice(0, expectedCount);
}

/** Render cards as a numbered list with positions for the LLM prompt. */
export function formatCardsForPrompt(
  cards: TarotCard[],
  positions: string[],
  _locale: Locale,
): string {
  const lines: string[] = [];
  for (let i = 0; i < cards.length; i++) {
    const c = cards[i];
    const pos = i < positions.length ? positions[i] : `Карта ${i + 1}`;
    const revNote = c.reversed ? ' (перевёрнута)' : '';
    lines.push(`${i + 1}. ${pos}: ${c.name}${revNote}`);
  }
  return lines.join('\n');
}

export function keywordFor(cardName: string, locale: Locale): string {
  if (locale === 'en') return KEYWORDS_EN[cardName] ?? '';
  return KEYWORDS_RU[cardName] ?? '';
}

/** Serialize cards for storage in Reading.cards (JSON string). */
export function cardsToJSON(cards: TarotCard[]): string {
  return JSON.stringify(
    cards.map((c) => ({
      name: c.name,
      reversed: c.reversed,
      position: c.position ?? null,
    })),
  );
}

export function cardDisplayName(card: TarotCard, locale: Locale): string {
  const revSuffix = locale === 'en' ? ' (reversed)' : ' (перевёрнута)';
  return card.reversed ? `${card.name}${revSuffix}` : card.name;
}
