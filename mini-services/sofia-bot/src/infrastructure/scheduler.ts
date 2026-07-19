// infrastructure/scheduler.ts — in-process cron-like scheduler.
// Per Skill §4: cron jobs for daily card, mood check-in, birthday, streak reset, weekly digest.
// Sandbox has no cron daemon; the long-polling bot process is always-on.

import type { Bot } from "grammy";
import type { UserRepository, BroadcastRepository, AuditLogRepository } from "../application/ports.js";
import { prisma } from "./prisma.js";
import { logger } from "./logger.js";
import { DAILY_PUSH_TEXT, WEEKLY_DIGEST_PROMPT_RU } from "../domain/prompts.js";
import { t, type Locale } from "../domain/i18n.js";

export class CronScheduler {
  private timers: NodeJS.Timeout[] = [];
  private running = false;

  constructor(
    private bot: Bot,
    private userRepo: UserRepository,
    private broadcastRepo: BroadcastRepository,
    private auditRepo: AuditLogRepository,
    private llm?: { generate: (m: { role: "assistant" | "user"; content: string }[], opts?: { timeoutMs?: number; maxTokens?: number }) => Promise<{ content: string }> },
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;

    // Heartbeat every 20s — admin panel reads this to know the bot is alive.
    this.timers.push(setInterval(() => void this.writeHeartbeat(), 20_000));
    void this.writeHeartbeat();

    // Pending broadcast poller every 8s (outbox pattern — admin writes rows, bot sends them).
    this.timers.push(setInterval(() => void this.processPendingBroadcasts(), 8_000));

    // Daily card nudge every 30 min.
    this.timers.push(setInterval(() => void this.dailyCardNudge(), 30 * 60 * 1000));

    // Birthday greeting every 6 hours.
    this.timers.push(setInterval(() => void this.birthdayGreeting(), 6 * 60 * 60 * 1000));

    // Mood check-in every 2 hours.
    this.timers.push(setInterval(() => void this.moodCheckin(), 2 * 60 * 60 * 1000));

    // Weekly digest — every 6h we check if today is Sunday and we haven't sent yet this week.
    this.timers.push(setInterval(() => void this.weeklyDigest(), 6 * 60 * 60 * 1000));

    setTimeout(() => { void this.birthdayGreeting(); }, 10_000);
    setTimeout(() => { void this.weeklyDigest(); }, 30_000);

    logger.info("cron scheduler started (heartbeat, broadcasts, daily card, birthday, mood check-in, weekly digest)");
  }

  stop(): void {
    for (const t of this.timers) clearInterval(t);
    this.timers = [];
    this.running = false;
  }

  private async writeHeartbeat(): Promise<void> {
    try {
      await prisma.botConfig.upsert({
        where: { id: "heartbeat" },
        create: { id: "heartbeat", key: "bot:heartbeat", value: new Date().toISOString() },
        update: { key: "bot:heartbeat", value: new Date().toISOString() },
      });
    } catch (e) {
      logger.error({ err: e }, "heartbeat write failed");
    }
  }

  private async processPendingBroadcasts(): Promise<void> {
    try {
      const pending = await prisma.broadcast.findMany({
        where: { status: "pending" },
        take: 1,
        orderBy: { createdAt: "asc" },
      });
      if (pending.length === 0) return;
      const bc = pending[0];
      await prisma.broadcast.update({ where: { id: bc.id }, data: { status: "sending" } });
      logger.info({ id: bc.id }, "processing broadcast");
      let sent = 0, failed = 0;
      const recipients = await this.userRepo.listAllForBroadcast(1000);
      for (const r of recipients) {
        try { await this.bot.api.sendMessage(r.telegramId, bc.text); sent++; }
        catch (e: any) {
          if (e?.error_code === 403) {
            await this.userRepo.update(r.telegramId, { isBlocked: true });
          }
          failed++;
        }
        await new Promise((res) => setTimeout(res, 35));
      }
      await this.broadcastRepo.markSent(bc.id, sent, failed);
      // Only record audit if adminId is a real user id (not 'web-admin' from the panel).
      const isRealUserId = bc.adminId && bc.adminId !== "web-admin" && /^[a-z0-9]{20,}$/i.test(bc.adminId);
      await this.auditRepo.record(isRealUserId ? bc.adminId : null, "broadcast", null, `sent=${sent} failed=${failed}`);
      logger.info({ id: bc.id, sent, failed }, "broadcast complete");
    } catch (e) {
      logger.error({ err: e }, "broadcast processing failed");
    }
  }

  private async dailyCardNudge(): Promise<void> {
    try {
      const cutoff = new Date(Date.now() - 20 * 60 * 60 * 1000);
      const users = await this.userRepo.listInactiveSince(cutoff, 20);
      for (const u of users) {
        if (u.isBlocked || !u.onboardingCompleted) continue;
        try {
          await this.bot.api.sendMessage(u.telegramId, t(u.language, "daily_push"));
          await this.userRepo.update(u.telegramId, { lastSeenAt: new Date() });
        } catch (e: any) {
          if (e?.error_code === 403) {
            await this.userRepo.update(u.telegramId, { isBlocked: true });
          }
        }
      }
    } catch (e) {
      logger.error({ err: e }, "daily card nudge failed");
    }
  }

  private async birthdayGreeting(): Promise<void> {
    try {
      const users = await this.userRepo.listBirthdaysToday(20);
      for (const u of users) {
        if (u.isBlocked) continue;
        try {
          await this.bot.api.sendMessage(
            u.telegramId,
            t(u.language, "birthday_greeting", { name: u.name ?? (u.language === "en" ? "dear soul" : "мирной души") }),
          );
        } catch {
          // ignore per-user errors
        }
      }
      if (users.length > 0) logger.info({ count: users.length }, "birthday greetings sent");
    } catch (e) {
      logger.error({ err: e }, "birthday greeting failed");
    }
  }

  private async moodCheckin(): Promise<void> {
    try {
      const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      const users = await this.userRepo.listInactiveSince(since, 30);
      let sent = 0;
      for (const u of users) {
        if (u.isBlocked || !u.onboardingCompleted) continue;
        if (!u.lastSeenAt || u.lastSeenAt > cutoff) continue;
        try {
          const topic = u.lastTopicSummary
            ? (u.language === "en" ? `Remember when you told me about ${u.lastTopicSummary}? ` : `Помнишь, ты рассказывал про ${u.lastTopicSummary}? `)
            : "";
          await this.bot.api.sendMessage(
            u.telegramId,
            t(u.language, "mood_checkin", { topic }),
          );
          sent++;
          await this.userRepo.update(u.telegramId, { lastSeenAt: new Date() });
        } catch {
          // ignore
        }
        if (sent >= 10) break;
      }
      if (sent > 0) logger.info({ sent }, "mood check-ins sent");
    } catch (e) {
      logger.error({ err: e }, "mood check-in failed");
    }
  }

  // Weekly digest — sent to admins on Sundays at ~18:00 local. Uses BotConfig as a
  // last-sent marker to avoid duplicate sends. Generates a soft Sofia summary via LLM.
  private async weeklyDigest(): Promise<void> {
    try {
      const now = new Date();
      // Sunday = 0. Send only on Sunday between 17:00 and 23:00.
      if (now.getDay() !== 0 || now.getHours() < 17 || now.getHours() > 22) return;

      // Check last-sent marker.
      const marker = await prisma.botConfig.findUnique({ where: { id: "weekly_digest" } });
      const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      if (marker && new Date(marker.value) > weekStart) return; // already sent this week

      // Compute weekly stats.
      const [newUsers, active7d, messages, readings, crystalsSpentAgg, topUsersRaw] = await Promise.all([
        prisma.user.count({ where: { createdAt: { gte: weekStart } } }),
        prisma.user.count({ where: { lastSeenAt: { gte: weekStart } } }),
        prisma.conversation.count({ where: { createdAt: { gte: weekStart } } }),
        prisma.reading.count({ where: { createdAt: { gte: weekStart } } }),
        prisma.transaction.aggregate({ where: { type: "spend", createdAt: { gte: weekStart } }, _sum: { amount: true } }),
        prisma.user.findMany({
          where: { lastSeenAt: { gte: weekStart } },
          orderBy: { messageCount: "desc" },
          take: 3,
        }),
      ]);
      const crystalsSpent = crystalsSpentAgg._sum.amount ?? 0;
      const top3 = topUsersRaw.map((u) => ({
        name: u.name ?? u.firstName ?? "—",
        messages: u.messageCount,
        readings: 0,
      }));

      // Fetch admin users.
      const admins = await prisma.user.findMany({ where: { isAdmin: true } });
      if (admins.length === 0) {
        await prisma.botConfig.upsert({
          where: { id: "weekly_digest" },
          create: { id: "weekly_digest", key: "weekly_digest:last_sent", value: now.toISOString() },
          update: { value: now.toISOString() },
        });
        return;
      }

      // Build a Sofia-flavoured summary via LLM if available, otherwise use the deterministic body.
      let sofiaSummary = "";
      if (this.llm) {
        try {
          const prompt = WEEKLY_DIGEST_PROMPT_RU
            .replace("{newUsers}", String(newUsers))
            .replace("{active7d}", String(active7d))
            .replace("{messages}", String(messages))
            .replace("{readings}", String(readings))
            .replace("{crystals}", String(crystalsSpent))
            .replace("{top3}", top3.map((u, i) => `${i + 1}. ${u.name} (${u.messages} сообщ.)`).join(", ") || "—");
          const r = await this.llm.generate([{ role: "user", content: prompt }], { timeoutMs: 10000, maxTokens: 300 });
          sofiaSummary = r.content?.trim() ?? "";
        } catch (e) {
          logger.warn({ err: e }, "weekly digest LLM call failed — using template");
        }
      }

      // Compose message: stats table + optional Sofia summary.
      const statsBlock = `📊 <b>Сводка за неделю</b>\n\n` +
        `Новых пользователей: <b>${newUsers}</b>\n` +
        `Активных за неделю: <b>${active7d}</b>\n` +
        `Сообщений: <b>${messages}</b>\n` +
        `Раскладов: <b>${readings}</b>\n` +
        `💎 Потрачено кристаллов: <b>${crystalsSpent}</b>\n\n` +
        `Топ-3 активных:\n` +
        (top3.length > 0 ? top3.map((u, i) => `${i + 1}. ${escapeHtml(u.name)} — ${u.messages} сообщ.`).join("\n") : "—");

      const fullText = sofiaSummary
        ? `🌙 <b>Недельный дайджест Софии</b>\n\n${sofiaSummary}\n\n${statsBlock}`
        : `🌙 <b>Недельный дайджест Софии</b>\n\n${statsBlock}`;

      let sent = 0;
      for (const a of admins) {
        try { await this.bot.api.sendMessage(a.telegramId, fullText, { parse_mode: "HTML" }); sent++; }
        catch (e: any) { logger.warn({ err: e, adminId: a.id }, "weekly digest send to admin failed"); }
      }

      // Mark sent.
      await prisma.botConfig.upsert({
        where: { id: "weekly_digest" },
        create: { id: "weekly_digest", key: "weekly_digest:last_sent", value: now.toISOString() },
        update: { value: now.toISOString() },
      });
      logger.info({ sent, newUsers, active7d, messages, readings }, "weekly digest sent to admins");
    } catch (e) {
      logger.error({ err: e }, "weekly digest failed");
    }
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

