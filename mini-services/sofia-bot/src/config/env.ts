// config/env.ts — typed environment via zod, fail-fast at startup.
// Per Skill §4: configuration comes from environment, never hardcoded.

import { z } from "zod";

const envSchema = z.object({
  BOT_TOKEN: z.string().min(10, "BOT_TOKEN is required"),
  ADMIN_IDS: z.string().default("").transform((s) =>
    s.split(",").map((x) => x.trim()).filter(Boolean).map((x) => x)),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  INTERNAL_PORT: z.coerce.number().default(3003),
  INTERNAL_SECRET: z.string().default("dev-secret"),
  DAILY_FREE_MESSAGES: z.coerce.number().default(10),
  MEMORY_EXTRACT_INTERVAL: z.coerce.number().default(5),
  RETURN_ABSENCE_HOURS: z.coerce.number().default(20),
  FREE_CARD_COOLDOWN_HOURS: z.coerce.number().default(24),
  DAILY_CARD_COOLDOWN_HOURS: z.coerce.number().default(20),
  STALE_STATE_MINUTES: z.coerce.number().default(30),
  PRICE_TAROT_SMALL: z.coerce.number().default(1),
  PRICE_TAROT_FULL: z.coerce.number().default(3),
  PRICE_TAROT_LOVE: z.coerce.number().default(2),
  PRICE_TAROT_CAREER: z.coerce.number().default(2),
  PRICE_TAROT_DECISION: z.coerce.number().default(2),
  PRICE_HOROSCOPE: z.coerce.number().default(2),
  PRICE_TODAY: z.coerce.number().default(1),
  WELCOME_CRYSTALS: z.coerce.number().default(3),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  // Bun auto-loads .env; ensure process.env is populated.
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("❌ Invalid environment configuration:\n",
      parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n"));
    process.exit(1);
  }
  return parsed.data;
}

export const env = loadEnv();

export const pricing = {
  tarot_small: env.PRICE_TAROT_SMALL,
  tarot_full: env.PRICE_TAROT_FULL,
  tarot_love: env.PRICE_TAROT_LOVE,
  tarot_career: env.PRICE_TAROT_CAREER,
  tarot_decision: env.PRICE_TAROT_DECISION,
  horoscope: env.PRICE_HOROSCOPE,
  today: env.PRICE_TODAY,
} as const;

export const behavior = {
  dailyFreeMessages: env.DAILY_FREE_MESSAGES,
  memoryExtractInterval: env.MEMORY_EXTRACT_INTERVAL,
  returnAbsenceHours: env.RETURN_ABSENCE_HOURS,
  freeCardCooldownHours: env.FREE_CARD_COOLDOWN_HOURS,
  dailyCardCooldownHours: env.DAILY_CARD_COOLDOWN_HOURS,
  staleStateMinutes: env.STALE_STATE_MINUTES,
} as const;

export function isAdmin(telegramId: string): boolean {
  return env.ADMIN_IDS.includes(telegramId);
}
