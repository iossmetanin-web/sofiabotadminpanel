// Zodiac data — shared with the bot domain (kept in sync). Public-domain glyphs + names.

export const ZODIAC = [
  { name: 'Козерог', nameEn: 'Capricorn', emoji: '♑', start: [12, 22], end: [1, 19] },
  { name: 'Водолей', nameEn: 'Aquarius', emoji: '♒', start: [1, 20], end: [2, 18] },
  { name: 'Рыбы', nameEn: 'Pisces', emoji: '♓', start: [2, 19], end: [3, 20] },
  { name: 'Овен', nameEn: 'Aries', emoji: '♈', start: [3, 21], end: [4, 19] },
  { name: 'Телец', nameEn: 'Taurus', emoji: '♉', start: [4, 20], end: [5, 20] },
  { name: 'Близнецы', nameEn: 'Gemini', emoji: '♊', start: [5, 21], end: [6, 20] },
  { name: 'Рак', nameEn: 'Cancer', emoji: '♋', start: [6, 21], end: [7, 22] },
  { name: 'Лев', nameEn: 'Leo', emoji: '♌', start: [7, 23], end: [8, 22] },
  { name: 'Дева', nameEn: 'Virgo', emoji: '♍', start: [8, 23], end: [9, 22] },
  { name: 'Весы', nameEn: 'Libra', emoji: '♎', start: [9, 23], end: [10, 22] },
  { name: 'Скорпион', nameEn: 'Scorpio', emoji: '♏', start: [10, 23], end: [11, 21] },
  { name: 'Стрелец', nameEn: 'Sagittarius', emoji: '♐', start: [11, 22], end: [12, 21] },
] as const;

export const ZODIAC_EMOJI: Record<string, string> = Object.fromEntries(
  ZODIAC.map((z) => [z.name, z.emoji]),
);
