// infrastructure/scheduler.ts — in-process cron-like scheduler.
// Per Skill §4: cron jobs for daily card, mood check-in, birthday, streak reset.
// Sandbox has no cron daemon; the long-polling bot process is always-on.

import type { Bot } from "grammy";
import type { UserRepository, BroadcastRepository, AuditLogRepository } from "../application/ports.js";
import { prisma } from "./prisma.js";
import { logger } from "./logger.js";
import { DAILY_PUSH_TEXT } from "../domain/prompts.js";

export class CronScheduler {
  private timers: NodeJS.Timeout[] = [];
  private running = false;

  constructor(
    private bot: Bot,
    private userRepo: UserRepository,
    private broadcastRepo: BroadcastRepository,
    private auditRepo: AuditLogRepository,
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

    setTimeout(() => { void this.birthdayGreeting(); }, 10_000);

    logger.info("cron scheduler started (heartbeat, broadcasts, daily card, birthday, mood check-in)");
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
          await this.bot.api.sendMessage(u.telegramId, DAILY_PUSH_TEXT);
          // Mark lastSeenAt so we don't spam repeatedly.
          await this.userRepo.update(u.telegramId, { lastSeenAt: new Date() });
        } catch (e: any) {
          if (e?.error_code === 403) {
            // User blocked the bot — mark blocked so we skip them.
            await this.userRepo.update(u.telegramId, { isBlocked: true });
          }
          // Other errors: log and continue.
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
            `🌙 Сегодня особенный день — твой день рождения. Я зажгла бы для тебя свечу. Пусть этот год будет добрым к тебе, ${u.name ?? "мирной души"}. 🌟`,
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
      // listInactiveSince returns users with lastSeenAt < since; we further filter > 3 days.
      const users = await this.userRepo.listInactiveSince(since, 30);
      let sent = 0;
      for (const u of users) {
        if (u.isBlocked || !u.onboardingCompleted) continue;
        if (!u.lastSeenAt || u.lastSeenAt > cutoff) continue; // active within 3 days
        try {
          const topic = u.lastTopicSummary ? `Помнишь, ты рассказывал про ${u.lastTopicSummary}?` : "";
          await this.bot.api.sendMessage(
            u.telegramId,
            `🌙 Давно не виделись. ${topic} Я тут подумала о тебе — загляни, если будет минутка.`,
          );
          sent++;
          await this.userRepo.update(u.telegramId, { lastSeenAt: new Date() });
        } catch {
          // ignore
        }
        if (sent >= 10) break; // cap per run
      }
      if (sent > 0) logger.info({ sent }, "mood check-ins sent");
    } catch (e) {
      logger.error({ err: e }, "mood check-in failed");
    }
  }
}
