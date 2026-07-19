// infrastructure/prisma.ts — PrismaClient singleton + WAL mode for SQLite.
// Per Skill §4: repository pattern wraps this; handlers never import Prisma directly.

import { PrismaClient } from "@prisma/client";
import { logger } from "./logger.js";

export const prisma = new PrismaClient({ log: ["warn", "error"] });

let walInitialized = false;
export async function initDb(): Promise<void> {
  if (walInitialized) return;
  try {
    // PRAGMA journal_mode=WAL returns a row; use $queryRaw. foreign_keys returns nothing.
    await prisma.$queryRawUnsafe("PRAGMA journal_mode=WAL;");
    await prisma.$executeRawUnsafe("PRAGMA foreign_keys=ON;");
    walInitialized = true;
    logger.info("database initialized (WAL mode)");
  } catch (e) {
    logger.error({ err: e }, "failed to initialize database");
    throw e;
  }
}

export async function disconnectDb(): Promise<void> {
  await prisma.$disconnect();
}
