"""app.services.zodiac — zodiac sign from birth date.

Ported from `domain/zodiac.ts`. Capricorn wrap-around (Dec 22 → Jan 19)
handled correctly.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from typing import List, Literal, Optional

Element = Literal["fire", "earth", "air", "water"]


@dataclass(frozen=True)
class ZodiacSign:
    name: str  # Russian name (canonical — stored in DB)
    name_en: str
    emoji: str
    element: Element


# Order matters: index 0 = Capricorn (starts Dec 22), index 11 = Sagittarius.
ZODIAC: List[ZodiacSign] = [
    ZodiacSign("Козерог",   "Capricorn",   "♑", "earth"),
    ZodiacSign("Водолей",   "Aquarius",    "♒", "air"),
    ZodiacSign("Рыбы",      "Pisces",      "♓", "water"),
    ZodiacSign("Овен",      "Aries",       "♈", "fire"),
    ZodiacSign("Телец",     "Taurus",      "♉", "earth"),
    ZodiacSign("Близнецы",  "Gemini",      "♊", "air"),
    ZodiacSign("Рак",       "Cancer",      "♋", "water"),
    ZodiacSign("Лев",       "Leo",         "♌", "fire"),
    ZodiacSign("Дева",      "Virgo",       "♍", "earth"),
    ZodiacSign("Весы",      "Libra",       "♎", "air"),
    ZodiacSign("Скорпион",  "Scorpio",     "♏", "water"),
    ZodiacSign("Стрелец",   "Sagittarius", "♐", "fire"),
]

# (month, day) when each sign starts. Index aligns with ZODIAC.
ZODIAC_START: List[tuple] = [
    (12, 22),  # Capricorn
    (1, 20),   # Aquarius
    (2, 19),   # Pisces
    (3, 21),   # Aries
    (4, 20),   # Taurus
    (5, 21),   # Gemini
    (6, 21),   # Cancer
    (7, 23),   # Leo
    (8, 23),   # Virgo
    (9, 23),   # Libra
    (10, 23),  # Scorpio
    (11, 22),  # Sagittarius
]


def get_zodiac(month: int, day: int) -> ZodiacSign:
    """Return the ZodiacSign for a given month/day.

    Capricorn wraps the year: Dec 22 → Jan 19. The algorithm: find the latest
    `ZODIAC_START` date that is <= (month, day). If none (Jan 1..19), default
    to Capricorn (index 0).
    """
    result: ZodiacSign = ZODIAC[0]  # Capricorn by default
    best_key: int = -1
    for i, (m, d) in enumerate(ZODIAC_START):
        key = m * 100 + d
        if key <= month * 100 + day and key > best_key:
            best_key = key
            result = ZODIAC[i]
    return result


def get_zodiac_from_iso(iso: str) -> Optional[ZodiacSign]:
    """Parse an ISO date string (YYYY-MM-DD or full ISO) and return the sign."""
    if not iso:
        return None
    try:
        # Accept "YYYY-MM-DD" or full ISO 8601.
        if "T" in iso or " " in iso:
            dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
            return get_zodiac(dt.month, dt.day)
        parts = iso.split("-")
        if len(parts) < 2:
            return None
        return get_zodiac(int(parts[0]), int(parts[1]))  # type: ignore[arg-type]
    except (ValueError, IndexError):
        return None


def age_group_from_year(year: Optional[int]) -> Optional[str]:
    """Coarse age bucket for LLM context only."""
    if not year:
        return None
    age = date.today().year - year
    if age < 18:
        return "young"
    if age < 25:
        return "young_adult"
    if age < 40:
        return "adult"
    if age < 60:
        return "mature"
    return "senior"


def infer_gender(name: str) -> Optional[str]:
    """Very naive Russian-name gender inference (soft hint only)."""
    n = (name or "").strip().lower()
    if not n:
        return None
    if n.endswith(("а", "я")) and n not in ("николь", "габриэль"):
        return "female"
    if n.endswith(("й", "ь", "е")):
        return "male"
    return None


def parse_birth_date(text: str) -> Optional[tuple]:
    """Try to parse a user-supplied birth date.

    Accepts:
      - "14.03.1990"
      - "14/03/1990"
      - "1990-03-14"
      - "14 марта 1990" (Russian month names)

    Returns (iso_string, year) or None.
    """
    if not text:
        return None
    s = text.strip().lower()

    ru_months = {
        "января": 1, "янв": 1,
        "февраля": 2, "фев": 2,
        "марта": 3, "мар": 3,
        "апреля": 4, "апр": 4,
        "мая": 5,
        "июня": 6, "июн": 6,
        "июля": 7, "июл": 7,
        "августа": 8, "авг": 8,
        "сентября": 9, "сен": 9,
        "октября": 10, "окт": 10,
        "ноября": 11, "ноя": 11,
        "декабря": 12, "дек": 12,
    }
    en_months = {
        "january": 1, "jan": 1, "february": 2, "feb": 2, "march": 3, "mar": 3,
        "april": 4, "apr": 4, "may": 5, "june": 6, "jun": 6, "july": 7, "jul": 7,
        "august": 8, "aug": 8, "september": 9, "sep": 9, "sept": 9,
        "october": 10, "oct": 10, "november": 11, "nov": 11, "december": 12, "dec": 12,
    }

    # Try ISO first.
    for fmt in ("%Y-%m-%d", "%d.%m.%Y", "%d/%m/%Y", "%d-%m-%Y", "%d.%m", "%d/%m"):
        try:
            d = datetime.strptime(s, fmt)
            iso = d.strftime("%Y-%m-%d")
            return (iso, d.year)
        except ValueError:
            continue

    # Try "14 марта 1990" / "14 march 1990".
    parts = s.replace(",", " ").split()
    if len(parts) >= 2:
        try:
            day = int(parts[0])
            month_word = parts[1]
            month = ru_months.get(month_word) or en_months.get(month_word)
            if month:
                year = int(parts[2]) if len(parts) >= 3 else None
                iso = f"{year or date.today().year:04d}-{month:02d}-{day:02d}"
                return (iso, year)
        except (ValueError, IndexError):
            pass

    return None
