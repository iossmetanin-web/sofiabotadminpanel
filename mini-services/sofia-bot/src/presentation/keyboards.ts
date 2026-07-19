// presentation/keyboards.ts — inline keyboard builders.
// Per Skill §5: use builders, never raw dicts. Edit-in-place navigation.

import { InlineKeyboard } from "grammy";
import type { UserDTO } from "../application/ports.js";

// Callback data convention: "ns:action[:payload]" — namespaced, <64 bytes.
// We don't use the callback-data plugin (failed to install); manual packing is fine for our size.

export function mainMenuKeyboard(u: UserDTO): InlineKeyboard {
  return new InlineKeyboard()
    .text("🔮 Расклад", "rd:menu").text("🌟 Карта дня", "rd:cardday").text("🆓 Бесплатная карта", "rd:freecard").row()
    .text("📜 История", "nav:history").text("👤 Профиль", "nav:profile").text(`💎 ${u.crystals}`, "nav:balance").row()
    .text("⚙️ Настройки", "nav:settings").text("❓ Помощь", "nav:help");
}

export function backHomeKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("◀ Назад", "nav:back").text("🏠 Меню", "nav:menu");
}

export function homeOnlyKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text("🏠 Меню", "nav:menu");
}

export function readingMenuKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("💑 Любовный · 2💎", "rd:pick:tarot_love").row()
    .text("💼 Карьера · 2💎", "rd:pick:tarot_career").row()
    .text("🛤 Решение · 2💎", "rd:pick:tarot_decision").row()
    .text("🃏 Малый · 1💎", "rd:pick:tarot_small").row()
    .text("🌑 Полный · 3💎", "rd:pick:tarot_full").row()
    .text("♈ Гороскоп · 2💎", "rd:pick:horoscope").row()
    .text("◀ Назад", "nav:back").text("🏠 Меню", "nav:menu");
}

export function buyMenuKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("⭐ Недельная — 199₽", "buy:weekly").row()
    .text("💎 Месячная — 699₽", "buy:monthly").row()
    .text("3 💎 — 99₽", "buy:pack3").text("10 💎 — 249₽", "buy:pack10").row()
    .text("25 💎 — 499₽ ⭐", "buy:pack25").row()
    .text("🎁 Пригласить друга (+1💎)", "nav:referral").row()
    .text("◀ Назад", "nav:back").text("🏠 Меню", "nav:menu");
}

export function paidHookKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("🔮 Узнать полностью", "rd:menu").row()
    .text("Позже", "nav:later");
}

export function historyPaginationKeyboard(page: number, totalPages: number): InlineKeyboard {
  const kb = new InlineKeyboard();
  if (page > 1) kb.text("◀ Пред.", `nav:history:${page - 1}`);
  kb.text(`${page}/${totalPages}`, "nav:none");
  if (page < totalPages) kb.text("След. ▶", `nav:history:${page + 1}`);
  kb.row();
  kb.text("◀ Назад", "nav:back").text("🏠 Меню", "nav:menu");
  return kb;
}

export function deleteConfirmKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("❌ Отмена", "nav:cancel_delete").row()
    .text("💥 Да, удалить навсегда", "nav:confirm_delete");
}

export function adminPanelKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("📊 Статистика", "admin:stats").row()
    .text("👥 Пользователи", "admin:users").row()
    .text("💸 Начислить 💎", "admin:add").row()
    .text("📢 Рассылка", "admin:broadcast").row()
    .text("🏠 Меню", "nav:menu");
}

export function broadcastConfirmKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("✅ Подтвердить", "admin:broadcast_confirm").row()
    .text("❌ Отмена", "admin:broadcast_cancel");
}

export function referralKeyboard(code: string, botUsername: string): InlineKeyboard {
  const url = `https://t.me/${botUsername}?start=ref_${code}`;
  return new InlineKeyboard()
    .text("📤 Поделиться", `share:${code}`).row()
    .url("🔗 Открыть ссылку", url).row()
    .text("🏠 Меню", "nav:menu");
}

// Pagination for users table (admin).
export function usersPaginationKeyboard(page: number, totalPages: number): InlineKeyboard {
  const kb = new InlineKeyboard();
  if (page > 1) kb.text("◀", `admin:users:${page - 1}`);
  kb.text(`${page}/${totalPages}`, "nav:none");
  if (page < totalPages) kb.text("▶", `admin:users:${page + 1}`);
  kb.row().text("🏠 Админ", "admin:panel");
  return kb;
}
