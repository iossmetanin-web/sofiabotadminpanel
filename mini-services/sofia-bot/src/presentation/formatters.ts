// presentation/formatters.ts — text formatting + HTML escape.
// Per Skill §5: HTML parse mode; escape user input; extract formatting into functions.

import type { UserDTO, ReadingDTO, TransactionDTO } from "../application/ports.js";
import { ZODIAC } from "../domain/zodiac.js";

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function zodiacEmoji(name: string | null): string {
  if (!name) return "";
  const z = ZODIAC.find((x) => x.name === name);
  return z?.emoji ?? "";
}

export function formatProfile(u: UserDTO): string {
  const lines: string[] = [`👤 <b>Профиль</b>`, ""];
  lines.push(`Имя: <b>${escapeHtml(u.name ?? "—")}</b>`);
  if (u.zodiacSign) lines.push(`Знак: ${zodiacEmoji(u.zodiacSign)} ${escapeHtml(u.zodiacSign)}`);
  if (u.ageGroup) lines.push(`Возрастная группа: ${escapeHtml(u.ageGroup)}`);
  lines.push(`Сообщений в нашем диалоге: ${u.messageCount}`);
  lines.push(`🔥 Серия: ${u.streakDays} дн.`);
  lines.push(`💎 Кристаллы: <b>${u.crystals}</b>`);
  if (u.subscriptionType) {
    const until = u.subscriptionUntil ? new Date(u.subscriptionUntil).toLocaleDateString("ru-RU") : "—";
    lines.push(`⭐ Подписка: ${u.subscriptionType === "weekly" ? "недельная" : "месячная"} (до ${until})`);
  }
  if (u.referralCode) {
    lines.push("");
    lines.push(`🎁 Твой код приглашения: <code>${u.referralCode}</code>`);
  }
  return lines.join("\n");
}

export function formatBalance(u: UserDTO): string {
  const lines: string[] = [`💎 <b>Баланс</b>`, "", `Кристаллов: <b>${u.crystals}</b>`];
  if (u.subscriptionType) {
    const until = u.subscriptionUntil ? new Date(u.subscriptionUntil).toLocaleDateString("ru-RU") : "—";
    lines.push(`Подписка: ${u.subscriptionType === "weekly" ? "недельная" : "месячная"} · до ${until}`);
  } else {
    lines.push("Подписка: нет");
  }
  return lines.join("\n");
}

export function formatReadingHistoryItem(r: ReadingDTO, index: number): string {
  const typeLabel: Record<string, string> = {
    fate_card: "🌟 Карта судьбы",
    tarot_small: "🃏 Малый расклад",
    tarot_full: "🌑 Полный расклад",
    tarot_love: "💑 Любовный",
    tarot_career: "💼 Карьера",
    tarot_decision: "🛤 Решение",
    horoscope: "♈ Гороскоп",
    single_card: "🃏 Одна карта",
    card_of_day: "🌙 Карта дня",
  };
  const date = new Date(r.createdAt).toLocaleDateString("ru-RU");
  const label = typeLabel[r.type] ?? r.type;
  const preview = r.interpretation.slice(0, 80).replace(/\n/g, " ");
  return `<b>${index}. ${label}</b> · ${date}\n${escapeHtml(preview)}…`;
}

export function formatTransaction(t: TransactionDTO): string {
  const sign = t.amount >= 0 ? "+" : "";
  const typeLabel: Record<string, string> = {
    spend: "💸", add: "➕", admin_gift: "🎁", referral: "👥", subscription: "⭐", daily_bonus: "🌙",
  };
  const emoji = typeLabel[t.type] ?? "•";
  const date = new Date(t.createdAt).toLocaleDateString("ru-RU");
  const desc = t.description ? escapeHtml(t.description) : "";
  return `${emoji} ${date} · ${sign}${t.amount} 💎 — ${desc}`;
}

// Split a long text into chunks <= 4096 chars, on paragraph boundaries where possible.
export function splitMessage(text: string, maxLen = 4096): string[] {
  if (text.length <= maxLen) return [text];
  const chunks: string[] = [];
  let rest = text;
  while (rest.length > maxLen) {
    let cut = rest.lastIndexOf("\n\n", maxLen);
    if (cut <= 0) cut = rest.lastIndexOf("\n", maxLen);
    if (cut <= 0) cut = maxLen;
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut).replace(/^\n+/, "");
  }
  if (rest.length > 0) chunks.push(rest);
  return chunks;
}

// Rudeness detection — word-boundary regex (fixes old bot's substring collision bug).
const RUDENESS_WORDS = [
  "дурак","дура","идиот","придурок","тупой","тупая","дебил","урод","сволочь","сука","блять","блядь","хуй","пиздец","пошёл","пошла","отстань","заткнись","ненавижу",
];
export function isRude(text: string): boolean {
  const lower = text.toLowerCase();
  for (const w of RUDENESS_WORDS) {
    const re = new RegExp(`\\b${w}\\b`, "i");
    if (re.test(lower)) return true;
  }
  return false;
}

const SORRY_WORDS = ["извини", "извините", "прости", "простите", "извеняю", "сорри"];
export function isSorry(text: string): boolean {
  const lower = text.toLowerCase();
  return SORRY_WORDS.some((w) => new RegExp(`\\b${w}\\b`, "i").test(lower));
}

const SKIP_WORDS = ["пропустить", "пропуск", "skip", "далее", "дальше", "не помню", "не знаю"];
export function isSkip(text: string): boolean {
  const lower = text.toLowerCase();
  return SKIP_WORDS.some((w) => new RegExp(`\\b${w}\\b`, "i").test(lower));
}

// Menu triggers — word-boundary.
export function matchTrigger(text: string): "menu" | "balance" | "profile" | "history" | null {
  const lower = text.toLowerCase();
  const has = (words: string[]) => words.some((w) => new RegExp(`\\b${w}\\b`, "i").test(lower));
  if (has(["меню", "menu", "главное"])) return "menu";
  if (has(["баланс", "кристаллы", "кристалл", "balance"])) return "balance";
  if (has(["профиль", "кто я", "про меня", "обо мне", "profile"])) return "profile";
  if (has(["история", "расклады", "мои расклады", "журнал", "history"])) return "history";
  return null;
}

// Detect reading type from free text — returns the spread type or null.
export function detectReadingType(text: string): string | null {
  const lower = text.toLowerCase();
  const has = (words: string[]) => words.some((w) => new RegExp(`\\b${w}\\b`, "i").test(lower));
  if (has(["малый", "малое", "5 карт", "пять карт"])) return "tarot_small";
  if (has(["полный", "полное", "20 карт", "двадцать карт"])) return "tarot_full";
  if (has(["любовный", "любовное", "любовь", "отношения"])) return "tarot_love";
  if (has(["карьера", "работа", "дело", "бизнес"])) return "tarot_career";
  if (has(["решение", "выбор", "развилка"])) return "tarot_decision";
  if (has(["гороскоп", "зодиак"])) return "horoscope";
  if (has(["бесплатная карта", "бесплатную карту", "одна карта"])) return "single_card";
  if (has(["карта дня", "карту дня"])) return "card_of_day";
  if (has(["расклад", "погадай", "таро"])) return "tarot_small"; // default to small
  return null;
}
