// application/services.ts — application services (orchestration, no business rules
// that belong in entities). Per Skill §3.

import type {
  ConversationRepository, MemoryRepository, LLMProvider, LLMMessage,
  MemoryDTO, ConversationMessageDTO,
} from "./ports.js";
import { MEMORY_EXTRACT_PROMPT } from "../domain/prompts.js";
import { LLMError, LLMEmptyResponseError } from "../domain/exceptions.js";

// Assembles the LLM context for Sofia: system prompt + memory + recent history + current msg.
export class ContextManager {
  constructor(
    private convos: ConversationRepository,
    private memories: MemoryRepository,
  ) {}

  async buildMessages(params: {
    systemPrompt: string;
    userTelegramId: string;
    userName: string | null;
    userZodiac: string | null;
    userAgeGroup: string | null;
    currentUserMessage: string;
    historyLimit?: number;
  }): Promise<LLMMessage[]> {
    const [recent, facts, emotional] = await Promise.all([
      this.convos.recent(params.userTelegramId, params.historyLimit ?? 10),
      this.memories.listByUser(params.userTelegramId, "fact", 8),
      this.memories.listByUser(params.userTelegramId, "emotional", 5),
    ]);

    // Build a compact context preamble that Sofia weaves into her voice.
    const contextParts: string[] = [];
    if (params.userName) contextParts.push(`Имя: ${params.userName}`);
    if (params.userZodiac) contextParts.push(`Знак: ${params.userZodiac}`);
    if (params.userAgeGroup) contextParts.push(`Возрастная группа: ${params.userAgeGroup}`);
    if (facts.length > 0) {
      contextParts.push("Что ты помнишь о нём:\n" + facts
        .map((f) => `- ${f.category}: ${f.content}`).join("\n"));
    }
    if (emotional.length > 0) {
      contextParts.push("Эмоционально значимое:\n" + emotional
        .map((e) => `- ${e.category}: ${e.content}`).join("\n"));
    }
    const contextBlock = contextParts.length > 0
      ? "\n\nКОНТЕКСТ ПОЛЬЗОВАТЕЛЯ\n" + contextParts.join("\n") + "\n"
      : "";

    const messages: LLMMessage[] = [
      { role: "assistant", content: params.systemPrompt + contextBlock },
    ];
    for (const m of recent) {
      messages.push({ role: m.role === "user" ? "user" : "assistant", content: m.content });
    }
    messages.push({ role: "user", content: params.currentUserMessage });
    return messages;
  }
}

// Extracts facts + emotional memory from recent conversation. Runs synchronously
// after the reply is sent (long-polling process stays alive — unlike old Vercel bot).
export class MemoryService {
  constructor(
    private convos: ConversationRepository,
    private memories: MemoryRepository,
    private llm: LLMProvider,
  ) {}

  async extractAndSave(userTelegramId: string): Promise<void> {
    const recent = await this.convos.recent(userTelegramId, 8);
    if (recent.length < 4) return; // not enough to extract

    const transcript = recent
      .map((m) => `${m.role === "user" ? "Пользователь" : "София"}: ${m.content}`)
      .join("\n");

    const messages: LLMMessage[] = [
      { role: "assistant", content: MEMORY_EXTRACT_PROMPT },
      { role: "user", content: transcript },
    ];

    let raw: string;
    try {
      const res = await this.llm.generate(messages, { timeoutMs: 8000, maxTokens: 800 });
      raw = res.content;
    } catch (e) {
      // Non-fatal — memory extraction is best-effort.
      if (e instanceof LLMError) return;
      throw e;
    }

    const parsed = this.parseExtraction(raw);
    if (!parsed) return;

    for (const f of parsed.facts) {
      await this.memories.upsert(userTelegramId, "fact", f.category, f.content, f.importance);
    }
    for (const e of parsed.emotional) {
      await this.memories.upsert(userTelegramId, "emotional", e.category, e.content, e.importance);
    }
  }

  private parseExtraction(raw: string): {
    facts: { category: string; content: string; importance: number }[];
    emotional: { category: string; content: string; importance: number }[];
    topic_summary: string;
  } | null {
    try {
      // Strip markdown fences if present.
      const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
      // Find the first { ... } block.
      const start = cleaned.indexOf("{");
      const end = cleaned.lastIndexOf("}");
      if (start === -1 || end === -1) return null;
      const json = cleaned.slice(start, end + 1);
      const obj = JSON.parse(json);
      const validFactCat = new Set(["pain","relationship","work","family","goal","fear","promise","personality","health"]);
      const validEmoCat = new Set(["main_pain","loved_one","promise","unfinished_question","life_event","fear","goal","breakthrough"]);
      const facts = Array.isArray(obj.facts) ? obj.facts.filter((f: any) =>
        f && validFactCat.has(f.category) && typeof f.content === "string" && f.content.trim()) : [];
      const emotional = Array.isArray(obj.emotional) ? obj.emotional.filter((e: any) =>
        e && validEmoCat.has(e.category) && typeof e.content === "string" && e.content.trim()) : [];
      return {
        facts: facts.map((f: any) => ({
          category: f.category, content: String(f.content).slice(0, 500),
          importance: Math.max(1, Math.min(5, Number(f.importance) || 3)),
        })),
        emotional: emotional.map((e: any) => ({
          category: e.category, content: String(e.content).slice(0, 500),
          importance: Math.max(1, Math.min(5, Number(e.importance) || 3)),
        })),
        topic_summary: typeof obj.topic_summary === "string" ? obj.topic_summary.slice(0, 200) : "",
      };
    } catch {
      return null;
    }
  }
}

// Billing: atomic crystal spend via Prisma transaction. Refund on failure.
export class BillingService {
  constructor(
    private userRepo: import("./ports.js").UserRepository,
    private txnRepo: import("./ports.js").TransactionRepository,
  ) {}

  async spend(userTelegramId: string, amount: number, description: string): Promise<number> {
    if (amount <= 0) return 0;
    const user = await this.userRepo.findByTelegramId(userTelegramId);
    if (!user) throw new Error(`User not found: ${userTelegramId}`);
    if (user.crystals < amount) {
      const { InsufficientCrystalsError } = await import("../domain/exceptions.js");
      throw new InsufficientCrystalsError(amount, user.crystals);
    }
    const newBalance = user.crystals - amount;
    await this.userRepo.update(userTelegramId, { crystals: newBalance });
    await this.txnRepo.record(user.id, "spend", amount, description, newBalance);
    return newBalance;
  }

  async refund(userTelegramId: string, amount: number, description: string): Promise<number> {
    const user = await this.userRepo.findByTelegramId(userTelegramId);
    if (!user) throw new Error(`User not found: ${userTelegramId}`);
    const newBalance = user.crystals + amount;
    await this.userRepo.update(userTelegramId, { crystals: newBalance });
    await this.txnRepo.record(user.id, "add", amount, `Возврат: ${description}`, newBalance);
    return newBalance;
  }

  async add(userTelegramId: string, amount: number, description: string, type: string = "add"): Promise<number> {
    const user = await this.userRepo.findByTelegramId(userTelegramId);
    if (!user) throw new Error(`User not found: ${userTelegramId}`);
    const newBalance = user.crystals + amount;
    await this.userRepo.update(userTelegramId, { crystals: newBalance });
    await this.txnRepo.record(user.id, type, amount, description, newBalance);
    return newBalance;
  }
}
