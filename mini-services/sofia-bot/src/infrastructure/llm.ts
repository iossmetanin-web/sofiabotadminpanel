// infrastructure/llm.ts — z-ai-web-dev-sdk adapter implementing LLMProvider.
// Per Skill §7: provider protocol; errors mapped to domain hierarchy; timeout.
// Per project rules: z-ai-web-dev-sdk MUST be backend only.

import ZAI from "z-ai-web-dev-sdk";
import type { LLMProvider, LLMMessage, LLMResponse } from "../application/ports.js";
import {
  LLMError, LLMTimeoutError, LLMEmptyResponseError, LLMContentFilterError,
} from "../domain/exceptions.js";
import { logger } from "./logger.js";

let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null;

async function getClient() {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create();
    logger.info("z-ai LLM provider initialized");
  }
  return zaiInstance;
}

export class ZaiLLMProvider implements LLMProvider {
  readonly providerName = "zai";

  async generate(messages: LLMMessage[], opts: { timeoutMs?: number; maxTokens?: number } = {}): Promise<LLMResponse> {
    const timeoutMs = opts.timeoutMs ?? 15000;
    const client = await getClient();

    // z-ai SDK uses 'assistant' role for system prompts (per skill docs).
    const sdkMessages = messages.map((m) => ({
      role: m.role,
      content: m.content,
    })) as Array<{ role: "assistant" | "user"; content: string }>;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const completion = await client.chat.completions.create({
        messages: sdkMessages,
        thinking: { type: "disabled" },
      } as any);
      clearTimeout(timer);

      const content = completion.choices?.[0]?.message?.content;
      if (!content || content.trim().length === 0) {
        throw new LLMEmptyResponseError();
      }
      const tokensUsed = completion.usage?.total_tokens ?? Math.ceil(content.length / 4);
      return { content, tokensUsed };
    } catch (e: any) {
      clearTimeout(timer);
      if (e instanceof LLMError) throw e;
      if (e?.name === "AbortError") {
        throw new LLMTimeoutError(timeoutMs / 1000);
      }
      const msg = String(e?.message ?? e);
      if (/rate.?limit|429|quota/i.test(msg)) {
        throw new LLMError(`LLM rate limited: ${msg}`, "zai");
      }
      if (/content.?filter|safety|policy/i.test(msg)) {
        throw new LLMContentFilterError();
      }
      logger.error({ err: e, msg }, "LLM call failed");
      throw new LLMError(`LLM call failed: ${msg}`, "zai");
    }
  }
}

// Helper for simple one-shot generation.
export async function llmGenerate(messages: LLMMessage[], opts?: { timeoutMs?: number; maxTokens?: number }): Promise<string> {
  const provider = new ZaiLLMProvider();
  const res = await provider.generate(messages, opts);
  return res.content;
}
