# Comparison — Competitor vs Sofia Bot

> Phase 8 deliverable. Feature-by-feature comparison. Source: competitor research (Task 1-c §11).
> "Likely" = inferred from public surface; not verified by live testing.

## Strategic summary

The competitor `@taro_gpt_bot` has **product-market fit** (~31K MAU) but is **under-built**: no retention engine, no monetization, no Mini App, no history, no referral, no multi-language. Our bot doesn't need to out-tarot it — we need to **out-retain** and **out-monetize** it. The tarot mechanic is the entry point; the daily ritual + streak + journal + referral loop is the moat.

## Feature comparison

| # | Feature | Competitor (likely) | Sofia (target) | Priority | Complexity | Sales impact | UX impact |
|---|---|---|---|---|---|---|---|
| **Language** | | | | | | | |
| 1 | Russian | ✅ | ✅ | P0 | — | high | high |
| 2 | English | ❌ | ✅ (P1) | P1 | M | high | high |
| 3 | Spanish | ❌ | ✅ (P2) | P2 | M | medium | medium |
| **Core mechanic** | | | | | | | |
| 4 | Free-form question input | ✅ | ✅ | P0 | S | high | high |
| 5 | Yes/No mode | ❌ | ✅ (P1) | P1 | S | medium | medium |
| 6 | Multi-card spreads (3/5/7/Celtic) | ✅ | ✅ | P0 | M | high | high |
| 7 | Reversed-cards toggle | ✅ | ✅ (P1) | P1 | S | low | medium |
| 8 | Deck selector | ✅ (1+) | ✅ (P2, 3+) | P2 | M | low | medium |
| 9 | AI persona selector | ✅ (1) | ✅ (P2, 3+) | P2 | M | low | medium |
| 10 | Hybrid virtual/physical deck | ✅ | ✅ (P2) | P2 | M | low | medium |
| **Personality** | | | | | | | |
| 11 | Branded AI persona | ✅ ("TaroGPT") | ✅ ("София", 3-layer) | P0 | M | high | high |
| 12 | Moral codex (no death/illness/curses) | ❓ | ✅ | P0 | S | — | high |
| 13 | Emotional memory (remembers user) | ❌ | ✅ | P0 | M | high | high |
| 14 | Return greeting (>20h) | ❌ | ✅ | P0 | S | medium | high |
| **Readings** | | | | | | | |
| 15 | Fate card (4-part + hook) | ❌ | ✅ | P0 | M | medium | high |
| 16 | Themed spreads (love/career/decision) | ❌ | ✅ | P0 | M | high | high |
| 17 | Horoscope | ❌ | ✅ | P0 | S | medium | medium |
| 18 | Card of the day | ✅ (teaser) | ✅ (full ritual) | P0 | S | high | high |
| 19 | Free single card (24h) | ❌ | ✅ | P0 | S | medium | medium |
| **Retention** | | | | | | | |
| 20 | Streak counter | ❌ | ✅ | P0 | S | high | high |
| 21 | Daily ritual push (user TZ) | ❌ | ✅ | P0 | M | high | high |
| 22 | Reading history/journal | ❌ | ✅ (in-chat P0, Mini App P2) | P0 | S | high | high |
| 23 | Mood check-in cron | ❌ | ✅ | P0 | S | medium | medium |
| 24 | Birthday greeting cron | ❌ | ✅ | P0 | S | low | medium |
| 25 | Weekly digest | ❌ | ✅ (P1) | P1 | S | medium | medium |
| **Monetization** | | | | | | | |
| 26 | Crystal currency | ❌ | ✅ | P0 | S | high | medium |
| 27 | Daily free quota + soft paywall | ❌ | ✅ | P0 | S | high | high |
| 28 | Paid hook (every 7th msg) | ❌ | ✅ | P0 | S | high | medium |
| 29 | Credit packs (UX) | ❌ | ✅ (P0); integration P1 | P0/P1 | M | high | medium |
| 30 | Weekly subscription | ❌ | ✅ (UX P0; integration P2) | P0/P2 | M | high | medium |
| 31 | Referral program | ❌ | ✅ (+1💎) | P0 | M | high | medium |
| 32 | Tiered referral rewards | ❌ | ✅ (P2) | P2 | S | medium | low |
| 33 | Rewarded ad | ❌ | ✅ (P2) | P2 | M | medium | low |
| **Navigation & UX** | | | | | | | |
| 34 | Button-first navigation | ✅ | ✅ | P0 | S | — | high |
| 35 | Edit-in-place navigation | ❓ | ✅ | P0 | S | — | high |
| 36 | Breadcrumb + Back + Home | ❓ | ✅ | P0 | S | — | high |
| 37 | Optimistic UI placeholders | ❓ | ✅ | P0 | S | — | high |
| 38 | Empty states with CTA | ❓ | ✅ | P0 | S | — | medium |
| 39 | Friendly error messages (Sofia voice) | ❓ | ✅ | P0 | S | — | high |
| 40 | Confirmation for destructive actions | ✅ | ✅ | P0 | S | — | medium |
| 41 | `/cancel` from any state | ❓ | ✅ | P0 | S | — | medium |
| 42 | Resume onboarding if abandoned | ❓ | ✅ | P0 | S | — | high |
| **Growth** | | | | | | | |
| 43 | Inline mode (`@bot question`) | ❌ | ✅ (P1) | P1 | M | high | medium |
| 44 | Deep-link attribution | ❌ | ✅ (P1) | P1 | S | high | low |
| 45 | A/B testing | ❌ | ✅ (P2) | P2 | L | medium | low |
| 46 | Analytics events | ❓ | ✅ (P1) | P1 | M | high | — |
| **Mini App** | | | | | | | |
| 47 | Card reveal animation | ❌ | ✅ (P2) | P2 | L | medium | high |
| 48 | Journal grid | ❌ | ✅ (P2) | P2 | M | medium | high |
| 49 | Birth chart wheel | ❌ | ✅ (P3) | P3 | XL | low | medium |
| 50 | Paywall pricing card | ❌ | ✅ (P2) | P2 | M | high | medium |
| **Architecture** | | | | | | | |
| 51 | Clean Architecture (4 layers) | n/a | ✅ | P0 | L | — | — |
| 52 | Repository pattern + ports | n/a | ✅ | P0 | M | — | — |
| 53 | Streaming LLM responses | ❓ | ✅ | P0 | M | — | high |
| 54 | Rate limiting | ❓ | ✅ | P0 | S | — | medium |
| 55 | Input validation at boundaries | ❓ | ✅ | P0 | S | — | medium |
| 56 | Webhook secret validation | ❓ | ✅ | P0 | S | — | — |
| 57 | Structured logging + correlation IDs | ❓ | ✅ | P0 | S | — | — |
| 58 | Audit log (admin actions) | ❓ | ✅ | P0 | S | — | — |
| 59 | Unit + integration tests | ❓ | ✅ (P1) | P1 | M | — | — |
| 60 | Admin panel (web) | ❓ | ✅ | P0 | L | — | — |
| **Compliance** | | | | | | | |
| 61 | 18+ gating | ✅ | ✅ | P0 | S | — | — |
| 62 | GDPR: delete my data | ✅ (`/reset`) | ✅ | P0 | S | — | medium |
| 63 | GDPR: export my history | ❌ | ✅ (P1) | P1 | S | — | medium |
| 64 | Terms of service link | ✅ | ✅ | P0 | S | — | — |
| 65 | Privacy policy link | ✅ | ✅ | P0 | S | — | — |

## Scorecard

- **Competitor**: ~13 of 65 features likely present (mostly core mechanic + 18+ gating + basic compliance).
- **Sofia Phase 0**: ~45 of 65 features shipped.
- **Sofia Phase 1**: ~52 of 65.
- **Sofia Phase 4**: ~63 of 65.

## The 5 biggest competitive gaps we close (priority order)

1. **Reading history/journal (#22)** — users can't revisit past readings in the competitor. HIGH retention impact.
2. **Referral program (#31)** — cheapest acquisition (~$0.02 CAC vs $2–10 paid). HIGH growth impact.
3. **Emotional memory + return greeting (#13, #14)** — Sofia remembers you; competitor doesn't. HIGH bond/retention impact.
4. **Monetization (#26–30)** — competitor has none. HIGH revenue impact.
5. **Streak + daily ritual (#20, #21)** — habit formation. HIGH retention impact.

## What we do NOT copy

- Competitor's brand name, display name, persona name ("TaroGPT").
- Competitor's exact `/start` text or any creative copy.
- Competitor's support handle or any organizational detail.
- Competitor's specific card-count defaults or persona list.

We adopt only **UX patterns** (edit-in-place, breadcrumb, optimistic UI), **architecture principles** (button-first, FSM), and **funnel structure** (free ritual → paid interpretation) — all of which are industry best practices, not competitor IP.
