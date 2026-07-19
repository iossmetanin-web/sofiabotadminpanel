"""app.config — environment configuration, loaded once at startup.

Mirrors the TypeScript bot's `config/env.ts` — fail-fast on missing required
vars, sensible defaults for optional ones.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import List

from dotenv import load_dotenv

# Load .env if present (local dev). In production, env vars come from the host.
load_dotenv()


def _split_csv(s: str) -> List[str]:
    return [x.strip() for x in s.split(",") if x.strip()]


def _require(name: str) -> str:
    v = os.getenv(name, "").strip()
    if not v:
        raise RuntimeError(f"Environment variable {name} is required but missing/empty.")
    return v


@dataclass(frozen=True)
class Settings:
    """Typed environment configuration."""

    # --- required ---
    bot_token: str
    database_url: str
    admin_ids: List[str]
    openrouter_api_key: str

    # --- optional / behaviour ---
    log_level: str = "INFO"
    openrouter_model: str = "google/gemini-2.0-flash-exp:free"
    bot_username: str = "oracultetris_bot"
    bot_version: str = "1.0.0"

    # --- economy / pricing ---
    welcome_crystals: int = 3
    price_tarot_small: int = 1
    price_tarot_full: int = 3
    price_tarot_love: int = 2
    price_tarot_career: int = 2
    price_tarot_decision: int = 2
    price_horoscope: int = 1
    price_fate_card: int = 1
    price_today: int = 1

    # --- cooldowns ---
    daily_card_cooldown_hours: int = 20
    free_card_cooldown_hours: int = 24
    return_absence_hours: int = 20

    # --- background workers ---
    heartbeat_interval_seconds: int = 20
    command_queue_interval_seconds: int = 2

    # --- derived ---
    is_postgres: bool = field(init=False)
    sqlite_path: str = field(init=False, default="")

    def __post_init__(self) -> None:
        # DATABASE_URL can be "postgresql://..." or "file:./db/custom.db".
        url = self.database_url
        # Use object.__setattr__ because the dataclass is frozen.
        if url.startswith("postgresql://") or url.startswith("postgres://"):
            object.__setattr__(self, "is_postgres", True)
            object.__setattr__(self, "sqlite_path", "")
        elif url.startswith("file:"):
            object.__setattr__(self, "is_postgres", False)
            object.__setattr__(self, "sqlite_path", url[len("file:") :])
        else:
            # Treat anything else as a sqlite path (lenient fallback).
            object.__setattr__(self, "is_postgres", False)
            object.__setattr__(self, "sqlite_path", url)

    # --- helpers ---
    def is_admin(self, telegram_id: str | int) -> bool:
        return str(telegram_id) in self.admin_ids

    def reading_price(self, reading_type: str) -> int:
        return {
            "fate_card": self.price_fate_card,
            "tarot_small": self.price_tarot_small,
            "tarot_full": self.price_tarot_full,
            "tarot_love": self.price_tarot_love,
            "tarot_career": self.price_tarot_career,
            "tarot_decision": self.price_tarot_decision,
            "horoscope": self.price_horoscope,
            "card_of_day": 0,
            "single_card": 0,
        }.get(reading_type, 0)


def load_settings() -> Settings:
    """Build and validate Settings from the environment."""
    return Settings(
        bot_token=_require("BOT_TOKEN"),
        database_url=_require("DATABASE_URL"),
        admin_ids=_split_csv(os.getenv("ADMIN_IDS", "")),
        openrouter_api_key=_require("OPENROUTER_API_KEY"),
        log_level=os.getenv("LOG_LEVEL", "INFO").upper() or "INFO",
        openrouter_model=os.getenv("OPENROUTER_MODEL", "google/gemini-2.0-flash-exp:free"),
        bot_username=os.getenv("BOT_USERNAME", "oracultetris_bot"),
        bot_version=os.getenv("BOT_VERSION", "1.0.0"),
    )


# Module-level singleton — import as `from app.config import settings`.
settings: Settings = load_settings()
