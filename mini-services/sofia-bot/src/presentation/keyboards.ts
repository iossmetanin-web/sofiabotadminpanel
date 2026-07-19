// presentation/keyboards.ts — inline keyboard builders.
// Per Skill §5: use builders, never raw dicts. Edit-in-place navigation.

import { InlineKeyboard } from "grammy";
import type { UserDTO } from "../application/ports.js";
import { t, type Locale } from "../domain/i18n.js";

// Callback data convention: "ns:action[:payload]" — namespaced, <64 bytes.
// We don't use the callback-data plugin (failed to install); manual packing is fine for our size.

export function mainMenuKeyboard(u: UserDTO): InlineKeyboard {
  const loc: Locale = u.language;
  return new InlineKeyboard()
    .text("🔮 " + t(loc, "reading_menu_title").replace("📜 ", ""), "rd:menu").text(t(loc, "card_of_day"), "rd:cardday").text(t(loc, "free_card"), "rd:freecard").row()
    .text(t(loc, "menu_history"), "nav:history").text(t(loc, "menu_profile"), "nav:profile").text(`💎 ${u.crystals}`, "nav:balance").row()
    .text("💭 " + t(loc, "dream_cmd_desc").replace(/^💭 /, ""), "nav:dream").text(t(loc, "menu_settings"), "nav:settings").row()
    .text(t(loc, "menu_help"), "nav:help").text(t(loc, "miniapp_btn"), "nav:miniapp");
}

export function backHomeKeyboard(loc: Locale = "ru"): InlineKeyboard {
  return new InlineKeyboard()
    .text(t(loc, "menu_back"), "nav:back").text(t(loc, "menu_home"), "nav:menu");
}

export function homeOnlyKeyboard(loc: Locale = "ru"): InlineKeyboard {
  return new InlineKeyboard().text(t(loc, "menu_home"), "nav:menu");
}

export function readingMenuKeyboard(loc: Locale = "ru"): InlineKeyboard {
  return new InlineKeyboard()
    .text(`${t(loc, "reading_love")} · 2💎`, "rd:pick:tarot_love").row()
    .text(`${t(loc, "reading_career")} · 2💎`, "rd:pick:tarot_career").row()
    .text(`${t(loc, "reading_decision")} · 2💎`, "rd:pick:tarot_decision").row()
    .text(`${t(loc, "yes_no_cost")}`, "rd:yesno").row()
    .text(`${t(loc, "reading_small")} · 1💎`, "rd:pick:tarot_small").row()
    .text(`${t(loc, "reading_full")} · 3💎`, "rd:pick:tarot_full").row()
    .text(`${t(loc, "reading_horoscope")} · 2💎`, "rd:pick:horoscope").row()
    .text(t(loc, "menu_back"), "nav:back").text(t(loc, "menu_home"), "nav:menu");
}

export function buyMenuKeyboard(loc: Locale = "ru"): InlineKeyboard {
  return new InlineKeyboard()
    .text(t(loc, "billing_weekly"), "buy:weekly").row()
    .text(t(loc, "billing_monthly"), "buy:monthly").row()
    .text(t(loc, "billing_pack3"), "buy:pack3").text(t(loc, "billing_pack10"), "buy:pack10").row()
    .text(t(loc, "billing_pack25"), "buy:pack25").row()
    .text(t(loc, "billing_referral"), "nav:referral").row()
    .text(t(loc, "menu_back"), "nav:back").text(t(loc, "menu_home"), "nav:menu");
}

export function paidHookKeyboard(loc: Locale = "ru"): InlineKeyboard {
  return new InlineKeyboard()
    .text("🔮 " + (loc === "en" ? "Reveal fully" : "Узнать полностью"), "rd:menu").row()
    .text(t(loc, "menu_later"), "nav:later");
}

export function historyPaginationKeyboard(page: number, totalPages: number, loc: Locale = "ru"): InlineKeyboard {
  const kb = new InlineKeyboard();
  if (page > 1) kb.text(t(loc, "history_prev"), `nav:history:${page - 1}`);
  kb.text(`${page}/${totalPages}`, "nav:none");
  if (page < totalPages) kb.text(t(loc, "history_next"), `nav:history:${page + 1}`);
  kb.row();
  kb.text(t(loc, "menu_back"), "nav:back").text(t(loc, "menu_home"), "nav:menu");
  return kb;
}

export function deleteConfirmKeyboard(loc: Locale = "ru"): InlineKeyboard {
  return new InlineKeyboard()
    .text("❌ " + (loc === "en" ? "Cancel" : "Отмена"), "nav:cancel_delete").row()
    .text(t(loc, "profile_delete_yes"), "nav:confirm_delete");
}

export function adminPanelKeyboard(loc: Locale = "ru"): InlineKeyboard {
  return new InlineKeyboard()
    .text(t(loc, "admin_stats"), "admin:stats").row()
    .text(t(loc, "admin_users"), "admin:users").row()
    .text(t(loc, "admin_add"), "admin:add").row()
    .text(t(loc, "admin_broadcast"), "admin:broadcast").row()
    .text(t(loc, "menu_home"), "nav:menu");
}

export function broadcastConfirmKeyboard(loc: Locale = "ru"): InlineKeyboard {
  return new InlineKeyboard()
    .text(t(loc, "admin_broadcast_confirm"), "admin:broadcast_confirm").row()
    .text(t(loc, "admin_broadcast_cancel"), "admin:broadcast_cancel");
}

export function referralKeyboard(code: string, botUsername: string, loc: Locale = "ru"): InlineKeyboard {
  const url = `https://t.me/${botUsername}?start=ref_${code}`;
  return new InlineKeyboard()
    .text(t(loc, "referral_share"), `share:${code}`).row()
    .url("🔗 " + (loc === "en" ? "Open link" : "Открыть ссылку"), url).row()
    .text(t(loc, "menu_home"), "nav:menu");
}

export function languageKeyboard(loc: Locale = "ru"): InlineKeyboard {
  return new InlineKeyboard()
    .text(t(loc, "lang_ru"), "lang:set:ru").row()
    .text(t(loc, "lang_en"), "lang:set:en").row()
    .text(t(loc, "menu_back"), "nav:back").text(t(loc, "menu_home"), "nav:menu");
}

export function settingsKeyboard(u: UserDTO): InlineKeyboard {
  const loc = u.language;
  return new InlineKeyboard()
    .text(t(loc, "settings_lang", { lang: loc === "ru" ? "🇷🇺 Русский" : "🇬🇧 English" }), "lang:menu").row()
    .text(t(loc, "menu_back"), "nav:back").text(t(loc, "menu_home"), "nav:menu");
}

// Pagination for users table (admin).
export function usersPaginationKeyboard(page: number, totalPages: number, loc: Locale = "ru"): InlineKeyboard {
  const kb = new InlineKeyboard();
  if (page > 1) kb.text("◀", `admin:users:${page - 1}`);
  kb.text(`${page}/${totalPages}`, "nav:none");
  if (page < totalPages) kb.text("▶", `admin:users:${page + 1}`);
  kb.row().text("🛠 " + (loc === "en" ? "Admin" : "Админ"), "admin:panel");
  return kb;
}
