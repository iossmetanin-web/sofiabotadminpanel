// domain/valueObjects.ts — immutable value objects with validation.
// Per Skill §2: VOs are the primary validation surface; invalid data cannot enter.

import { ValidationError } from "./exceptions.js";

// Crystals — currency. Cannot go negative. spend() enforces invariant.
export class Crystals {
  private constructor(public readonly amount: number) {
    if (!Number.isInteger(amount) || amount < 0) {
      throw new ValidationError(`Crystals must be a non-negative integer, got ${amount}`);
    }
  }
  static of(n: number): Crystals {
    return new Crystals(Math.max(0, Math.floor(n)));
  }
  canSpend(n: number): boolean {
    return this.amount >= n;
  }
  spend(n: number): Crystals {
    if (n <= 0) return this;
    if (this.amount < n) {
      throw new ValidationError(`Cannot spend ${n} from ${this.amount}`);
    }
    return new Crystals(this.amount - n);
  }
  add(n: number): Crystals {
    if (n <= 0) return this;
    return new Crystals(this.amount + n);
  }
}

// MessageText — sanitize + cap length for storage/Telegram.
export class MessageText {
  public readonly text: string;
  private constructor(raw: string) {
    // Strip null bytes & control chars (except \n\t), normalize unicode, cap.
    const cleaned = raw
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
      .normalize("NFKC")
      .slice(0, 4096);
    this.text = cleaned;
  }
  static from(raw: unknown): MessageText {
    if (typeof raw !== "string") throw new ValidationError("Message must be a string");
    if (raw.length === 0) throw new ValidationError("Message cannot be empty");
    return new MessageText(raw);
  }
  // For conversation storage — stricter cap.
  forStorage(maxLen = 2000): string {
    return this.text.slice(0, maxLen);
  }
  get length(): number {
    return this.text.length;
  }
}

// BirthDate — date parse + zodiac derivation lives in zodiac.ts to avoid cycle.
export class BirthDate {
  public readonly iso: string; // YYYY-MM-DD
  private constructor(iso: string) {
    this.iso = iso;
  }
  static parse(input: string): BirthDate {
    // Accept DD.MM.YYYY, DD.MM, DD/MM/YYYY, YYYY-MM-DD.
    const m1 = input.match(/^(\d{1,2})[.\/](\d{1,2})(?:[.\/](\d{2,4}))?$/);
    if (m1) {
      const day = parseInt(m1[1], 10);
      const month = parseInt(m1[2], 10);
      let year = m1[3] ? parseInt(m1[3], 10) : null;
      if (year !== null && year < 100) year += year < 50 ? 2000 : 1900;
      if (month < 1 || month > 12) throw new ValidationError(`Month must be 1-12, got ${month}`);
      if (day < 1 || day > 31) throw new ValidationError(`Day must be 1-31, got ${day}`);
      const y = year ?? 2000; // placeholder for DD.MM without year
      const d = new Date(Date.UTC(y, month - 1, day));
      if (d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
        throw new ValidationError(`Invalid date: ${input}`);
      }
      if (year !== null) {
        const now = new Date();
        if (y < 1900 || y > now.getUTCFullYear()) {
          throw new ValidationError(`Year must be 1900-${now.getUTCFullYear()}, got ${y}`);
        }
      }
      return new BirthDate(d.toISOString().slice(0, 10));
    }
    const m2 = input.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m2) {
      const y = parseInt(m2[1], 10);
      const now = new Date();
      if (y < 1900 || y > now.getUTCFullYear()) {
        throw new ValidationError(`Year must be 1900-${now.getUTCFullYear()}`);
      }
      return new BirthDate(input);
    }
    throw new ValidationError(`Could not parse date: ${input}. Try DD.MM.YYYY`);
  }
  get year(): number | null {
    const y = parseInt(this.iso.slice(0, 4), 10);
    return y === 2000 ? null : y; // ambiguous if DD.MM only
  }
  get month(): number {
    return parseInt(this.iso.slice(5, 7), 10);
  }
  get day(): number {
    return parseInt(this.iso.slice(8, 10), 10);
  }
}

// TelegramId — non-empty string (Prisma stores as String for SQLite compat).
export class TelegramId {
  private constructor(public readonly value: string) {}
  static of(v: unknown): TelegramId {
    if (typeof v !== "string" || v.length === 0) {
      throw new ValidationError(`Invalid telegram id: ${v}`);
    }
    return new TelegramId(v);
  }
}

// Numbers input — for tarot card selection.
export class NumberList {
  public readonly numbers: number[];
  private constructor(nums: number[]) {
    this.numbers = nums;
  }
  static parse(input: string, expectedCount: number, max: number = 78): NumberList {
    const tokens = input.match(/\d+/g);
    if (!tokens) throw new ValidationError("Я не увидела чисел. Попробуй ещё раз.");
    const nums = tokens.map((t) => parseInt(t, 10)).filter((n) => n >= 1 && n <= max);
    if (nums.length !== expectedCount) {
      throw new ValidationError(
        `Нужно ${expectedCount} чисел от 1 до ${max}, а ты дал ${nums.length}.`);
    }
    return new NumberList(nums);
  }
}
