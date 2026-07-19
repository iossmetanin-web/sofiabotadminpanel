// presentation/callbacks.ts — inline button router.
// Callback data convention: "namespace:action[:payload]". Always answerCallbackQuery first.

import type { Context } from "grammy";
import { InlineKeyboard } from "grammy";
import { deps } from "./deps.js";
import { isAdmin } from "../config/env.js";
import { t, type Locale, localeLabel } from "../domain/i18n.js";
import {
  mainMenuKeyboard, readingMenuKeyboard, buyMenuKeyboard, backHomeKeyboard,
  adminPanelKeyboard, deleteConfirmKeyboard, historyPaginationKeyboard,
  referralKeyboard, usersPaginationKeyboard, languageKeyboard, settingsKeyboard,
  homeOnlyKeyboard,
} from "./keyboards.js";
import { formatProfile, formatBalance, formatReadingHistoryItem, escapeHtml } from "./formatters.js";
import { editTo } from "./commands.js";
import { startReadingFlow } from "./conversation.js";
import { SOFIA_SYSTEM_PROMPT, AFFIRMATION_PROMPT_RU, AFFIRMATION_PROMPT_EN, YES_NO_PROMPT_RU, YES_NO_PROMPT_EN } from "../domain/prompts.js";

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
    await ctx.reply(t("ru", "err_unknown_user"));
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
    if (ns === "lang") return handleLang(ctx, user, action, payload);
    log?.warn?.({ data }, "unknown callback namespace");
    await ctx.reply(t(user.language, "err_unknown_callback"));
  } catch (e) {
    log?.error?.({ err: e, data }, "callback handler failed");
    await ctx.reply(t(user.language, "err_generic"));
  }
}

async function handleNav(ctx: Context, user: any, action: string, payload: string): Promise<void> {
  const d = deps();
  const loc: Locale = user.language;
  switch (action) {
    case "menu": {
      await d.repos.users.setState(user.telegramId, "CONVERSATION");
      await editTo(ctx, t(loc, "menu_title"), mainMenuKeyboard(user));
      return;
    }
    case "back": {
      await d.repos.users.setState(user.telegramId, "CONVERSATION");
      await editTo(ctx, loc === "en" ? "What shall we talk about?" : "О чём поговорим?", mainMenuKeyboard(user));
      return;
    }
    case "later": {
      await d.repos.users.setState(user.telegramId, "CONVERSATION");
      await editTo(ctx, loc === "en" ? "Very well, I will wait. 🌙" : "Хорошо, я подожду. 🌙", mainMenuKeyboard(user));
      return;
    }
    case "profile": {
      await editTo(ctx, formatProfile(user), new InlineKeyboard()
        .text(t(loc, "profile_delete_data"), "nav:delete").row().text(t(loc, "menu_home"), "nav:menu"));
      return;
    }
    case "balance": {
      await editTo(ctx, formatBalance(user), buyMenuKeyboard(loc));
      return;
    }
    case "history": {
      const page = parseInt(payload || "1", 10) || 1;
      await showHistoryEdit(ctx, user, page);
      return;
    }
    case "settings": {
      await editTo(ctx,
        t(loc, "settings_title") + "\n\n" +
        t(loc, "settings_lang", { lang: localeLabel(loc) }) + "\n" +
        t(loc, "settings_daily_card") + ": " + t(loc, "settings_on") + "\n" +
        t(loc, "settings_soon"),
        settingsKeyboard(user));
      return;
    }
    case "help": {
      await editTo(ctx, t(loc, "help_body"), backHomeKeyboard(loc));
      return;
    }
    case "referral": {
      const kb = referralKeyboard(user.referralCode, d.botUsername, loc);
      const link = `https://t.me/${d.botUsername}?start=ref_${user.referralCode}`;
      await editTo(ctx, t(loc, "referral_title") + "\n\n" + t(loc, "referral_body", { link }), kb);
      return;
    }
    case "affirmation": {
      await sendAffirmationInline(ctx, user);
      return;
    }
    case "dream": {
      const d = deps();
      const loc2: Locale = user.language;
      await d.repos.users.setState(user.telegramId, "DREAM");
      await editTo(ctx, t(loc2, "dream_ask"),
        new InlineKeyboard().text(t(loc2, "menu_back"), "nav:back"));
      return;
    }
    case "miniapp": {
      // Mini App launch — currently a placeholder; when a Web App URL is configured in BotFather,
      // we can switch to a real web_app button. For now, an explanatory message.
      await editTo(ctx, t(loc, "miniapp_title") + "\n\n" + t(loc, "miniapp_body"),
        new InlineKeyboard()
          .url("🔗 " + (loc === "en" ? "Open in Telegram" : "Открыть в Telegram"), `https://t.me/${d.botUsername}`)
          .row()
          .text(t(loc, "menu_back"), "nav:back").text(t(loc, "menu_home"), "nav:menu"));
      return;
    }
    case "delete": {
      await d.repos.users.setState(user.telegramId, "AWAIT_DELETE_CONFIRM");
      await editTo(ctx,
        t(loc, "profile_delete_confirm_title") + "\n\n" + t(loc, "profile_delete_confirm_body"),
        deleteConfirmKeyboard(loc));
      return;
    }
    case "cancel_delete": {
      await d.repos.users.setState(user.telegramId, "CONVERSATION");
      await editTo(ctx, t(loc, "profile_delete_cancelled"), mainMenuKeyboard(user));
      return;
    }
    case "confirm_delete": {
      await d.repos.users.delete(user.telegramId);
      await d.repos.audit.record(user.telegramId, "delete_own_data", user.telegramId, null);
      await ctx.reply(t(loc, "profile_deleted"));
      return;
    }
    case "none": return; // static label button
  }
}

async function handleLang(ctx: Context, user: any, action: string, payload: string): Promise<void> {
  const d = deps();
  const loc: Locale = user.language;
  if (action === "menu") {
    await editTo(ctx, t(loc, "lang_select"), languageKeyboard(loc));
    return;
  }
  if (action === "set") {
    if (payload !== "ru" && payload !== "en") return;
    const newLoc: Locale = payload;
    await d.repos.users.update(user.telegramId, { language: newLoc });
    // Re-fetch user so subsequent keyboards use the new locale.
    const updated = await d.repos.users.findByTelegramId(user.telegramId);
    if (updated) {
      await editTo(ctx,
        t(newLoc, "lang_changed", { lang: localeLabel(newLoc) }) + "\n\n" + t(newLoc, "menu_title"),
        mainMenuKeyboard(updated));
    }
    return;
  }
}

async function handleReading(ctx: Context, user: any, action: string, payload: string): Promise<void> {
  if (action === "menu") {
    await editTo(ctx, t(user.language, "reading_menu_title"), readingMenuKeyboard(user.language));
    return;
  }
  if (action === "pick") {
    await startReadingFlow(ctx, user, payload);
    return;
  }
  if (action === "yesno") {
    // Yes/No reading: set state to YES_NO_ASK and prompt for question
    const d = deps();
    const loc: Locale = user.language;
    if (user.crystals < 1) {
      await editTo(ctx, t(loc, "billing_low_balance", { count: 1 }), buyMenuKeyboard(loc));
      return;
    }
    await d.repos.users.setState(user.telegramId, "YES_NO_ASK");
    await editTo(ctx, t(loc, "yes_no_ask"),
      new InlineKeyboard().text(t(loc, "menu_back"), "nav:back"));
    return;
  }
  if (action === "cardday" || action === "freecard") {
    await startReadingFlow(ctx, user, action === "cardday" ? "card_of_day" : "single_card");
    return;
  }
}

async function handleBuy(ctx: Context, user: any, action: string): Promise<void> {
  const d = deps();
  const loc: Locale = user.language;
  if (action === "msg5") {
    if (user.crystals >= 1) {
      await d.services.billing.spend(user.telegramId, 1, loc === "en" ? "Pack +5 messages" : "Пакет +5 сообщений");
      await d.repos.users.update(user.telegramId, { dailyMessageCount: Math.max(0, user.dailyMessageCount - 5) });
      await ctx.reply(t(loc, "billing_pack_added"), { ...HTML, reply_markup: mainMenuKeyboard(user) });
    } else {
      await ctx.reply(t(loc, "billing_low_balance", { count: 1 }), { ...HTML, reply_markup: buyMenuKeyboard(loc) });
    }
    return;
  }
  await ctx.reply(t(loc, "billing_buy_soon"), { ...HTML, reply_markup: buyMenuKeyboard(loc) });
}

async function handleAdmin(ctx: Context, user: any, action: string, payload: string): Promise<void> {
  const d = deps();
  const loc: Locale = user.language;
  if (!isAdmin(user.telegramId)) {
    await ctx.reply(t(loc, "admin_forbidden"));
    return;
  }
  switch (action) {
    case "panel": {
      await d.repos.users.setState(user.telegramId, "ADMIN_PANEL");
      await editTo(ctx, t(loc, "admin_panel_title"), adminPanelKeyboard(loc));
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
      const label = loc === "en"
        ? `📊 <b>Stats</b>\n\nUsers: <b>${totalUsers}</b>\nActive 24h: <b>${active24h}</b>\nOnboarded: <b>${onboarded}</b>\nMessages: <b>${totalMsgs}</b>\nReadings: <b>${totalReadings}</b>\n💎 Crystals spent: <b>${crystalsSpent}</b>`
        : `📊 <b>Статистика</b>\n\nПользователей: <b>${totalUsers}</b>\nАктивны за 24ч: <b>${active24h}</b>\nЗавершили онбординг: <b>${onboarded}</b>\nСообщений всего: <b>${totalMsgs}</b>\nРаскладов всего: <b>${totalReadings}</b>\n💎 Кристаллов потрачено: <b>${crystalsSpent}</b>`;
      await editTo(ctx, label,
        new InlineKeyboard().text("🛠 " + (loc === "en" ? "Admin" : "Админ"), "admin:panel").row().text(t(loc, "menu_home"), "nav:menu"));
      return;
    }
    case "users": {
      const page = parseInt(payload || "1", 10) || 1;
      const limit = 10;
      const total = await d.repos.users.countAll();
      const totalPages = Math.max(1, Math.ceil(total / limit));
      const users = await d.repos.users.listPaginated((page - 1) * limit, limit);
      const title = loc === "en" ? `<b>👥 Users (${page}/${totalPages})</b>` : `<b>👥 Пользователи (${page}/${totalPages})</b>`;
      const text = title + "\n\n" +
        users.map((u: any) => `• ${escapeHtml(u.name ?? u.firstName ?? "—")} @${escapeHtml(u.username ?? "—")} · 💎${u.crystals} · ${u.onboardingStep}`).join("\n");
      await editTo(ctx, text, usersPaginationKeyboard(page, totalPages, loc));
      return;
    }
    case "add": {
      await d.repos.users.setState(user.telegramId, "ADMIN_PANEL");
      await ctx.reply(t(loc, "admin_add_format"), HTML);
      return;
    }
    case "broadcast": {
      await d.repos.users.setState(user.telegramId, "BROADCAST");
      await editTo(ctx, t(loc, "admin_broadcast_prompt"),
        new InlineKeyboard().text(t(loc, "admin_broadcast_cancel"), "admin:broadcast_cancel"));
      return;
    }
    case "broadcast_confirm": {
      const cb = ctx.callbackQuery;
      const msg = cb && "message" in cb ? (cb as any).message : null;
      const previewText = msg && "text" in msg ? (msg as any).text : "";
      const m = previewText.match(/Превью рассылки:\n\n([\s\S]*?)\n\nПолучат:/);
      const text = m ? m[1] : "";
      if (!text) { await ctx.reply(t(loc, "admin_broadcast_no_text")); return; }
      const total = await d.repos.users.countAll();
      const bc = await d.repos.broadcasts.create(user.telegramId, text, total);
      await editTo(ctx, t(loc, "admin_broadcast_launched", { id: bc.id }), adminPanelKeyboard(loc));
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
      await editTo(ctx, t(loc, "admin_panel_title"), adminPanelKeyboard(loc));
      return;
    }
  }
}

async function handleShare(ctx: Context, user: any, code: string): Promise<void> {
  const d = deps();
  const loc: Locale = user.language;
  const link = `https://t.me/${d.botUsername}?start=ref_${code}`;
  await editTo(ctx, t(loc, "referral_title") + "\n\n<code>" + link + "</code>", referralKeyboard(code, d.botUsername, loc));
}

async function showHistoryEdit(ctx: Context, user: any, page: number): Promise<void> {
  const d = deps();
  const loc: Locale = user.language;
  const limit = 5;
  const total = await d.repos.readings.countByUser(user.id);
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const p = Math.min(Math.max(1, page), totalPages);
  const items = await d.repos.readings.listByUser(user.id, limit, (p - 1) * limit);
  if (items.length === 0) {
    await editTo(ctx, t(loc, "history_empty"),
      new InlineKeyboard().text(t(loc, "history_make_first"), "rd:menu").row().text(t(loc, "menu_home"), "nav:menu"));
    return;
  }
  const text = t(loc, "history_page", { page: String(p), total: String(totalPages) }) + "\n\n" +
    items.map((r: any, i: number) => formatReadingHistoryItem(r, (p - 1) * limit + i + 1, loc)).join("\n\n");
  await editTo(ctx, text, historyPaginationKeyboard(p, totalPages, loc));
}

// Affirmation via inline button (reuses the LLM call).
async function sendAffirmationInline(ctx: Context, user: any): Promise<void> {
  const d = deps();
  const loc: Locale = user.language;
  const prompt = loc === "en" ? AFFIRMATION_PROMPT_EN : AFFIRMATION_PROMPT_RU;
  const messages = await d.services.context.buildMessages({
    systemPrompt: SOFIA_SYSTEM_PROMPT,
    userTelegramId: user.telegramId,
    userName: user.name,
    userZodiac: user.zodiacSign,
    userAgeGroup: user.ageGroup,
    currentUserMessage: prompt,
  });
  let body = loc === "en" ? "Be like still water today. 🌙" : "Будь как тихая вода сегодня. 🌙";
  try {
    const reply = await d.llm.generate(messages, { timeoutMs: 8000, maxTokens: 200 });
    if (reply.content?.trim()) body = reply.content.trim();
  } catch (e) {
    (ctx as any).log?.warn?.({ err: e }, "inline affirmation LLM failed");
  }
  await editTo(ctx, t(loc, "affirmation_intro") + "\n\n" + body,
    new InlineKeyboard().text(t(loc, "menu_home"), "nav:menu"));
}
