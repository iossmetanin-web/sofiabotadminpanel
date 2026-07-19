// index.ts — composition root. Wires all dependencies, starts long polling + scheduler + internal HTTP.

import { Bot } from "grammy";
import http from "node:http";
import { env } from "./config/env.js";
import { initDb, disconnectDb } from "./infrastructure/prisma.js";
import { logger } from "./infrastructure/logger.js";
import { ZaiLLMProvider } from "./infrastructure/llm.js";
import {
  PrismaUserRepository, PrismaConversationRepository, PrismaMemoryRepository,
  PrismaTransactionRepository, PrismaReadingRepository, PrismaAuditLogRepository,
  PrismaBroadcastRepository,
} from "./infrastructure/repositories.js";
import { ContextManager, MemoryService, BillingService } from "./application/services.js";
import { CronScheduler } from "./infrastructure/scheduler.js";
import { buildBot } from "./presentation/bot.js";
import { setDeps, type Deps } from "./presentation/deps.js";

async function main(): Promise<void> {
  // Guard against silent exits.
  process.on("unhandledRejection", (reason) => {
    logger.error({ reason }, "unhandledRejection");
  });
  process.on("uncaughtException", (err) => {
    logger.error({ err }, "uncaughtException — continuing");
  });

  logger.info("sofia-bot starting…");

  // 1. Database.
  await initDb();

  // 2. Bot instance.
  const bot = new Bot(env.BOT_TOKEN);

  // 3. Repositories.
  const repos = {
    users: new PrismaUserRepository(),
    conversations: new PrismaConversationRepository(),
    memories: new PrismaMemoryRepository(),
    transactions: new PrismaTransactionRepository(),
    readings: new PrismaReadingRepository(),
    audit: new PrismaAuditLogRepository(),
    broadcasts: new PrismaBroadcastRepository(),
  };

  // 4. LLM provider.
  const llm = new ZaiLLMProvider();

  // 5. Application services.
  const services = {
    context: new ContextManager(repos.conversations, repos.memories),
    memory: new MemoryService(repos.conversations, repos.memories, llm),
    billing: new BillingService(repos.users, repos.transactions),
  };

  // 6. Resolve bot username (for referral links).
  let botUsername = "sofiabot";
  try {
    const me = await bot.api.getMe();
    botUsername = me.username ?? botUsername;
    logger.info({ username: botUsername, id: me.id, name: me.first_name }, "connected to telegram");
  } catch (e) {
    logger.error({ err: e }, "failed to connect to telegram — continuing in degraded mode");
  }

  // 7. Wire deps.
  const deps: Deps = { bot, botUsername, repos, services, llm };
  setDeps(deps);

  // 8. Build bot (registers middleware + handlers).
  await buildBot(deps);

  // 9. Start scheduler.
  const scheduler = new CronScheduler(bot, repos.users, repos.broadcasts, repos.audit);
  scheduler.start();

  // 10. Internal HTTP server (health + admin API hook for the Next.js panel).
  const internalServer = startInternalHttp(deps);

  // 11. Graceful shutdown.
  const shutdown = async (sig: string) => {
    logger.info({ sig }, "shutting down…");
    scheduler.stop();
    internalServer.close?.();
    await bot.stop();
    await disconnectDb();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  // 12. Start long polling. allowed_updates includes callback_query (fixes old bot bug).
  logger.info("starting long polling…");
  bot.start({
    allowed_updates: ["message", "callback_query", "edited_message", "inline_query"],
    drop_pending_updates: false,
  }).catch((e) => {
    logger.error({ err: e }, "bot.start failed");
    process.exit(1);
  });

  logger.info("sofia-bot is running ✅");
}

// Minimal internal HTTP server for /health + /internal/broadcast (called by Next.js admin).
function startInternalHttp(deps: Deps) {
  const server = http.createServer(async (req: any, res: any) => {
    try {
      if (req.method === "GET" && req.url === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, service: "sofia-bot", username: deps.botUsername }));
        return;
      }
      if (req.method === "POST" && req.url?.startsWith("/internal/broadcast")) {
        // Validate secret header.
        const secret = req.headers["x-internal-secret"];
        if (secret !== env.INTERNAL_SECRET) {
          res.writeHead(401);
          res.end("unauthorized");
          return;
        }
        // Read body.
        let body = "";
        for await (const chunk of req) body += chunk;
        const { text } = JSON.parse(body || "{}");
        if (!text) { res.writeHead(400); res.end("text required"); return; }
        const total = await deps.repos.users.countAll();
        const bc = await deps.repos.broadcasts.create("internal", text, total);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, id: bc.id, total }));
        // Fire-and-forget send.
        void (async () => {
          let sent = 0, failed = 0;
          const recipients = await deps.repos.users.listAllForBroadcast(500);
          for (const r of recipients) {
            try { await deps.bot.api.sendMessage(r.telegramId, text); sent++; }
            catch { failed++; }
            await new Promise((rr) => setTimeout(rr, 40));
          }
          await deps.repos.broadcasts.markSent(bc.id, sent, failed);
        })();
        return;
      }
      res.writeHead(404);
      res.end("not found");
    } catch (e: any) {
      logger.error({ err: e }, "internal http error");
      res.writeHead(500);
      res.end("error");
    }
  });
  server.listen(env.INTERNAL_PORT, () => {
    logger.info({ port: env.INTERNAL_PORT }, "internal http server listening");
  });
  return server;
}

main().catch((e) => {
  logger.error({ err: e }, "fatal startup error");
  process.exit(1);
});
