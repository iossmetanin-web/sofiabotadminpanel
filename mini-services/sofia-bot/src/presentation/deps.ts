// presentation/deps.ts — dependency container wired at composition root.
// Handlers import `deps` to access repos/services/llm. Pragmatic DI for a single-process bot.

import type { Bot } from "grammy";
import type {
  UserRepository, ConversationRepository, MemoryRepository,
  TransactionRepository, ReadingRepository, AuditLogRepository, BroadcastRepository,
  LLMProvider,
} from "../application/ports.js";
import type { ContextManager, MemoryService, BillingService } from "../application/services.js";
import type { SofiaState } from "../domain/states.js";

export type Deps = {
  bot: Bot;
  botUsername: string;
  repos: {
    users: UserRepository;
    conversations: ConversationRepository;
    memories: MemoryRepository;
    transactions: TransactionRepository;
    readings: ReadingRepository;
    audit: AuditLogRepository;
    broadcasts: BroadcastRepository;
  };
  services: {
    context: ContextManager;
    memory: MemoryService;
    billing: BillingService;
  };
  llm: LLMProvider;
};

let _deps: Deps | null = null;

export function setDeps(d: Deps): void {
  _deps = d;
}

export function deps(): Deps {
  if (!_deps) throw new Error("Deps not initialized — call setDeps() at composition root");
  return _deps;
}

// ---- grammY context flavor ----
export type BotContext = {
  userDto: import("../application/ports.js").UserDTO | null;
  log: import("pino").Logger;
};

// Helper to set a user's state (DB + note in log).
export async function setState(telegramId: string, state: SofiaState): Promise<void> {
  await deps().repos.users.setState(telegramId, state);
}
