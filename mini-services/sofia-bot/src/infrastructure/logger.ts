// infrastructure/logger.ts — pino structured logging with bound context.
// Per Skill §4: structlog equivalent; correlation IDs; no print().

import pino from "pino";
import { env } from "../config/env.js";

const isDev = process.env.NODE_ENV !== "production";

export const logger = pino({
  level: isDev ? "debug" : "info",
  transport: isDev
    ? { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss.l" } }
    : undefined,
  redact: {
    paths: [
      "BOT_TOKEN", "*.BOT_TOKEN",
      "req.headers.authorization", "req.headers['x-telegram-bot-api-secret-token']",
      "*.token", "*.secret", "*.apiKey",
    ],
    censor: "[REDACTED]",
  },
});

export function childLogger(bindings: Record<string, unknown>) {
  return logger.child(bindings);
}
