// application/ports.ts — interfaces (ports). Per Skill §3: application defines
// outbound ports; infrastructure implements them. Domain imports nothing from here
// that is framework-coupled.

import type { SofiaState } from "../domain/states.js";

// ---- DTOs ----

export type UserDTO = {
  id: string;
  telegramId: string;
  username: string | null;
  firstName: string | null;
  name: string | null;
  birthDate: string | null; // ISO
  birthTime: string | null;
  birthPlace: string | null;
  gender: string | null;
  ageGroup: string | null;
  zodiacSign: string | null;
  onboardingCompleted: boolean;
  onboardingStep: string;
  crystals: number;
  subscriptionType: string | null;
  subscriptionUntil: Date | null;
  streakDays: number;
  lastActivityDay: Date | null;
  lastSeenAt: Date | null;
  lastDailyCardAt: Date | null;
  lastFreeCardAt: Date | null;
  referredById: string | null;
  referralCode: string;
  referralRewardGiven: boolean;
  rudenessCount: number;
  isBlocked: boolean;
  isAdmin: boolean;
  messageCount: number;
  dailyMessageCount: number;
  dailyMessageDate: Date | null;
  lastTopicSummary: string | null;
  createdAt: Date;
};

export type ConversationMessageDTO = {
  role: "user" | "sofia";
  content: string;
  createdAt: Date;
};

export type MemoryDTO = {
  id: string;
  kind: "fact" | "emotional";
  category: string;
  content: string;
  context: string | null;
  importance: number;
};

export type TransactionDTO = {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  balanceAfter: number | null;
  createdAt: Date;
};

export type ReadingDTO = {
  id: string;
  type: string;
  question: string | null;
  cards: string;
  interpretation: string;
  cost: number;
  createdAt: Date;
};

export type LLMMessage = { role: "assistant" | "user"; content: string };

export type LLMResponse = {
  content: string;
  tokensUsed: number;
};

// ---- Repository ports ----

export interface UserRepository {
  findByTelegramId(telegramId: string): Promise<UserDTO | null>;
  findById(id: string): Promise<UserDTO | null>;
  findByUsername(username: string): Promise<UserDTO | null>;
  findByReferralCode(code: string): Promise<UserDTO | null>;
  create(data: {
    telegramId: string;
    username?: string | null;
    firstName?: string | null;
    referralCode: string;
    referredByReferralCode?: string | null;
    welcomeCrystals: number;
    isAdmin: boolean;
  }): Promise<UserDTO>;
  update(telegramId: string, fields: Partial<Omit<UserDTO, "id" | "telegramId" | "createdAt">>): Promise<UserDTO>;
  setState(telegramId: string, state: SofiaState): Promise<void>;
  delete(telegramId: string): Promise<void>;
  countAll(): Promise<number>;
  countActiveSince(since: Date): Promise<number>;
  countOnboardingCompleted(): Promise<number>;
  listPaginated(offset: number, limit: number): Promise<UserDTO[]>;
  listInactiveSince(since: Date, limit: number): Promise<UserDTO[]>;
  listBirthdaysToday(limit: number): Promise<UserDTO[]>;
  listAllForBroadcast(limit: number): Promise<UserDTO[]>;
}

export interface ConversationRepository {
  save(userId: string, role: "user" | "sofia", content: string, emotionTag?: string | null): Promise<void>;
  recent(userId: string, limit: number): Promise<ConversationMessageDTO[]>;
  countByUser(userId: string): Promise<number>;
  countAll(): Promise<number>;
}

export interface MemoryRepository {
  upsert(userId: string, kind: "fact" | "emotional", category: string, content: string, importance: number): Promise<void>;
  listByUser(userId: string, kind?: "fact" | "emotional", limit?: number): Promise<MemoryDTO[]>;
  listImportant(userId: string, limit: number): Promise<MemoryDTO[]>;
  deleteByUser(userId: string): Promise<void>;
}

export interface TransactionRepository {
  record(userId: string, type: string, amount: number, description: string | null, balanceAfter: number): Promise<void>;
  listByUser(userId: string, limit: number): Promise<TransactionDTO[]>;
  sumCrystalsSpent(): Promise<number>;
  countByType(type: string): Promise<number>;
}

export interface ReadingRepository {
  save(userId: string, type: string, question: string | null, cards: string, interpretation: string, cost: number): Promise<ReadingDTO>;
  listByUser(userId: string, limit: number, offset: number): Promise<ReadingDTO[]>;
  countByUser(userId: string): Promise<number>;
  countAll(): Promise<number>;
  countByType(type: string): Promise<number>;
}

export interface AuditLogRepository {
  record(actorId: string | null, action: string, targetUserId: string | null, details: string | null): Promise<void>;
}

export interface BroadcastRepository {
  create(adminId: string, text: string, total: number): Promise<{ id: string }>;
  markSent(id: string, sent: number, failed: number): Promise<void>;
  setStatus(id: string, status: string): Promise<void>;
}

// ---- LLM provider port ----

export interface LLMProvider {
  readonly providerName: string;
  generate(messages: LLMMessage[], opts?: { timeoutMs?: number; maxTokens?: number }): Promise<LLMResponse>;
}

// ---- Event publisher port (lightweight) ----

export type DomainEvent = { type: string; payload: Record<string, unknown> };
export interface EventPublisher {
  publish(event: DomainEvent): Promise<void>;
}
