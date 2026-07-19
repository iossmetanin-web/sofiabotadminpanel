// infrastructure/repositories.ts — Prisma repository implementations.
// Per Skill §4: repository pattern; entity↔ORM mapping; no ORM in handlers.

import { prisma } from "./prisma.js";
import type {
  UserRepository, ConversationRepository, MemoryRepository,
  TransactionRepository, ReadingRepository, AuditLogRepository, BroadcastRepository,
  UserDTO, ConversationMessageDTO, MemoryDTO, TransactionDTO, ReadingDTO,
} from "../application/ports.js";
import type { SofiaState } from "../domain/states.js";
import { RepositoryError } from "../domain/exceptions.js";
import { randomBytes } from "crypto";

// ---- Mappers (Prisma row -> DTO) ----

function toUserDTO(u: any): UserDTO {
  return {
    id: u.id,
    telegramId: u.telegramId,
    username: u.username,
    firstName: u.firstName,
    name: u.name,
    language: (u.language === "en" ? "en" : "ru") as "ru" | "en",
    birthDate: u.birthDate ? (u.birthDate instanceof Date ? u.birthDate.toISOString().slice(0, 10) : String(u.birthDate).slice(0, 10)) : null,
    birthTime: u.birthTime,
    birthPlace: u.birthPlace,
    gender: u.gender,
    ageGroup: u.ageGroup,
    zodiacSign: u.zodiacSign,
    onboardingCompleted: u.onboardingCompleted,
    onboardingStep: u.onboardingStep,
    crystals: u.crystals,
    subscriptionType: u.subscriptionType,
    subscriptionUntil: u.subscriptionUntil,
    streakDays: u.streakDays,
    lastActivityDay: u.lastActivityDay,
    lastSeenAt: u.lastSeenAt,
    lastDailyCardAt: u.lastDailyCardAt,
    lastFreeCardAt: u.lastFreeCardAt,
    referredById: u.referredById,
    referralCode: u.referralCode,
    referralRewardGiven: u.referralRewardGiven,
    rudenessCount: u.rudenessCount,
    isBlocked: u.isBlocked,
    isAdmin: u.isAdmin,
    messageCount: u.messageCount,
    dailyMessageCount: u.dailyMessageCount,
    dailyMessageDate: u.dailyMessageDate,
    lastTopicSummary: u.lastTopicSummary,
    createdAt: u.createdAt,
  };
}

export function generateReferralCode(): string {
  return randomBytes(4).toString("hex").toUpperCase();
}

// ---- UserRepository ----

export class PrismaUserRepository implements UserRepository {
  async findByTelegramId(telegramId: string): Promise<UserDTO | null> {
    const u = await prisma.user.findUnique({ where: { telegramId } });
    return u ? toUserDTO(u) : null;
  }
  async findById(id: string): Promise<UserDTO | null> {
    const u = await prisma.user.findUnique({ where: { id } });
    return u ? toUserDTO(u) : null;
  }
  async findByUsername(username: string): Promise<UserDTO | null> {
    const u = await prisma.user.findFirst({ where: { username } });
    return u ? toUserDTO(u) : null;
  }
  async findByReferralCode(code: string): Promise<UserDTO | null> {
    const u = await prisma.user.findUnique({ where: { referralCode: code } });
    return u ? toUserDTO(u) : null;
  }
  async create(data: {
    telegramId: string; username?: string | null; firstName?: string | null;
    referralCode: string; referredByReferralCode?: string | null;
    welcomeCrystals: number; isAdmin: boolean;
  }): Promise<UserDTO> {
    // Resolve referrer if a code was given.
    let referredById: string | null = null;
    if (data.referredByReferralCode) {
      const ref = await prisma.user.findUnique({ where: { referralCode: data.referredByReferralCode } });
      if (ref) referredById = ref.id;
    }
    try {
      const u = await prisma.user.create({
        data: {
          telegramId: data.telegramId,
          username: data.username ?? null,
          firstName: data.firstName ?? null,
          referralCode: data.referralCode,
          referredById,
          crystals: data.welcomeCrystals,
          isAdmin: data.isAdmin,
          language: "ru",
          onboardingStep: "START",
          lastSeenAt: new Date(),
        },
      });
      // Record welcome bonus as a transaction.
      await prisma.transaction.create({
        data: {
          userId: u.id, type: "add", amount: data.welcomeCrystals,
          description: "Приветственный бонус", balanceAfter: data.welcomeCrystals,
        },
      });
      return toUserDTO(u);
    } catch (e: any) {
      if (e?.code === "P2002") {
        // Unique constraint — user already exists. Return existing.
        const existing = await prisma.user.findUnique({ where: { telegramId: data.telegramId } });
        if (existing) return toUserDTO(existing);
      }
      throw new RepositoryError(`Failed to create user: ${e?.message}`, e);
    }
  }
  async update(telegramId: string, fields: Partial<Omit<UserDTO, "id" | "telegramId" | "createdAt">>): Promise<UserDTO> {
    // Only update known scalar fields; ignore relation fields.
    const allowed: string[] = [
      "username","firstName","name","birthDate","birthTime","birthPlace","gender","ageGroup",
      "zodiacSign","onboardingCompleted","onboardingStep","crystals","subscriptionType",
      "subscriptionUntil","streakDays","lastActivityDay","lastSeenAt","lastDailyCardAt",
      "lastFreeCardAt","rudenessCount","isBlocked","isAdmin","messageCount","dailyMessageCount",
      "dailyMessageDate","lastTopicSummary","language",
    ];
    const data: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(fields)) {
      if (allowed.includes(k)) data[k] = v;
    }
    if (data.birthDate && typeof data.birthDate === "string") {
      data.birthDate = new Date(data.birthDate + "T00:00:00Z");
    }
    const u = await prisma.user.update({ where: { telegramId }, data });
    return toUserDTO(u);
  }
  async setState(telegramId: string, state: SofiaState): Promise<void> {
    await prisma.user.update({ where: { telegramId }, data: { onboardingStep: state } });
  }
  async delete(telegramId: string): Promise<void> {
    const u = await prisma.user.findUnique({ where: { telegramId } });
    if (u) await prisma.user.delete({ where: { id: u.id } });
  }
  async countAll(): Promise<number> {
    return prisma.user.count();
  }
  async countActiveSince(since: Date): Promise<number> {
    return prisma.user.count({ where: { lastSeenAt: { gte: since } } });
  }
  async countOnboardingCompleted(): Promise<number> {
    return prisma.user.count({ where: { onboardingCompleted: true } });
  }
  async listPaginated(offset: number, limit: number): Promise<UserDTO[]> {
    const rows = await prisma.user.findMany({
      orderBy: { createdAt: "desc" }, skip: offset, take: limit,
    });
    return rows.map(toUserDTO);
  }
  async listInactiveSince(since: Date, limit: number): Promise<UserDTO[]> {
    const rows = await prisma.user.findMany({
      where: { lastSeenAt: { lt: since }, onboardingCompleted: true, isBlocked: false },
      orderBy: { lastSeenAt: "asc" }, take: limit,
    });
    return rows.map(toUserDTO);
  }
  async listBirthdaysToday(limit: number): Promise<UserDTO[]> {
    const now = new Date();
    const month = now.getUTCMonth() + 1;
    const day = now.getUTCDate();
    const all = await prisma.user.findMany({
      where: { birthDate: { not: null } },
      take: 1000,
    });
    const today = all.filter((u: any) => {
      if (!u.birthDate) return false;
      const bd = u.birthDate instanceof Date ? u.birthDate : new Date(u.birthDate);
      return bd.getUTCMonth() + 1 === month && bd.getUTCDate() === day;
    });
    return today.slice(0, limit).map(toUserDTO);
  }
  async listAllForBroadcast(limit: number): Promise<UserDTO[]> {
    const rows = await prisma.user.findMany({
      where: { isBlocked: false, onboardingCompleted: true },
      take: limit,
    });
    return rows.map(toUserDTO);
  }
}

// ---- ConversationRepository ----

export class PrismaConversationRepository implements ConversationRepository {
  async save(userId: string, role: "user" | "sofia", content: string, emotionTag?: string | null): Promise<void> {
    await prisma.conversation.create({
      data: { userId, role, content: content.slice(0, 4000), emotionTag: emotionTag ?? null },
    });
  }
  async recent(userId: string, limit: number): Promise<ConversationMessageDTO[]> {
    const rows = await prisma.conversation.findMany({
      where: { userId }, orderBy: { createdAt: "desc" }, take: limit,
    });
    return rows.reverse().map((r: any) => ({
      role: r.role, content: r.content, createdAt: r.createdAt,
    }));
  }
  async countByUser(userId: string): Promise<number> {
    return prisma.conversation.count({ where: { userId } });
  }
  async countAll(): Promise<number> {
    return prisma.conversation.count();
  }
}

// ---- MemoryRepository ----

export class PrismaMemoryRepository implements MemoryRepository {
  async upsert(userId: string, kind: "fact" | "emotional", category: string, content: string, importance: number): Promise<void> {
    // Dedup by (userId, kind, category, content). If exists, bump importance.
    const existing = await prisma.memory.findFirst({
      where: { userId, kind, category, content },
    });
    if (existing) {
      await prisma.memory.update({
        where: { id: existing.id },
        data: { importance: Math.max(existing.importance, importance), updatedAt: new Date() },
      });
    } else {
      await prisma.memory.create({
        data: { userId, kind, category, content: content.slice(0, 1000), importance },
      });
    }
  }
  async listByUser(userId: string, kind?: "fact" | "emotional", limit = 10): Promise<MemoryDTO[]> {
    const rows = await prisma.memory.findMany({
      where: { userId, ...(kind ? { kind } : {}) },
      orderBy: [{ importance: "desc" }, { createdAt: "desc" }], take: limit,
    });
    return rows.map((r: any) => ({
      id: r.id, kind: r.kind, category: r.category, content: r.content,
      context: r.context, importance: r.importance,
    }));
  }
  async listImportant(userId: string, limit: number): Promise<MemoryDTO[]> {
    const rows = await prisma.memory.findMany({
      where: { userId }, orderBy: [{ importance: "desc" }, { createdAt: "desc" }], take: limit,
    });
    return rows.map((r: any) => ({
      id: r.id, kind: r.kind, category: r.category, content: r.content,
      context: r.context, importance: r.importance,
    }));
  }
  async deleteByUser(userId: string): Promise<void> {
    await prisma.memory.deleteMany({ where: { userId } });
  }
}

// ---- TransactionRepository ----

export class PrismaTransactionRepository implements TransactionRepository {
  async record(userId: string, type: string, amount: number, description: string | null, balanceAfter: number): Promise<void> {
    await prisma.transaction.create({
      data: { userId, type, amount, description, balanceAfter },
    });
  }
  async listByUser(userId: string, limit: number): Promise<TransactionDTO[]> {
    const rows = await prisma.transaction.findMany({
      where: { userId }, orderBy: { createdAt: "desc" }, take: limit,
    });
    return rows.map((r: any) => ({
      id: r.id, type: r.type, amount: r.amount, description: r.description,
      balanceAfter: r.balanceAfter, createdAt: r.createdAt,
    }));
  }
  async sumCrystalsSpent(): Promise<number> {
    const result = await prisma.transaction.aggregate({
      where: { type: "spend" }, _sum: { amount: true },
    });
    return result._sum.amount ?? 0;
  }
  async countByType(type: string): Promise<number> {
    return prisma.transaction.count({ where: { type } });
  }
}

// ---- ReadingRepository ----

export class PrismaReadingRepository implements ReadingRepository {
  async save(userId: string, type: string, question: string | null, cards: string, interpretation: string, cost: number): Promise<ReadingDTO> {
    const r = await prisma.reading.create({
      data: { userId, type, question, cards, interpretation: interpretation.slice(0, 8000), cost },
    });
    return {
      id: r.id, type: r.type, question: r.question, cards: r.cards,
      interpretation: r.interpretation, cost: r.cost, createdAt: r.createdAt,
    };
  }
  async listByUser(userId: string, limit: number, offset: number): Promise<ReadingDTO[]> {
    const rows = await prisma.reading.findMany({
      where: { userId }, orderBy: { createdAt: "desc" }, skip: offset, take: limit,
    });
    return rows.map((r: any) => ({
      id: r.id, type: r.type, question: r.question, cards: r.cards,
      interpretation: r.interpretation, cost: r.cost, createdAt: r.createdAt,
    }));
  }
  async countByUser(userId: string): Promise<number> {
    return prisma.reading.count({ where: { userId } });
  }
  async countAll(): Promise<number> {
    return prisma.reading.count();
  }
  async countByType(type: string): Promise<number> {
    return prisma.reading.count({ where: { type } });
  }
}

// ---- AuditLogRepository ----

export class PrismaAuditLogRepository implements AuditLogRepository {
  async record(actorId: string | null, action: string, targetUserId: string | null, details: string | null): Promise<void> {
    await prisma.auditLog.create({
      data: { actorId, action, targetUserId, details: details ? details.slice(0, 1000) : null },
    });
  }
}

// ---- BroadcastRepository ----

export class PrismaBroadcastRepository implements BroadcastRepository {
  async create(adminId: string, text: string, total: number): Promise<{ id: string }> {
    const b = await prisma.broadcast.create({
      data: { adminId, text: text.slice(0, 4000), total, status: "sending" },
    });
    return { id: b.id };
  }
  async markSent(id: string, sent: number, failed: number): Promise<void> {
    await prisma.broadcast.update({
      where: { id }, data: { sentCount: sent, failedCount: failed, status: "done" },
    });
  }
  async setStatus(id: string, status: string): Promise<void> {
    await prisma.broadcast.update({ where: { id }, data: { status } });
  }
}
