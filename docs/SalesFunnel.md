# Sales Funnel — Sofia Bot

> Phase 7 deliverable. Monetization architecture (UX + data model now; payment integration later).
> Principles from competitor research (Task 1-c §5, §6) + Sofia's existing model (Task 1-b §5).

## Core insight (the strategic moat)

The competitor `@taro_gpt_bot` has **no visible monetization**. The category benchmark (vc.ru test) warns: **~90% of esoteric-bot users are freebie-seekers** who mass-unsubscribe after the free reading. Our funnel solves this by:

1. **Separating the ritual (free) from the interpretation (paid).** Free tier delivers cards; deep interpretation is paid.
2. **Sunk-cost onboarding** (name + birth date + zodiac) before any paywall.
3. **Day-0 soft paywall** — 90% of purchases happen in session 1 (OmiSoft benchmark).
4. **Weekly subscription** (converts 5.4× better than annual) + credit packs + rewarded referral.
5. **Retention loop** (daily card + streak + history) that monetizes the 90% who won't pay via engagement, not paywall.

## Funnel stages

```
┌────────────────────────────────────────────────────────────────────────┐
│ STAGE 1: ACQUISITION                                                   │
│  - Organic: t.me/sofiabot, BotFather search                            │
│  - Referral: t.me/sofiabot?start=ref_{code}  (referrer gets +1💎)     │
│  - Inline mode: @sofiabot <question> in groups (viral)                 │
│  - (future) Telegram Ads                                               │
└───────────────────────────────────┬────────────────────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ STAGE 2: ONBOARDING (sunk cost)                                        │
│  /start → name → birth date → zodiac → probing Q → FREE FATE CARD      │
│  User invests identity. Sofia establishes the relationship.            │
│  Crystals granted: 3 (welcome bonus).                                  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ STAGE 3: FREE ENGAGEMENT (the taste)                                   │
│  - 10 free Sofia conversations/day                                     │
│  - 1 free single card / 24h                                           │
│  - 1 card of the day / 20h (streak engine)                            │
│  - Full fate card (one-time, on onboarding completion)                 │
│  Sofia weaves memory, builds emotional bond.                          │
└───────────────────────────────────┬────────────────────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ STAGE 4: SOFT PAYWALL (Day 0, first session)                           │
│  Triggers:                                                             │
│   (a) 7th message → "В твоей карте есть ещё одна сторона…" + menu      │
│   (b) daily quota exceeded → "Хочешь продолжить? Малый расклад (1💎)"  │
│   (c) user asks for a reading → reading menu (prices shown)            │
│  The cards are drawn for free; the DEEP interpretation costs crystals. │
└───────────────────────────────────┬────────────────────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ STAGE 5: PURCHASE                                                      │
│  If user has crystals → spend → reading (zero friction).               │
│  If not → BUY_MENU:                                                    │
│    [⭐ Недельная подписка — 199₽]  (unlimited + perks, best value)     │
│    [💎 3 кристалла — 99₽]   [💎 10 — 249₽]   [💎 25 — 499₽ ⭐]         │
│    [🎁 Пригласить друга за +1💎]                                       │
│  (future: Telegram Stars packs; rewarded ad for 1 free deep reading)   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ STAGE 6: RETENTION LOOP (monetizes non-payers via engagement)          │
│  - Daily card push (streak engine) → habit → return                    │
│  - Return greeting >20h (emotional bond)                               │
│  - Reading history (revisit past readings, "did it come true?")        │
│  - Weekly digest (Sunday: "your week's pattern")                       │
│  - Renewal reminders (3-day, 1-day, day-of) for subscribers            │
│  - Streak recovery via referral reward or 1💎                          │
└───────────────────────────────────┬────────────────────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ STAGE 7: REPEAT PURCHASE & UPSELL                                      │
│  - Themed readings (love/career/decision) at higher price              │
│  - Full 20-card reading (3💎) for "deep" moments                       │
│  - Upgrade to monthly subscription (saves vs weekly)                   │
│  - Birthday special reading (cron-triggered, personalized)             │
└────────────────────────────────────────────────────────────────────────┘
```

## Pricing (data model ships now; payment integration later)

| SKU | Price | Contents | Currency |
|---|---|---|---|
| Welcome bonus | free | 3 💎 | — |
| Daily free tier | free | 10 msgs/day + 1 single card/24h + 1 card-of-day/20h | — |
| Tarot small (5 cards) | 1 💎 | full interpretation | crystals |
| Tarot love (3 cards) | 2 💎 | full interpretation | crystals |
| Tarot decision (3 cards) | 2 💎 | full interpretation | crystals |
| Tarot career (5 cards) | 2 💎 | full interpretation | crystals |
| Horoscope | 2 💎 | full interpretation | crystals |
| Tarot full (20 cards) | 3 💎 | full interpretation | crystals |
| `/today` daily message | 1 💎 | personalized | crystals |
| `/mood` check-in | 1 💎 | personalized | crystals |
| Referral reward | free | +1 💎 per friend who completes onboarding | — |
| Weekly subscription | 199 ₽ / week | unlimited readings + all decks + ad-free | fiat/Stars (later) |
| Monthly subscription | 699 ₽ / month | same as weekly | fiat/Stars (later) |
| Credit pack S | 99 ₽ | 3 💎 | fiat/Stars (later) |
| Credit pack M | 249 ₽ | 10 💎 | fiat/Stars (later) |
| Credit pack L | 499 ₽ | 25 💎 | fiat/Stars (later) |

> **Pricing anchor**: show 3 tiers (199/699/4990 ₽ for weekly/monthly/annual). Users anchor on the high annual and pick weekly — the "steal" (Memberpass).

## Crystal billing (corrected from old bot)

**Old bot bug**: the boundary message (11th, 16th…) got the billing text instead of an LLM reply. User paid for messages they didn't fully receive.

**New logic**:
1. On each CONVERSATION message, increment `dailyMessageCount` (reset if `dailyMessageDate != today`).
2. If `dailyMessageCount <= 10`: generate full Sofia reply.
3. If `dailyMessageCount > 10`:
   - If `crystals > 0`: **offer** (don't force) a 1💎 package = +5 messages. Sofia: "Сегодня мы много говорим. Хочешь ещё пять — это один кристалл." + [Да, 1💎] [Нет, хватит].
   - If user declines: Sofia replies but **shorter** (max 2 sentences) — softer, not a paywall slam.
   - **Never** replace the LLM reply with a billing notice. The user always gets a Sofia response.
4. Crystal spend happens **before** generation (atomic `$transaction`); if LLM fails, **refund** the crystal and show the graceful error.

## Subscription lifecycle (data model now; integration later)

- `User.subscriptionType` = `"weekly" | "monthly" | null`
- `User.subscriptionUntil` = DateTime
- On purchase: set both, `Transaction(type="subscription", amount=price)`.
- Scheduler checks daily: if `subscriptionUntil < now` → set type=null, send renewal reminder (3 days before, 1 day before, day-of).
- While subscription active: unlimited readings, no daily quota, "⭐ Подписчик" badge in profile.

## Referral program

- Each user gets a `referralCode` (6-char, unique) on creation.
- Deep link: `t.me/sofiabot?start=ref_{code}`.
- On invitee's onboarding completion: referrer gets +1 💎 (`Transaction(type="referral")`), `Referral.rewardGiven=true`.
- Tiered rewards (future):
  - 3 friends → unlock premium deck for a week
  - 10 friends → unlock premium persona for a month
- Referral screen shows: code, link, count, progress to next tier.

## Revenue projection (illustrative, not promised)

Assuming 1,000 MAU (competitor has ~31K — we aim lower but higher quality):
- Free→paid conversion (category benchmark 2–5%, best-in-class 14%): assume 5% → 50 paying users.
- ARPU (weekly 199₽ × ~3 weeks/month avg + credit packs): ~700₽/month.
- Monthly revenue: 50 × 700 = ~35,000 ₽.
- Referral-driven growth (10% MoM if referral works): compounding.

These are illustrative; real numbers depend on traffic source, retention, and payment friction.

## What ships NOW vs LATER

| Feature | Now | Later |
|---|---|---|
| Crystal currency + spend/add | ✅ | — |
| Daily free tier + soft paywall | ✅ | — |
| Paid readings (tarot/horoscope) | ✅ | — |
| Referral program (+1💎) | ✅ | tiered rewards |
| Reading history | ✅ | Mini App grid |
| Streak counter | ✅ | streak-recovery via rewarded ad |
| Subscription data model + UX | ✅ | Telegram Stars / YooKassa integration |
| Credit pack UX | ✅ | payment integration |
| Inline mode (viral) | ✅ (basic) | rich previews |
| Rewarded ads | — | AdsGram / PropellerAds |
| Mini App (paywall, reveal animation) | — | Phase 4 |
| Birthday special reading | ✅ (cron) | — |
| Renewal reminders | ✅ (cron) | — |
