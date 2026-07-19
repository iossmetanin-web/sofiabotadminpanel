// presentation/formatters.ts — text formatting + HTML escape + i18n-aware helpers.
// Per Skill §5: HTML parse mode; escape user input; extract formatting into functions.

import type { UserDTO, ReadingDTO, TransactionDTO } from "../application/ports.js";
import { ZODIAC } from "../domain/zodiac.js";
import { t, type Locale } from "../domain/i18n.js";

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
  const loc: Locale = u.language;
  const lines: string[] = [t(loc, "profile_title"), ""];
  lines.push(t(loc, "profile_name", { name: u.name ?? "—" }));
  if (u.zodiacSign) lines.push(t(loc, "profile_zodiac", { sign: `${zodiacEmoji(u.zodiacSign)} ${escapeHtml(u.zodiacSign)}` }));
  if (u.ageGroup) lines.push(t(loc, "profile_age_group", { group: escapeHtml(u.ageGroup) }));
  lines.push(t(loc, "profile_messages", { count: String(u.messageCount) }));
  lines.push(t(loc, "profile_streak", { days: String(u.streakDays) }));
  lines.push(t(loc, "profile_crystals", { count: String(u.crystals) }));
  if (u.subscriptionType) {
    const until = u.subscriptionUntil ? new Date(u.subscriptionUntil).toLocaleDateString(loc === "en" ? "en-US" : "ru-RU") : "—";
    const subLabel = u.subscriptionType === "weekly"
      ? (loc === "en" ? "weekly" : "недельная")
      : (loc === "en" ? "monthly" : "месячная");
    lines.push(t(loc, "profile_subscription", { type: subLabel, until }));
  }
  if (u.referralCode) {
    lines.push("");
    lines.push(t(loc, "profile_referral_code", { code: u.referralCode }));
  }
  return lines.join("\n");
}

export function formatBalance(u: UserDTO): string {
  const loc: Locale = u.language;
  const lines: string[] = [t(loc, "balance_title"), "", t(loc, "balance_crystals", { count: String(u.crystals) })];
  if (u.subscriptionType) {
    const until = u.subscriptionUntil ? new Date(u.subscriptionUntil).toLocaleDateString(loc === "en" ? "en-US" : "ru-RU") : "—";
    const subLabel = u.subscriptionType === "weekly"
      ? (loc === "en" ? "weekly" : "недельная")
      : (loc === "en" ? "monthly" : "месячная");
    lines.push(t(loc, "balance_subscription", { type: subLabel, until }));
  } else {
    lines.push(t(loc, "balance_no_subscription"));
  }
  return lines.join("\n");
}

export function formatReadingHistoryItem(r: ReadingDTO, index: number, loc: Locale = "ru"): string {
  const typeLabel: Record<string, { ru: string; en: string }> = {
    fate_card: { ru: "🌟 Карта судьбы", en: "🌟 Fate card" },
    tarot_small: { ru: "🃏 Малый расклад", en: "🃏 Small spread" },
    tarot_full: { ru: "🌑 Полный расклад", en: "🌑 Full spread" },
    tarot_love: { ru: "💑 Любовный", en: "💑 Love" },
    tarot_career: { ru: "💼 Карьера", en: "💼 Career" },
    tarot_decision: { ru: "🛤 Решение", en: "🛤 Decision" },
    horoscope: { ru: "♈ Гороскоп", en: "♈ Horoscope" },
    single_card: { ru: "🃏 Одна карта", en: "🃏 Single card" },
    card_of_day: { ru: "🌙 Карта дня", en: "🌙 Card of the day" },
  };
  const date = new Date(r.createdAt).toLocaleDateString(loc === "en" ? "en-US" : "ru-RU");
  const label = typeLabel[r.type]?.[loc] ?? r.type;
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

const SORRY_WORDS = ["извини", "извините", "прости", "простите", "извеняю", "сорри", "sorry", "apologize"];
export function isSorry(text: string): boolean {
  const lower = text.toLowerCase();
  return SORRY_WORDS.some((w) => new RegExp(`\\b${w}\\b`, "i").test(lower));
}

const SKIP_WORDS = ["пропустить", "пропуск", "skip", "далее", "дальше", "не помню", "не знаю", "don't remember", "dont remember"];
export function isSkip(text: string): boolean {
  const lower = text.toLowerCase();
  return SKIP_WORDS.some((w) => new RegExp(`\\b${w.replace(/'/g, "\\'")}\\b`, "i").test(lower));
}

// Menu triggers — word-boundary. Supports both RU and EN.
export function matchTrigger(text: string): "menu" | "balance" | "profile" | "history" | null {
  const lower = text.toLowerCase();
  const has = (words: string[]) => words.some((w) => new RegExp(`\\b${w}\\b`, "i").test(lower));
  if (has(["меню", "menu", "главное", "main"])) return "menu";
  if (has(["баланс", "кристаллы", "кристалл", "balance", "crystals"])) return "balance";
  if (has(["профиль", "кто я", "про меня", "обо мне", "profile", "about me"])) return "profile";
  if (has(["история", "расклады", "мои расклады", "журнал", "history", "journal", "readings"])) return "history";
  return null;
}

// Detect reading type from free text — supports both RU and EN.
export function detectReadingType(text: string): string | null {
  const lower = text.toLowerCase();
  const has = (words: string[]) => words.some((w) => new RegExp(`\\b${w}\\b`, "i").test(lower));
  if (has(["малый", "малое", "5 карт", "пять карт", "small", "5 cards"])) return "tarot_small";
  if (has(["полный", "полное", "20 карт", "двадцать карт", "full", "20 cards"])) return "tarot_full";
  if (has(["любовный", "любовное", "любовь", "отношения", "love", "relationship"])) return "tarot_love";
  if (has(["карьера", "работа", "дело", "бизнес", "career", "work", "job"])) return "tarot_career";
  if (has(["решение", "выбор", "развилка", "decision", "choice", "crossroads"])) return "tarot_decision";
  if (has(["гороскоп", "зодиак", "horoscope", "zodiac"])) return "horoscope";
  if (has(["бесплатная карта", "бесплатную карту", "одна карта", "free card", "one card", "single card"])) return "single_card";
  if (has(["карта дня", "карту дня", "card of the day", "card of day", "daily card"])) return "card_of_day";
  if (has(["расклад", "погадай", "таро", "reading", "tarot", "read"])) return "tarot_small"; // default to small
  return null;
}

// Format the admin weekly digest message body (no LLM, just stats).
export function formatDigestBody(
  newUsers: number, active7d: number, messages: number, readings: number,
  crystals: number, top3: { name: string; messages: number; readings: number }[],
): string {
  const top3Str = top3.length > 0
    ? top3.map((u, i) => `${i + 1}. ${escapeHtml(u.name)} — ${u.messages} ${messages === 1 ? "msg" : "msgs"}, ${u.readings} ${readings === 1 ? "reading" : "readings"}`).join("\n")
    : "—";
  return t("ru", "digest_admin_summary", {
    newUsers: String(newUsers),
    active7d: String(active7d),
    messages: String(messages),
    readings: String(readings),
    crystals: String(crystals),
    top3: top3Str,
  });
}
