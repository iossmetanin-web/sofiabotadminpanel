// domain/zodiac.ts — zodiac sign from birth date.
// Ported from old bot's fsm.py with the Capricorn wrap bug fixed (per Task 1-b §7).

export type ZodiacSign = {
  name: string;
  emoji: string;
  element: "fire" | "earth" | "air" | "water";
};

export const ZODIAC: ZodiacSign[] = [
  { name: "Козерог", emoji: "♑", element: "earth" },
  { name: "Водолей", emoji: "♒", element: "air" },
  { name: "Рыбы", emoji: "♓", element: "water" },
  { name: "Овен", emoji: "♈", element: "fire" },
  { name: "Телец", emoji: "♉", element: "earth" },
  { name: "Близнецы", emoji: "♊", element: "air" },
  { name: "Рак", emoji: "♋", element: "water" },
  { name: "Лев", emoji: "♌", element: "fire" },
  { name: "Дева", emoji: "♍", element: "earth" },
  { name: "Весы", emoji: "♎", element: "air" },
  { name: "Скорпион", emoji: "♏", element: "water" },
  { name: "Стрелец", emoji: "♐", element: "fire" },
];

// Start dates (month 1-12, day). Capricorn starts Dec 22, ends Jan 19 (wraps year).
const ZODIAC_START: { month: number; day: number }[] = [
  { month: 12, day: 22 }, // Capricorn
  { month: 1, day: 20 },  // Aquarius
  { month: 2, day: 19 },  // Pisces
  { month: 3, day: 21 },  // Aries
  { month: 4, day: 20 },  // Taurus
  { month: 5, day: 21 },  // Gemini
  { month: 6, day: 21 },  // Cancer
  { month: 7, day: 23 },  // Leo
  { month: 8, day: 23 },  // Virgo
  { month: 9, day: 23 },  // Libra
  { month: 10, day: 23 }, // Scorpio
  { month: 11, day: 22 }, // Sagittarius
];

export function getZodiac(month: number, day: number): ZodiacSign {
  // Find the sign whose start is on or before the given date (in chronological order Jan→Dec,
  // with Capricorn handled via the Dec wrap).
  // Iterate signs in calendar order: Capricorn applies from Dec 22 onward AND Jan 1-19.
  // Simpler: find the latest start date <= (month, day); if none (Jan 1-19), it's Capricorn.
  let result = ZODIAC[0]; // default Capricorn
  let resultKey = -1;
  for (let i = 0; i < ZODIAC_START.length; i++) {
    const s = ZODIAC_START[i];
    const key = s.month * 100 + s.day;
    const input = month * 100 + day;
    if (key <= input) {
      if (key > resultKey) {
        resultKey = key;
        result = ZODIAC[i];
      }
    }
  }
  // If input is Jan 1-19, no start date is <= it except Capricorn's Dec 22 (month=12 > month=1),
  // so result stays Capricorn (default). Correct.
  return result;
}

export function getZodiacFromIso(iso: string): ZodiacSign | null {
  const month = parseInt(iso.slice(5, 7), 10);
  const day = parseInt(iso.slice(8, 10), 10);
  if (!month || !day) return null;
  return getZodiac(month, day);
}

// Age group from birth year (very rough; for LLM context only).
export function ageGroupFromYear(year: number | null): string | null {
  if (!year) return null;
  const age = new Date().getUTCFullYear() - year;
  if (age < 18) return "young";
  if (age < 25) return "young_adult";
  if (age < 40) return "adult";
  if (age < 60) return "mature";
  return "senior";
}

// Very naive Russian-name gender inference (kept from old concept; only used as a soft hint).
export function inferGender(name: string): "male" | "female" | null {
  const n = name.trim().toLowerCase();
  if (!n) return null;
  if (/[ая]$/.test(n) && !["николь", "габриэль"].includes(n)) return "female";
  if (/[йье]$/.test(n)) return "male";
  return null;
}
