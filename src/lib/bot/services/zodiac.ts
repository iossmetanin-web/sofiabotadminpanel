// Zodiac service — zodiac sign from birth date.
// Ported from python-bot/app/services/zodiac.py.

export type Element = 'fire' | 'earth' | 'air' | 'water';

export interface ZodiacSign {
  /** Russian name (canonical — stored in DB) */
  name: string;
  nameEn: string;
  emoji: string;
  element: Element;
}

// Index 0 = Capricorn (starts Dec 22) ... index 11 = Sagittarius.
export const ZODIAC: ZodiacSign[] = [
  { name: 'Козерог',   nameEn: 'Capricorn',   emoji: '♑', element: 'earth' },
  { name: 'Водолей',   nameEn: 'Aquarius',    emoji: '♒', element: 'air' },
  { name: 'Рыбы',      nameEn: 'Pisces',      emoji: '♓', element: 'water' },
  { name: 'Овен',      nameEn: 'Aries',       emoji: '♈', element: 'fire' },
  { name: 'Телец',     nameEn: 'Taurus',      emoji: '♉', element: 'earth' },
  { name: 'Близнецы',  nameEn: 'Gemini',      emoji: '♊', element: 'air' },
  { name: 'Рак',       nameEn: 'Cancer',      emoji: '♋', element: 'water' },
  { name: 'Лев',       nameEn: 'Leo',         emoji: '♌', element: 'fire' },
  { name: 'Дева',      nameEn: 'Virgo',       emoji: '♍', element: 'earth' },
  { name: 'Весы',      nameEn: 'Libra',       emoji: '♎', element: 'air' },
  { name: 'Скорпион',  nameEn: 'Scorpio',     emoji: '♏', element: 'water' },
  { name: 'Стрелец',   nameEn: 'Sagittarius', emoji: '♐', element: 'fire' },
];

// (month, day) when each sign starts. Index aligns with ZODIAC.
const ZODIAC_START: Array<[number, number]> = [
  [12, 22], // Capricorn
  [1, 20],  // Aquarius
  [2, 19],  // Pisces
  [3, 21],  // Aries
  [4, 20],  // Taurus
  [5, 21],  // Gemini
  [6, 21],  // Cancer
  [7, 23],  // Leo
  [8, 23],  // Virgo
  [9, 23],  // Libra
  [10, 23], // Scorpio
  [11, 22], // Sagittarius
];

export function getZodiac(month: number, day: number): ZodiacSign {
  let result: ZodiacSign = ZODIAC[0]; // Capricorn by default
  let bestKey = -1;
  for (let i = 0; i < ZODIAC_START.length; i++) {
    const [m, d] = ZODIAC_START[i];
    const key = m * 100 + d;
    if (key <= month * 100 + day && key > bestKey) {
      bestKey = key;
      result = ZODIAC[i];
    }
  }
  return result;
}

/** Parse an ISO date string (YYYY-MM-DD or full ISO) and return the sign. */
export function getZodiacFromISO(iso: string | null | undefined): ZodiacSign | null {
  if (!iso) return null;
  try {
    const s = iso.trim();
    if (s.includes('T') || s.includes(' ')) {
      const dt = new Date(s);
      if (Number.isNaN(dt.getTime())) return null;
      return getZodiac(dt.getMonth() + 1, dt.getDate());
    }
    const parts = s.split('-');
    if (parts.length < 2) return null;
    const year = Number.parseInt(parts[0], 10);
    const month = Number.parseInt(parts[1], 10);
    if (!Number.isFinite(year) || !Number.isFinite(month)) return null;
    return getZodiac(month, Number.parseInt(parts[2] ?? '1', 10));
  } catch {
    return null;
  }
}

/** Returns the { sign, emoji } for a birth Date. */
export function calculateZodiac(birthDate: Date): { sign: string; emoji: string } {
  const z = getZodiac(birthDate.getMonth() + 1, birthDate.getDate());
  return { sign: z.name, emoji: z.emoji };
}

export type AgeGroup = 'young' | 'young_adult' | 'adult' | 'mature' | 'senior';

/** Coarse age bucket for LLM context only. */
export function ageGroupFromYear(year: number | null | undefined): AgeGroup | null {
  if (!year) return null;
  const now = new Date();
  const age = now.getFullYear() - year;
  if (age < 18) return 'young';
  if (age < 25) return 'young_adult';
  if (age < 40) return 'adult';
  if (age < 60) return 'mature';
  return 'senior';
}

/** Very naive Russian-name gender inference (soft hint only). */
export function inferGender(name: string): 'male' | 'female' | null {
  const n = (name ?? '').trim().toLowerCase();
  if (!n) return null;
  if (['николь', 'габриэль'].includes(n)) return null;
  if (n.endsWith('а') || n.endsWith('я')) return 'female';
  if (n.endsWith('й') || n.endsWith('ь') || n.endsWith('е')) return 'male';
  return null;
}

const RU_MONTHS: Record<string, number> = {
  'января': 1, 'янв': 1,
  'февраля': 2, 'фев': 2,
  'марта': 3, 'мар': 3,
  'апреля': 4, 'апр': 4,
  'мая': 5,
  'июня': 6, 'июн': 6,
  'июля': 7, 'июл': 7,
  'августа': 8, 'авг': 8,
  'сентября': 9, 'сен': 9,
  'октября': 10, 'окт': 10,
  'ноября': 11, 'ноя': 11,
  'декабря': 12, 'дек': 12,
};

const EN_MONTHS: Record<string, number> = {
  'january': 1, 'jan': 1, 'february': 2, 'feb': 2, 'march': 3, 'mar': 3,
  'april': 4, 'apr': 4, 'may': 5, 'june': 6, 'jun': 6, 'july': 7, 'jul': 7,
  'august': 8, 'aug': 8, 'september': 9, 'sep': 9, 'sept': 9,
  'october': 10, 'oct': 10, 'november': 11, 'nov': 11, 'december': 12, 'dec': 12,
};

/**
 * Parse a user-supplied birth date.
 * Accepts DD.MM.YYYY, DD/MM/YYYY, YYYY-MM-DD, "14 марта 1990".
 * Returns { iso, year } or null.
 */
export function parseBirthDate(
  text: string,
): { iso: string; year: number | null } | null {
  if (!text) return null;
  const s = text.trim().toLowerCase();
  if (!s) return null;

  // Try ISO / dotted / slashed formats.
  const fmts: Array<{ re: RegExp; m: number; d: number; y: number }> = [
    { re: /^(\d{4})-(\d{2})-(\d{2})$/, m: 2, d: 3, y: 1 },
    { re: /^(\d{2})\.(\d{2})\.(\d{4})$/, m: 2, d: 1, y: 3 },
    { re: /^(\d{2})\/(\d{2})\/(\d{4})$/, m: 2, d: 1, y: 3 },
    { re: /^(\d{2})-(\d{2})-(\d{4})$/, m: 2, d: 1, y: 3 },
    { re: /^(\d{2})\.(\d{2})$/, m: 2, d: 1, y: -1 },
    { re: /^(\d{2})\/(\d{2})$/, m: 2, d: 1, y: -1 },
  ];
  for (const fmt of fmts) {
    const mm = s.match(fmt.re);
    if (mm) {
      const day = Number.parseInt(mm[fmt.d], 10);
      const month = Number.parseInt(mm[fmt.m], 10);
      const year = fmt.y > 0 ? Number.parseInt(mm[fmt.y], 10) : null;
      if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
        const y = year ?? new Date().getFullYear();
        return { iso: `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`, year };
      }
    }
  }

  // Try "14 марта 1990" / "14 march 1990".
  const parts = s.replace(/,/g, ' ').split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const day = Number.parseInt(parts[0], 10);
    const monthWord = parts[1];
    const month = RU_MONTHS[monthWord] ?? EN_MONTHS[monthWord];
    if (Number.isFinite(day) && month) {
      const year = parts.length >= 3 ? Number.parseInt(parts[2], 10) : null;
      const y = year ?? new Date().getFullYear();
      return { iso: `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`, year };
    }
  }

  return null;
}

export function zodiacEmoji(name: string | null | undefined): string {
  if (!name) return '';
  const z = ZODIAC.find((x) => x.name === name || x.nameEn === name);
  return z?.emoji ?? '';
}

export function zodiacNameEn(name: string | null | undefined): string {
  if (!name) return '';
  const z = ZODIAC.find((x) => x.name === name || x.nameEn === name);
  return z?.nameEn ?? '';
}
