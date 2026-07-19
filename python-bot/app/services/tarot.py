"""app.services.tarot — 78-card Ryder-Waite deck + spread definitions.

Ported from the TypeScript bot's `domain/tarot.ts`. The card names are
public-domain tarot terminology. No third-party IP.
"""
from __future__ import annotations

import random
from dataclasses import dataclass
from typing import Dict, List, Literal, Optional

Locale = Literal["ru", "en"]

# 22 Major Arcana (indices 0..21)
MAJOR_ARCANA_RU: List[str] = [
    "Шут", "Маг", "Жрица", "Императрица", "Император", "Иерофант", "Влюблённые",
    "Колесница", "Сила", "Отшельник", "Колесо Фортуны", "Справедливость",
    "Повешенный", "Смерть", "Умеренность", "Дьявол", "Башня", "Звезда",
    "Луна", "Солнце", "Суд", "Мир",
]

MAJOR_ARCANA_EN: List[str] = [
    "The Fool", "The Magician", "The High Priestess", "The Empress",
    "The Emperor", "The Hierophant", "The Lovers", "The Chariot",
    "Strength", "The Hermit", "Wheel of Fortune", "Justice",
    "The Hanged Man", "Death", "Temperance", "The Devil",
    "The Tower", "The Star", "The Moon", "The Sun", "Judgement", "The World",
]

SUITS = ["wands", "cups", "swords", "pentacles"]
SUIT_NAMES_RU: Dict[str, str] = {
    "wands": "Жезлы",
    "cups": "Кубки",
    "swords": "Мечи",
    "pentacles": "Пентакли",
}
SUIT_NAMES_EN: Dict[str, str] = {
    "wands": "Wands",
    "cups": "Cups",
    "swords": "Swords",
    "pentacles": "Pentacles",
}
RANKS_RU: List[str] = [
    "Туз", "Двойка", "Тройка", "Четвёрка", "Пятёрка", "Шестёрка", "Семёрка",
    "Восьмёрка", "Девятка", "Десятка", "Паж", "Рыцарь", "Королева", "Король",
]
RANKS_EN: List[str] = [
    "Ace", "Two", "Three", "Four", "Five", "Six", "Seven",
    "Eight", "Nine", "Ten", "Page", "Knight", "Queen", "King",
]


def _build_deck(locale: Locale) -> List[str]:
    """Build the 78-card deck for the given locale."""
    if locale == "en":
        deck: List[str] = list(MAJOR_ARCANA_EN)
        for suit in SUITS:
            suit_name = SUIT_NAMES_EN[suit]
            deck.extend(f"{rank} of {suit_name}" for rank in RANKS_EN)
    else:
        deck = list(MAJOR_ARCANA_RU)
        for suit in SUITS:
            suit_name = SUIT_NAMES_RU[suit]
            deck.extend(f"{rank} {suit_name}" for rank in RANKS_RU)
    assert len(deck) == 78, f"deck must be 78 cards, got {len(deck)}"
    return deck


_DECK_RU: List[str] = _build_deck("ru")
_DECK_EN: List[str] = _build_deck("en")

# Short keyword blurbs for Major Arcana (for inline previews / card-of-day).
KEYWORDS_RU: Dict[str, str] = {
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
}

KEYWORDS_EN: Dict[str, str] = {
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
}

# 4-part fate card layout (free, given once on onboarding completion).
FATE_CARD_PARTS_RU = [
    ("🌟", "ЧТО ДАНО"),
    ("🌙", "СКРЫТАЯ СТОРОНА"),
    ("⚡", "СЛАБОЕ МЕСТО"),
    ("🔑", "ГЛАВНЫЙ ВОПРОС"),
]
FATE_CARD_PARTS_EN = [
    ("🌟", "WHAT IS GIVEN"),
    ("🌙", "THE HIDDEN SIDE"),
    ("⚡", "THE WEAK SPOT"),
    ("🔑", "THE KEY QUESTION"),
]


@dataclass(frozen=True)
class TarotCard:
    name: str
    reversed: bool
    position: Optional[str] = None  # spread position label

    @property
    def display_name(self) -> str:
        return f"{self.name} (перевёрнута)" if self.reversed else self.name

    @property
    def display_name_en(self) -> str:
        return f"{self.name} (reversed)" if self.reversed else self.name


@dataclass(frozen=True)
class SpreadDefinition:
    type: str
    card_count: int
    positions: List[str]
    instruction: str


# Spread definitions. `card_count` is what the user is asked to pick (1..78).
# `positions` are the labels shown in the interpretation.
SPREADS: Dict[str, SpreadDefinition] = {
    "tarot_small": SpreadDefinition(
        type="tarot_small",
        card_count=5,
        positions=["Прошлое", "Настоящее", "Скрытое", "Совет", "Итог"],
        instruction="Загадай пять чисел от 1 до 78 — они выберут карты.",
    ),
    "tarot_full": SpreadDefinition(
        type="tarot_full",
        card_count=20,
        positions=[f"Карта {i + 1}" for i in range(20)],
        instruction="Загадай двадцать чисел от 1 до 78 — полный расклад.",
    ),
    "tarot_love": SpreadDefinition(
        type="tarot_love",
        card_count=3,
        positions=["Ты", "Партнёр", "Связь между вами"],
        instruction="Загадай три числа от 1 до 78 — они покажут вашу связь.",
    ),
    "tarot_career": SpreadDefinition(
        type="tarot_career",
        card_count=5,
        positions=["Где ты сейчас", "Что движет тобой", "Что мешает",
                   "Возможность", "Совет"],
        instruction="Загадай пять чисел от 1 до 78 — путь в деле.",
    ),
    "tarot_decision": SpreadDefinition(
        type="tarot_decision",
        card_count=3,
        positions=["Путь А", "Путь Б", "Что скажет сердце"],
        instruction="Загадай три числа от 1 до 78 — помогут выбрать.",
    ),
    "fate_card": SpreadDefinition(
        type="fate_card",
        card_count=4,
        positions=["Что дано", "Скрытая сторона", "Слабое место", "Главный вопрос"],
        instruction="Четыре части карты судьбы — София открывает слой за слоем.",
    ),
    "horoscope": SpreadDefinition(
        type="horoscope",
        card_count=0,
        positions=[],
        instruction="Персональный гороскоп — без карт, по знаку.",
    ),
    "card_of_day": SpreadDefinition(
        type="card_of_day",
        card_count=1,
        positions=["Карта дня"],
        instruction="Одна карта на день — что она хочет сказать.",
    ),
    "single_card": SpreadDefinition(
        type="single_card",
        card_count=1,
        positions=["Карта"],
        instruction="Одна карта — короткий ответ.",
    ),
}


def get_card_by_number(n: int, locale: Locale = "ru") -> TarotCard:
    """Map 1..78 (any int) to a card; reversed is deterministic from `n`."""
    idx = ((n - 1) % 78 + 78) % 78
    deck = _DECK_EN if locale == "en" else _DECK_RU
    name = deck[idx]
    reversed_ = (n % 3) == 0  # deterministic, feels random to the user
    return TarotCard(name=name, reversed=reversed_)


def draw_random_cards(count: int, locale: Locale = "ru") -> List[TarotCard]:
    """Pick `count` random cards (no repeats) with ~50% reversed probability."""
    deck = _DECK_EN if locale == "en" else _DECK_RU
    indices = random.sample(range(78), k=min(count, 78))
    return [
        TarotCard(name=deck[i], reversed=(random.random() < 0.5))
        for i in indices
    ]


def parse_user_numbers(text: str, expected_count: int) -> Optional[List[int]]:
    """Pull integers out of a user message.

    Accepts space/comma/newline separated. Returns None if not enough numbers.
    """
    if not text:
        return None
    tokens: List[int] = []
    for tok in text.replace(",", " ").replace("\n", " ").split():
        try:
            n = int(tok)
        except ValueError:
            continue
        tokens.append(n)
    if len(tokens) < expected_count:
        return None
    return tokens[:expected_count]


def format_cards_for_prompt(cards: List[TarotCard], positions: List[str], locale: Locale) -> str:
    """Render cards as a numbered list with positions for the LLM prompt."""
    lines: List[str] = []
    for i, c in enumerate(cards):
        pos = positions[i] if i < len(positions) else f"Карта {i + 1}"
        rev_note = " (перевёрнута)" if c.reversed else ""
        lines.append(f"{i + 1}. {pos}: {c.name}{rev_note}")
    return "\n".join(lines)


def keyword_for(card_name: str, locale: Locale) -> str:
    if locale == "en":
        return KEYWORDS_EN.get(card_name, "")
    return KEYWORDS_RU.get(card_name, "")


def cards_to_json(cards: List[TarotCard]) -> str:
    """Serialize cards for storage in `Reading.cards` (JSON string)."""
    import json

    return json.dumps(
        [
            {"name": c.name, "reversed": c.reversed, "position": c.position}
            for c in cards
        ],
        ensure_ascii=False,
    )
