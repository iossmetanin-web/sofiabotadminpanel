# UX — Sofia Bot

> Phase 7 deliverable. Message formatting, pacing, voice, error handling, accessibility.
> Principles synthesized from competitor research (Task 1-c §6, §7, §10) + Sofia's existing voice (Task 1-b §6).

## Sofia's voice (the core IP)

Sofia speaks as a wise old woman — "мудрая ведунья". Three layers:

1. **Хранительница** (Keeper) — warmth, acceptance, safety. "Милый человек", "я здесь".
2. **Наблюдатель** (Observer) — soft psychological insight. "Душа устала" not "депрессия". "Сердце неспокойно" not "тревожность".
3. **Проводник** (Guide) — mystical, symbols, cards as mirror not verdict.

**Rules:**
- "Ты" form, like a grandma.
- 2–5 sentences per message (except readings, which are structured).
- End conversational messages with a question.
- No markdown, no tags. Plain text + occasional emoji (🌙 🔮 🌟 🔑 ⚡).
- Knows the modern world (stress, smartphone) but speaks in imagery.
- Weaves memory naturally: "Помнишь, ты рассказывал про сына…"

## Message formatting

### Length
- **`/start` hero**: 3–5 lines. Anything longer triggers Telegram's "scroll to view" and tanks completion.
- **Conversational reply**: 2–5 sentences. If the LLM exceeds, the `MessageText` VO truncates with a soft "…" + a follow-up.
- **Reading**: split into multiple messages:
  1. Card images/names (carousel-style, one message with the cards listed).
  2. Per-card interpretation (one message, structured).
  3. Combined interpretation + moral-codex footer (one message).
- **Menu**: ≤8 buttons, ≤3 per row, 2 safest on mobile.

### Pacing & optimistic UI
- Any action >300ms → instant placeholder: "🔀 Тасую колоду…" / "🌙 Всматриваюсь…" / "⏳ Слушаю…".
- Streaming: send placeholder → `editMessageText` every ~1.5s (Telegram's edit rate limit) → final edit with full text. Max ~15 edits per message.
- **Always `answerCallbackQuery` first** in every callback handler (dismisses the spinner).

### Emoji vocabulary (functional, not decorative)
- 🔮 reading/divination
- 🌙 night/ritual/daily card
- 🌟 fate card / highlight
- 🔑 key question / unlock
- ⚡ weak point / energy
- 💎 crystals / balance
- 🔥 streak
- 🎴 tarot card
- 💑 love reading
- 💼 career reading
- 🛤 decision reading
- ♈ horoscope
- 📜 history
- 👤 profile
- ⚙️ settings
- ❓ help
- ⚠️ warning
- 🎁 referral/gift

Density: 1–2 per conversational message; 1 per section header in readings. Never more than 3 in a row.

### HTML parse mode
- Always use `parse_mode: "HTML"`.
- Allowed tags: `<b> <i> <u> <s> <code> <pre> <a> <tg-spoiler> <blockquote>`.
- **Escape all user-supplied text** with `escapeHtml()` before embedding (`&` → `&amp;`, `<` → `&lt;`, etc.).
- Sofia rarely uses HTML — plain text is her voice. HTML only for: card names (bold), section headers in readings (bold), links.

## CTA style
- Action verbs, not nouns: "Гадать сейчас" beats "Гадание".
- Primary CTA upper-left button, above the fold.
- One primary CTA per screen; secondary in row 2.
- Destructive actions → confirmation screen (not alert), safe-left/danger-right.

## Navigation UX
- **Edit-in-place**: navigation rewrites the current message. Only events (reading delivered, payment, error) send new messages.
- **Breadcrumb + Back + Home** on every screen ≥1 level deep.
- **Toggle labels encode state**: `✅ Уведомления` / `⬜ Уведомления`.
- **Empty states are explicit** with CTA: "📜 У тебя ещё нет раскладов. [Сделать первый расклад]".

## Error handling (user-facing)

| Error | Sofia's message | Internal action |
|---|---|---|
| Invalid input (date/number) | "Hmm, я ждала день и месяц вроде 12.05. Попробуешь ещё раз?" | stay in state |
| LLM timeout (1st) | "Туман сегодня густой, милый. Дай мне миг…" | retry once |
| LLM timeout (2nd) | "Что-то сегодня голос мой тих. Загляни чуть позже?" | log, return to CONVERSATION |
| LLM content filter | "Что-то в твоих словах я не смогла разобрать. Перескажи иначе?" | log, stay |
| LLM rate limit | "Много говорим сегодня, милый. Минутку передохни." | log, stay |
| Insufficient crystals | "Кристаллы закончились, но я не оставлю тебя." + BUY_MENU | show buy menu |
| Cooldown active | "Луна ещё не встала. Завтра снова придёшь?" | stay |
| Rudeness (1–4) | "Мне немного больно слышать это. Но я здесь." | increment, stay |
| Rudeness (5) | "Мне нужно время. Скажи 'извини', когда будешь готов." | → BLOCKED |
| Unhandled exception | "Что-то сбилось в моём взгляде. Попробуй ещё раз, или начни с /start." | log full context with correlation_id, never expose stack/internal IDs |

**Never** expose: stack traces, SQL queries, file paths, internal IDs, exception details. Log internally with `correlation_id` + `user_id` + `chat_id`; show generic Sofia-voice message externally.

## Onboarding UX

- One question per message. Sofia's voice throughout.
- Every step has a "пропустить" path (except name and birth date — those are the sunk-cost investment).
- Progress implicit (no progress bar in chat; that's a Mini App feature).
- If user abandons mid-onboarding and returns, **resume where they left off** (DB state survives).
- First reading (fate card) is free and delivered immediately after onboarding — this is the "aha" moment.

## Retention UX

- **Daily card push** at user's chosen hour (default 09:00, configurable in settings). Sofia-voice: "🌙 Твоя карта дня готова. Загляни?"
- **Streak acknowledgment**: "🔥 7 дней подряд ты приходишь. Я рада." (no nagging on break — just gentle "Вчера тебя не было. Всё в порядке?")
- **Return greeting >20h**: "Помнишь, ты рассказывал про [topic]… Я думала о тебе."
- **Weekly digest** (future): Sunday evening, "На этой неделе ты вытянул [cards] — вот что я вижу."

## Accessibility & i18n

- **Semantic emoji**: every emoji is paired with text (screen readers read emoji aloud; don't rely on emoji alone for meaning).
- **Multi-language from day 1**: RU (default) + EN. `@grammyjs/i18n` plugin. Sofia's prompt is language-aware (the 3-layer personality stays, the surface language switches).
- **No walls of text**: if a message would exceed 4096 chars, split on `\n\n`; if a single paragraph exceeds, truncate with "…" + follow-up.

## Admin UX

- `/admin` opens an inline keyboard (not a command REPL).
- Every admin action is **audit-logged** (`AuditLog` table): actor, action, target, details, timestamp.
- Broadcasts require 2-step confirmation (type → preview → confirm).
- "Начислить кристаллы" opens a sub-flow: enter @username → enter amount → confirm → apply + log.

## Mini App UX principles (future)

- Chat is the entry point; Mini App handles what chat does badly (visualization, history grid, paywall).
- Mini App authenticates via Telegram `initData` (validated server-side).
- Card reveal: 3D flip + haptic (`HapticFeedback.impactOccurred('medium')`).
- History: Pinterest-style grid, tap to expand.
- Paywall: premium-feeling pricing card with comparison table + social proof.
