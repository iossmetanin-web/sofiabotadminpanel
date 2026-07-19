// presentation/callbacks.ts — inline button router.
// Callback data convention: "namespace:action[:payload]". Always answerCallbackQuery first.

import type { Context } from "grammy";
import { InlineKeyboard } from "grammy";
import { deps } from "./deps.js";
import { isAdmin } from "../config/env.js";
import {
  mainMenuKeyboard, readingMenuKeyboard, buyMenuKeyboard, backHomeKeyboard,
  adminPanelKeyboard, deleteConfirmKeyboard, historyPaginationKeyboard,
  referralKeyboard, usersPaginationKeyboard,
} from "./keyboards.js";
import { formatProfile, formatBalance, formatReadingHistoryItem, escapeHtml } from "./formatters.js";
import { editTo } from "./commands.js";
import { startReadingFlow } from "./conversation.js";

const HTML = { parse_mode: "HTML" as const };

export async function handleCallback(ctx: Context): Promise<void> {
  if (!ctx.callbackQuery || !ctx.from) return;
  const data = ctx.callbackQuery.data ?? "";
  const d = deps();
  const tgId = ctx.from.id.toString();
  const user = (ctx as any).userDto ?? await d.repos.users.findByTelegramId(tgId);

  // Always answer the callback first (dismiss spinner).
  await ctx.answerCallbackQuery().catch(() => {});

  if (!user) {
    await ctx.reply("Похоже, я тебя не помню. Нажми /start.");
    return;
  }

  const parts = data.split(":");
  const ns = parts[0];
  const action = parts[1] ?? "";
  const payload = parts[2] ?? "";
  const log = (ctx as any).log;

  try {
    if (ns === "nav") return handleNav(ctx, user, action, payload);
    if (ns === "rd") return handleReading(ctx, user, action, payload);
    if (ns === "buy") return handleBuy(ctx, user, action);
    if (ns === "admin") return handleAdmin(ctx, user, action, payload);
    if (ns === "share") return handleShare(ctx, user, action);
    log?.warn?.({ data }, "unknown callback namespace");
  } catch (e) {
    log?.error?.({ err: e, data }, "callback handler failed");
    await ctx.reply("Что-то сбилось. Попробуй /menu.");
  }
}

async function handleNav(ctx: Context, user: any, action: string, payload: string): Promise<void> {
  const d = deps();
  switch (action) {
    case "menu": {
      await d.repos.users.setState(user.telegramId, "CONVERSATION");
      await editTo(ctx, "Вот моё меню. Выбирай, что откликнется:", mainMenuKeyboard(user));
      return;
    }
    case "back": {
      await d.repos.users.setState(user.telegramId, "CONVERSATION");
      await editTo(ctx, "О чём поговорим?", mainMenuKeyboard(user));
      return;
    }
    case "later": {
      await d.repos.users.setState(user.telegramId, "CONVERSATION");
      await editTo(ctx, "Хорошо, я подожду. 🌙", mainMenuKeyboard(user));
      return;
    }
    case "profile": {
      await editTo(ctx, formatProfile(user), new InlineKeyboard()
        .text("🗑 Удалить мои данные", "nav:delete").row().text("🏠 Меню", "nav:menu"));
      return;
    }
    case "balance": {
      await editTo(ctx, formatBalance(user), buyMenuKeyboard());
      return;
    }
    case "history": {
      const page = parseInt(payload || "1", 10) || 1;
      await showHistoryEdit(ctx, user, page);
      return;
    }
    case "settings": {
      await editTo(ctx, "⚙️ <b>Настройки</b>\n\n[🔔 Ежедневная карта: ✅ Вкл]\n[🌍 Язык: 🇷🇺 Русский]\n\n(Полные настройки скоро)",
        backHomeKeyboard());
      return;
    }
    case "help": {
      await editTo(ctx, "<b>Помощь</b>\n\nПросто поговори со мной, или выбери расклад из меню. /cancel — отменить. /start — начать заново.", backHomeKeyboard());
      return;
    }
    case "referral": {
      const kb = referralKeyboard(user.referralCode, d.botUsername);
      const link = `https://t.me/${d.botUsername}?start=ref_${user.referralCode}`;
      await editTo(ctx, `🎁 <b>Пригласи друга</b>\n\nЗа каждого друга, который завершит знакомство со мной, ты получишь +1 💎.\n\nТвоя ссылка:\n<code>${link}</code>`, kb);
      return;
    }
    case "delete": {
      await d.repos.users.setState(user.telegramId, "AWAIT_DELETE_CONFIRM");
      await editTo(ctx,
        "⚠️ <b>Удалить все данные?</b>\n\nЭто удалит твои расклады, мою память о тебе, кристаллы. Я забуду тебя. Действие необратимо.",
        deleteConfirmKeyboard());
      return;
    }
    case "cancel_delete": {
      await d.repos.users.setState(user.telegramId, "CONVERSATION");
      await editTo(ctx, "Хорошо, я останусь. 🌙", mainMenuKeyboard(user));
      return;
    }
    case "confirm_delete": {
      await d.repos.users.delete(user.telegramId);
      await d.repos.audit.record(user.telegramId, "delete_own_data", user.telegramId, null);
      await ctx.reply("Я забуду тебя, как ты просил. Будь счастлив. 🌙");
      return;
    }
    case "none": return; // static label button
  }
}

async function handleReading(ctx: Context, user: any, action: string, payload: string): Promise<void> {
  if (action === "menu") {
    await editTo(ctx, "📜 Выбери расклад:", readingMenuKeyboard());
    return;
  }
  if (action === "pick") {
    await startReadingFlow(ctx, user, payload);
    return;
  }
  if (action === "cardday" || action === "freecard") {
    await startReadingFlow(ctx, user, action === "cardday" ? "card_of_day" : "single_card");
    return;
  }
}

async function handleBuy(ctx: Context, user: any, action: string): Promise<void> {
  const d = deps();
  if (action === "msg5") {
    if (user.crystals >= 1) {
      await d.services.billing.spend(user.telegramId, 1, "Пакет +5 сообщений");
      await d.repos.users.update(user.telegramId, { dailyMessageCount: Math.max(0, user.dailyMessageCount - 5) });
      await ctx.reply("Готово. Пять сообщений добавлено. Продолжим? 🌙", { ...HTML, reply_markup: mainMenuKeyboard(user) });
    } else {
      await ctx.reply("Не хватает 1 💎. Загляни в баланс.", { ...HTML, reply_markup: buyMenuKeyboard() });
    }
    return;
  }
  await ctx.reply("Скоро 🌙. Платежи подключим чуть позже — а пока кристаллы можно получить за приглашение друзей (🎁 в меню).", { ...HTML, reply_markup: buyMenuKeyboard() });
}

async function handleAdmin(ctx: Context, user: any, action: string, payload: string): Promise<void> {
  const d = deps();
  if (!isAdmin(user.telegramId)) {
    await ctx.reply("Это только для хранительницы. 🌙");
    return;
  }
  switch (action) {
    case "panel": {
      await d.repos.users.setState(user.telegramId, "ADMIN_PANEL");
      await editTo(ctx, "🛠 <b>Админ-панель</b>", adminPanelKeyboard());
      return;
    }
    case "stats": {
      const [totalUsers, active24h, onboarded, totalMsgs, totalReadings, crystalsSpent] = await Promise.all([
        d.repos.users.countAll(),
        d.repos.users.countActiveSince(new Date(Date.now() - 86400_000)),
        d.repos.users.countOnboardingCompleted(),
        d.repos.conversations.countAll(),
        d.repos.readings.countAll(),
        d.repos.transactions.sumCrystalsSpent(),
      ]);
      await editTo(ctx,
        `📊 <b>Статистика</b>\n\n` +
        `Пользователей: <b>${totalUsers}</b>\n` +
        `Активны за 24ч: <b>${active24h}</b>\n` +
        `Завершили онбординг: <b>${onboarded}</b>\n` +
        `Сообщений всего: <b>${totalMsgs}</b>\n` +
        `Раскладов всего: <b>${totalReadings}</b>\n` +
        `💎 Кристаллов потрачено: <b>${crystalsSpent}</b>`,
        new InlineKeyboard().text("🛠 Админ", "admin:panel").row().text("🏠 Меню", "nav:menu"));
      return;
    }
    case "users": {
      const page = parseInt(payload || "1", 10) || 1;
      const limit = 10;
      const total = await d.repos.users.countAll();
      const totalPages = Math.max(1, Math.ceil(total / limit));
      const users = await d.repos.users.listPaginated((page - 1) * limit, limit);
      const text = `<b>👥 Пользователи (${page}/${totalPages})</b>\n\n` +
        users.map((u: any) => `• ${escapeHtml(u.name ?? u.firstName ?? "—")} @${escapeHtml(u.username ?? "—")} · 💎${u.crystals} · ${u.onboardingStep}`).join("\n");
      await editTo(ctx, text, usersPaginationKeyboard(page, totalPages));
      return;
    }
    case "add": {
      await d.repos.users.setState(user.telegramId, "ADMIN_PANEL");
      await ctx.reply("💸 Чтобы начислить кристаллы, отправь:\n\n<code>/add @username 5</code>\n\n(где 5 — количество)", HTML);
      return;
    }
    case "broadcast": {
      await d.repos.users.setState(user.telegramId, "BROADCAST");
      await editTo(ctx, "📢 <b>Рассылка</b>\n\nВведи текст рассылки (следующим сообщением):",
        new InlineKeyboard().text("❌ Отмена", "admin:broadcast_cancel"));
      return;
    }
    case "broadcast_confirm": {
      const cb = ctx.callbackQuery;
      const msg = cb && "message" in cb ? (cb as any).message : null;
      const previewText = msg && "text" in msg ? (msg as any).text : "";
      const m = previewText.match(/Превью рассылки:\n\n([\s\S]*?)\n\nПолучат:/);
      const text = m ? m[1] : "";
      if (!text) { await ctx.reply("Не нашла текст. Начни заново."); return; }
      const total = await d.repos.users.countAll();
      const bc = await d.repos.broadcasts.create(user.telegramId, text, total);
      await editTo(ctx, `📤 Рассылка запущена (id: ${bc.id}). Отправляю…`, adminPanelKeyboard());
      void (async () => {
        let sent = 0, failed = 0;
        const recipients = await d.repos.users.listAllForBroadcast(500);
        for (const r of recipients) {
          try { await d.bot.api.sendMessage(r.telegramId, text); sent++; }
          catch { failed++; }
          await new Promise((res) => setTimeout(res, 40));
        }
        await d.repos.broadcasts.markSent(bc.id, sent, failed);
        await d.repos.audit.record(user.telegramId, "broadcast", null, `sent=${sent} failed=${failed}`);
      })();
      return;
    }
    case "broadcast_cancel": {
      await d.repos.users.setState(user.telegramId, "ADMIN_PANEL");
      await editTo(ctx, "🛠 <b>Админ-панель</b>", adminPanelKeyboard());
      return;
    }
  }
}

async function handleShare(ctx: Context, user: any, code: string): Promise<void> {
  const d = deps();
  const link = `https://t.me/${d.botUsername}?start=ref_${code}`;
  await editTo(ctx, `🎁 <b>Твоя ссылка для приглашения</b>\n\n<code>${link}</code>\n\nПоделись ею с друзьями.`, referralKeyboard(code, d.botUsername));
}

async function showHistoryEdit(ctx: Context, user: any, page: number): Promise<void> {
  const d = deps();
  const limit = 5;
  const total = await d.repos.readings.countByUser(user.id);
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const p = Math.min(Math.max(1, page), totalPages);
  const items = await d.repos.readings.listByUser(user.id, limit, (p - 1) * limit);
  if (items.length === 0) {
    await editTo(ctx, "📜 У тебя ещё нет сохранённых раскладов. Хочешь сделать первый?",
      new InlineKeyboard().text("🔮 Сделать расклад", "rd:menu").row().text("🏠 Меню", "nav:menu"));
    return;
  }
  const text = `<b>📜 Твои расклады (страница ${p}/${totalPages})</b>\n\n` +
    items.map((r: any, i: number) => formatReadingHistoryItem(r, (p - 1) * limit + i + 1)).join("\n\n");
  await editTo(ctx, text, historyPaginationKeyboard(p, totalPages));
}
