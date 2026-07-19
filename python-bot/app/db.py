"""app.db — async DB abstraction.

Two backends, one API:

- `asyncpg` for PostgreSQL (production: Neon / Render Postgres / Fly Postgres)
- `aiosqlite` for local SQLite (default `file:./db/custom.db`)

The Prisma schema is the source of truth. The Next.js admin panel and this
bot share the same DB. Prisma stores columns with camelCase names, so SQL
queries use double-quoted identifiers (`"telegramId"`) which work on both
SQLite and Postgres.

This module exposes a singleton `Database` instance — import as
`from app.db import db`.
"""
from __future__ import annotations

import json
import os
import secrets
from datetime import datetime
from typing import Any, AsyncIterator, Dict, List, Optional, Tuple

import cuid as _cuid

from app.config import settings
from app.utils.logger import get_logger

log = get_logger("app.db")


# ---------- ID generation (cuid-compatible) ----------


def new_id() -> str:
    """Generate a cuid (compatible with Prisma's cuid() default)."""
    try:
        return _cuid.cuid()
    except Exception:
        # Fallback — should never happen, but never crash the bot.
        return "c" + secrets.token_hex(12)


def new_referral_code() -> str:
    """8-char uppercase hex — short, shareable, unique enough for our scale."""
    return secrets.token_bytes(4).hex().upper()


# ---------- Backend abstraction ----------


class Database:
    """Unified async DB API.

    Concrete subclass chosen at startup based on `DATABASE_URL`.
    """

    async def connect(self) -> None: ...
    async def disconnect(self) -> None: ...

    # --- low-level ---
    async def fetchrow(self, sql: str, *args: Any) -> Optional[Dict[str, Any]]: ...
    async def fetch(self, sql: str, *args: Any) -> List[Dict[str, Any]]: ...
    async def fetchval(self, sql: str, *args: Any) -> Any: ...
    async def execute(self, sql: str, *args: Any) -> str: ...
    async def executemany(self, sql: str, args_list: List[Tuple[Any, ...]]) -> None: ...

    # --- schema bootstrap (local dev only) ---
    async def ensure_schema(self) -> None: ...


class PostgresDatabase(Database):
    """asyncpg-backed Postgres implementation."""

    def __init__(self, url: str) -> None:
        self._url = url
        self._pool = None  # asyncpg.Pool

    async def connect(self) -> None:
        import asyncpg

        # asyncpg wants postgresql:// (not postgres://)
        url = self._url
        if url.startswith("postgres://"):
            url = "postgresql://" + url[len("postgres://") :]

        self._pool = await asyncpg.create_pool(
            dsn=url,
            min_size=1,
            max_size=10,
            command_timeout=30,
        )
        # Sanity check.
        async with self._pool.acquire() as conn:
            await conn.fetchval("SELECT 1")
        log.info("postgres_pool_connected", extra={"url_redacted": url.split("@")[-1]})

    async def disconnect(self) -> None:
        if self._pool:
            await self._pool.close()
            self._pool = None
        log.info("postgres_pool_closed")

    async def fetchrow(self, sql: str, *args: Any) -> Optional[Dict[str, Any]]:
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(sql, *args)
            return dict(row) if row else None

    async def fetch(self, sql: str, *args: Any) -> List[Dict[str, Any]]:
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(sql, *args)
            return [dict(r) for r in rows]

    async def fetchval(self, sql: str, *args: Any) -> Any:
        async with self._pool.acquire() as conn:
            return await conn.fetchval(sql, *args)

    async def execute(self, sql: str, *args: Any) -> str:
        async with self._pool.acquire() as conn:
            return await conn.execute(sql, *args)

    async def execute_returning_rowcount(self, sql: str, *args: Any) -> int:
        """Execute UPDATE/DELETE and return the number of affected rows."""
        status = await self.execute(sql, *args)
        # asyncpg status looks like 'UPDATE 5' / 'DELETE 0' / 'INSERT 0 1'.
        try:
            return int(status.split()[-1])
        except (ValueError, IndexError):
            return 0

    async def executemany(self, sql: str, args_list: List[Tuple[Any, ...]]) -> None:
        async with self._pool.acquire() as conn:
            await conn.executemany(sql, args_list)

    async def ensure_schema(self) -> None:
        # In production we rely on Prisma migrations (`npx prisma migrate deploy`).
        pass


class SqliteDatabase(Database):
    """aiosqlite-backed local-dev implementation.

    Auto-creates the schema on first run if the file is missing/empty.
    """

    def __init__(self, path: str) -> None:
        self._path = path
        self._conn = None  # aiosqlite.Connection

    async def connect(self) -> None:
        import aiosqlite

        os.makedirs(os.path.dirname(os.path.abspath(self._path)) or ".", exist_ok=True)
        self._conn = await aiosqlite.connect(self._path)
        self._conn.row_factory = aiosqlite.Row
        await self._conn.execute("PRAGMA journal_mode=WAL;")
        await self._conn.execute("PRAGMA foreign_keys=ON;")
        await self._conn.commit()
        await self.ensure_schema()
        log.info("sqlite_connected", extra={"path": self._path})

    async def disconnect(self) -> None:
        if self._conn:
            await self._conn.close()
            self._conn = None
        log.info("sqlite_closed")

    async def fetchrow(self, sql: str, *args: Any) -> Optional[Dict[str, Any]]:
        # Translate $1, $2 → ?, ?, ...
        sqlite_sql, sqlite_args = _to_sqlite(sql, args)
        cur = await self._conn.execute(sqlite_sql, sqlite_args)
        row = await cur.fetchone()
        await cur.close()
        return dict(row) if row else None

    async def fetch(self, sql: str, *args: Any) -> List[Dict[str, Any]]:
        sqlite_sql, sqlite_args = _to_sqlite(sql, args)
        cur = await self._conn.execute(sqlite_sql, sqlite_args)
        rows = await cur.fetchall()
        await cur.close()
        return [dict(r) for r in rows]

    async def fetchval(self, sql: str, *args: Any) -> Any:
        sqlite_sql, sqlite_args = _to_sqlite(sql, args)
        cur = await self._conn.execute(sqlite_sql, sqlite_args)
        row = await cur.fetchone()
        await cur.close()
        return row[0] if row else None

    async def execute(self, sql: str, *args: Any) -> str:
        """Execute a statement. Returns:
        - For asyncpg: status string like 'UPDATE 1' / 'INSERT 0 1'.
        - For aiosqlite: f'EXECUTE {rowcount}' for UPDATE/DELETE/INSERT.
        """
        sqlite_sql, sqlite_args = _to_sqlite(sql, args)
        cur = await self._conn.execute(sqlite_sql, sqlite_args)
        await self._conn.commit()
        rowcount = cur.rowcount if cur.rowcount is not None else 0
        await cur.close()
        # Mimic asyncpg's "UPDATE 1" / "INSERT 0 1" style so claim_command
        # can parse the trailing number uniformly.
        return f"EXECUTE {rowcount}"

    async def execute_returning_rowcount(self, sql: str, *args: Any) -> int:
        """Execute UPDATE/DELETE and return the number of affected rows."""
        sqlite_sql, sqlite_args = _to_sqlite(sql, args)
        cur = await self._conn.execute(sqlite_sql, sqlite_args)
        await self._conn.commit()
        rowcount = cur.rowcount if cur.rowcount is not None else 0
        await cur.close()
        return rowcount

    async def executemany(self, sql: str, args_list: List[Tuple[Any, ...]]) -> None:
        sqlite_sql, _ = _to_sqlite(sql, ())
        converted = [_to_sqlite(sql, list(args))[1] for args in args_list]
        await self._conn.executemany(sqlite_sql, converted)
        await self._conn.commit()

    async def ensure_schema(self) -> None:
        # Mirror of prisma/schema.prisma. Idempotent.
        statements = _SQLITE_SCHEMA.split(";")
        for stmt in statements:
            stmt = stmt.strip()
            if not stmt:
                continue
            try:
                await self._conn.execute(stmt)
            except Exception as e:
                # CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS are safe
                # to repeat; anything else should be logged but not fatal.
                log.warning("sqlite_schema_stmt_failed", extra={"err": str(e), "stmt": stmt[:120]})
        await self._conn.commit()


def _to_sqlite(sql: str, args: Tuple[Any, ...] | List[Any]) -> Tuple[str, List[Any]]:
    """Convert $1/$2 placeholders → ? placeholders and unwrap args."""
    out = []
    cur = 0
    converted_sql_chars: List[str] = []
    args_list = list(args)
    n = 0
    while cur < len(sql):
        ch = sql[cur]
        if ch == "$" and cur + 1 < len(sql) and sql[cur + 1].isdigit():
            # consume the digits
            end = cur + 1
            while end < len(sql) and sql[end].isdigit():
                end += 1
            # placeholder number = int(sql[cur+1:end])
            idx = int(sql[cur + 1 : end]) - 1
            if idx < len(args_list):
                converted_sql_chars.append("?")
                out.append(args_list[idx])
            cur = end
        else:
            converted_sql_chars.append(ch)
            cur += 1
    n = 0  # noqa: F841
    return "".join(converted_sql_chars), out


# ---------- Singleton factory ----------


def _make_db() -> Database:
    if settings.is_postgres:
        return PostgresDatabase(settings.database_url)
    return SqliteDatabase(settings.sqlite_path)


db: Database = _make_db()


# ---------- High-level query helpers ----------


class Queries:
    """Typed helpers built on top of `db`.

    These are the ONLY methods the rest of the app should use. Keeping them
    in one place makes it easy to add caching, audit, or refactoring later.
    """

    # ----- Users -----

    @staticmethod
    async def find_user_by_telegram_id(telegram_id: str | int) -> Optional[Dict[str, Any]]:
        return await db.fetchrow(
            'SELECT * FROM "User" WHERE "telegramId" = $1', str(telegram_id)
        )

    @staticmethod
    async def find_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
        return await db.fetchrow('SELECT * FROM "User" WHERE id = $1', user_id)

    @staticmethod
    async def find_user_by_username(username: str) -> Optional[Dict[str, Any]]:
        return await db.fetchrow(
            'SELECT * FROM "User" WHERE username = $1 LIMIT 1', username
        )

    @staticmethod
    async def find_user_by_referral_code(code: str) -> Optional[Dict[str, Any]]:
        return await db.fetchrow(
            'SELECT * FROM "User" WHERE "referralCode" = $1', code
        )

    @staticmethod
    async def create_user(
        *,
        telegram_id: str | int,
        username: Optional[str] = None,
        first_name: Optional[str] = None,
        referral_code: str,
        referred_by_referral_code: Optional[str] = None,
        welcome_crystals: int = 3,
        is_admin: bool = False,
    ) -> Dict[str, Any]:
        # Resolve referrer (if any).
        referred_by_id: Optional[str] = None
        if referred_by_referral_code:
            ref = await Queries.find_user_by_referral_code(referred_by_referral_code)
            if ref:
                referred_by_id = ref["id"]
        new_user_id = new_id()
        now = datetime.utcnow()
        await db.execute(
            """
            INSERT INTO "User" (
                id, "telegramId", username, "firstName", language,
                "referralCode", "referredById", crystals, "isAdmin",
                "onboardingStep", "onboardingCompleted", "lastSeenAt",
                "createdAt", "updatedAt"
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            """,
            new_user_id,
            str(telegram_id),
            username,
            first_name,
            "ru",
            referral_code,
            referred_by_id,
            welcome_crystals,
            is_admin,
            "START",
            False,
            now,
            now,
            now,
        )
        # Welcome bonus transaction.
        await Queries.add_transaction(
            user_id=new_user_id,
            tx_type="add",
            amount=welcome_crystals,
            description="Приветственный бонус",
            balance_after=welcome_crystals,
        )
        return await Queries.find_user_by_id(new_user_id)  # type: ignore[return-value]

    @staticmethod
    async def update_user(telegram_id: str | int, **fields: Any) -> Optional[Dict[str, Any]]:
        """Update allowed scalar fields on a user.

        Only known fields are written; unknown keys are silently ignored.
        Dates are auto-converted from ISO string to datetime.
        """
        allowed = {
            "username", "firstName", "name", "birthDate", "birthTime", "birthPlace",
            "gender", "ageGroup", "zodiacSign", "onboardingCompleted", "onboardingStep",
            "crystals", "subscriptionType", "subscriptionUntil", "streakDays",
            "lastActivityDay", "lastSeenAt", "lastDailyCardAt", "lastFreeCardAt",
            "rudenessCount", "isBlocked", "isAdmin", "messageCount",
            "dailyMessageCount", "dailyMessageDate", "lastTopicSummary", "language",
        }
        set_parts: List[str] = []
        values: List[Any] = []
        i = 1
        for k, v in fields.items():
            if k not in allowed:
                continue
            if v is None:
                set_parts.append(f'"{k}" = NULL')
                continue
            if k in ("birthDate", "subscriptionUntil", "lastActivityDay", "lastSeenAt",
                     "lastDailyCardAt", "lastFreeCardAt", "dailyMessageDate") and isinstance(v, str):
                try:
                    v = datetime.fromisoformat(v.replace("Z", "+00:00"))
                except ValueError:
                    pass
            if k in ("birthDate", "subscriptionUntil", "lastActivityDay", "lastSeenAt",
                     "lastDailyCardAt", "lastFreeCardAt", "dailyMessageDate"):
                # Normalise to naive UTC for cross-DB compat.
                if isinstance(v, datetime):
                    if v.tzinfo is not None:
                        v = v.astimezone().replace(tzinfo=None)
            set_parts.append(f'"{k}" = ${i}')
            values.append(v)
            i += 1
        if not set_parts:
            return await Queries.find_user_by_telegram_id(telegram_id)
        set_parts.append('"updatedAt" = $' + str(i))
        values.append(datetime.utcnow())
        i += 1
        values.append(str(telegram_id))
        sql = f'UPDATE "User" SET {", ".join(set_parts)} WHERE "telegramId" = ${i}'
        await db.execute(sql, *values)
        return await Queries.find_user_by_telegram_id(telegram_id)

    @staticmethod
    async def set_user_state(telegram_id: str | int, state: str) -> None:
        await Queries.update_user(telegram_id, onboardingStep=state)

    @staticmethod
    async def delete_user(telegram_id: str | int) -> None:
        row = await Queries.find_user_by_telegram_id(telegram_id)
        if not row:
            return
        await db.execute('DELETE FROM "User" WHERE id = $1', row["id"])

    @staticmethod
    async def count_users() -> int:
        v = await db.fetchval('SELECT COUNT(*) FROM "User"')
        return int(v or 0)

    @staticmethod
    async def count_active_since(since: datetime) -> int:
        v = await db.fetchval(
            'SELECT COUNT(*) FROM "User" WHERE "lastSeenAt" >= $1', since
        )
        return int(v or 0)

    @staticmethod
    async def count_onboarded() -> int:
        v = await db.fetchval(
            'SELECT COUNT(*) FROM "User" WHERE "onboardingCompleted" = TRUE'
        )
        return int(v or 0)

    @staticmethod
    async def list_users_paginated(offset: int, limit: int) -> List[Dict[str, Any]]:
        return await db.fetch(
            'SELECT * FROM "User" ORDER BY "createdAt" DESC OFFSET $1 LIMIT $2',
            offset,
            limit,
        )

    @staticmethod
    async def list_users_for_broadcast(limit: int = 500) -> List[Dict[str, Any]]:
        return await db.fetch(
            'SELECT * FROM "User" WHERE "isBlocked" = FALSE AND "onboardingCompleted" = TRUE LIMIT $1',
            limit,
        )

    # ----- Conversations -----

    @staticmethod
    async def save_conversation(
        user_id: str, role: str, content: str, emotion_tag: Optional[str] = None
    ) -> None:
        await db.execute(
            """
            INSERT INTO "Conversation" (id, "userId", role, content, "emotionTag", "createdAt")
            VALUES ($1, $2, $3, $4, $5, $6)
            """,
            new_id(),
            user_id,
            role,
            content[:4000],
            emotion_tag,
            datetime.utcnow(),
        )

    @staticmethod
    async def recent_conversations(user_id: str, limit: int = 10) -> List[Dict[str, Any]]:
        return await db.fetch(
            'SELECT * FROM "Conversation" WHERE "userId" = $1 ORDER BY "createdAt" DESC LIMIT $2',
            user_id,
            limit,
        )

    @staticmethod
    async def count_conversations() -> int:
        v = await db.fetchval('SELECT COUNT(*) FROM "Conversation"')
        return int(v or 0)

    # ----- Memory -----

    @staticmethod
    async def save_memory(
        *,
        user_id: str,
        kind: str,
        category: str,
        content: str,
        context: Optional[str] = None,
        importance: int = 3,
    ) -> None:
        now = datetime.utcnow()
        # Upsert on the unique (userId, kind, category, content) constraint.
        # SQLite supports ON CONFLICT; Postgres too. We use a portable approach:
        # try insert; on failure try update.
        try:
            await db.execute(
                """
                INSERT INTO "Memory" (id, "userId", kind, category, content, context, importance, "createdAt", "updatedAt")
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                """,
                new_id(),
                user_id,
                kind,
                category,
                content[:1000],
                context,
                importance,
                now,
                now,
            )
        except Exception:
            await db.execute(
                """
                UPDATE "Memory" SET "updatedAt" = $1, importance = $2
                WHERE "userId" = $3 AND kind = $4 AND category = $5 AND content = $6
                """,
                now,
                importance,
                user_id,
                kind,
                category,
                content[:1000],
            )

    @staticmethod
    async def list_memories(user_id: str) -> List[Dict[str, Any]]:
        return await db.fetch(
            'SELECT * FROM "Memory" WHERE "userId" = $1 ORDER BY importance DESC, "updatedAt" DESC',
            user_id,
        )

    @staticmethod
    async def delete_user_memories(user_id: str) -> None:
        await db.execute('DELETE FROM "Memory" WHERE "userId" = $1', user_id)

    # ----- Transactions -----

    @staticmethod
    async def add_transaction(
        *,
        user_id: str,
        tx_type: str,
        amount: int,
        description: Optional[str] = None,
        balance_after: Optional[int] = None,
    ) -> None:
        await db.execute(
            """
            INSERT INTO "Transaction" (id, "userId", type, amount, description, "balanceAfter", "createdAt")
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            """,
            new_id(),
            user_id,
            tx_type,
            amount,
            description,
            balance_after,
            datetime.utcnow(),
        )

    @staticmethod
    async def sum_crystals_spent() -> int:
        v = await db.fetchval(
            'SELECT COALESCE(SUM(amount), 0) FROM "Transaction" WHERE type IN ($1, $2)',
            "spend",
            "spend",
        )
        # asyncpg returns Decimal for SUM; sqlite returns int. Normalise.
        try:
            return int(v or 0)
        except (TypeError, ValueError):
            return 0

    # ----- Readings -----

    @staticmethod
    async def save_reading(
        *,
        user_id: str,
        reading_type: str,
        question: Optional[str],
        cards_json: str,
        interpretation: str,
        cost: int = 0,
    ) -> str:
        reading_id = new_id()
        await db.execute(
            """
            INSERT INTO "Reading" (id, "userId", type, question, cards, interpretation, cost, "createdAt")
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            """,
            reading_id,
            user_id,
            reading_type,
            question,
            cards_json,
            interpretation,
            cost,
            datetime.utcnow(),
        )
        return reading_id

    @staticmethod
    async def list_readings(user_id: str, limit: int = 5, offset: int = 0) -> List[Dict[str, Any]]:
        return await db.fetch(
            'SELECT * FROM "Reading" WHERE "userId" = $1 ORDER BY "createdAt" DESC LIMIT $2 OFFSET $3',
            user_id,
            limit,
            offset,
        )

    @staticmethod
    async def count_readings(user_id: Optional[str] = None) -> int:
        if user_id:
            v = await db.fetchval(
                'SELECT COUNT(*) FROM "Reading" WHERE "userId" = $1', user_id
            )
        else:
            v = await db.fetchval('SELECT COUNT(*) FROM "Reading"')
        return int(v or 0)

    # ----- Referrals -----

    @staticmethod
    async def create_referral(referrer_id: str, referee_id: str) -> None:
        try:
            await db.execute(
                """
                INSERT INTO "Referral" (id, "referrerId", "refereeId", "rewardGiven", "createdAt")
                VALUES ($1, $2, $3, FALSE, $4)
                """,
                new_id(),
                referrer_id,
                referee_id,
                datetime.utcnow(),
            )
        except Exception:
            # Unique constraint — already exists. Ignore.
            pass

    @staticmethod
    async def mark_referral_rewarded(referrer_id: str, referee_id: str) -> None:
        await db.execute(
            'UPDATE "Referral" SET "rewardGiven" = TRUE WHERE "referrerId" = $1 AND "refereeId" = $2',
            referrer_id,
            referee_id,
        )

    @staticmethod
    async def count_referrals_made(referrer_id: str) -> int:
        v = await db.fetchval(
            'SELECT COUNT(*) FROM "Referral" WHERE "referrerId" = $1', referrer_id
        )
        return int(v or 0)

    # ----- AuditLog -----

    @staticmethod
    async def record_audit(
        *,
        actor_id: Optional[str],
        action: str,
        target_user_id: Optional[str] = None,
        details: Optional[str] = None,
    ) -> None:
        await db.execute(
            """
            INSERT INTO "AuditLog" (id, "actorId", action, "targetUserId", details, "createdAt")
            VALUES ($1, $2, $3, $4, $5, $6)
            """,
            new_id(),
            actor_id,
            action,
            target_user_id,
            details,
            datetime.utcnow(),
        )

    # ----- BotConfig -----

    @staticmethod
    async def get_config(key: str, default: Optional[str] = None) -> Optional[str]:
        row = await db.fetchrow(
            'SELECT value FROM "BotConfig" WHERE key = $1', key
        )
        return row["value"] if row else default

    @staticmethod
    async def set_config(key: str, value: str) -> None:
        now = datetime.utcnow()
        try:
            await db.execute(
                """
                INSERT INTO "BotConfig" (id, key, value, "updatedAt")
                VALUES ($1, $2, $3, $4)
                """,
                key,
                key,
                value,
                now,
            )
        except Exception:
            await db.execute(
                'UPDATE "BotConfig" SET value = $1, "updatedAt" = $2 WHERE key = $3',
                value,
                now,
                key,
            )

    @staticmethod
    async def all_config() -> Dict[str, str]:
        rows = await db.fetch('SELECT key, value FROM "BotConfig"')
        return {r["key"]: r["value"] for r in rows}

    # ----- Broadcasts -----

    @staticmethod
    async def create_broadcast(admin_id: str, text: str, total: int) -> str:
        bc_id = new_id()
        await db.execute(
            """
            INSERT INTO "Broadcast" (id, "adminId", text, "sentCount", "failedCount", total, status, "createdAt")
            VALUES ($1, $2, $3, 0, 0, $4, 'sending', $5)
            """,
            bc_id,
            admin_id,
            text,
            total,
            datetime.utcnow(),
        )
        return bc_id

    @staticmethod
    async def mark_broadcast_sent(broadcast_id: str, sent: int, failed: int) -> None:
        await db.execute(
            'UPDATE "Broadcast" SET "sentCount" = $1, "failedCount" = $2, status = $3 WHERE id = $4',
            sent,
            failed,
            "done",
            broadcast_id,
        )

    # ----- BotCommand queue -----

    @staticmethod
    async def fetch_pending_commands(limit: int = 10) -> List[Dict[str, Any]]:
        return await db.fetch(
            """
            SELECT * FROM "BotCommand"
            WHERE status = 'pending'
            ORDER BY "createdAt" ASC
            LIMIT $1
            """,
            limit,
        )

    @staticmethod
    async def claim_command(command_id: str) -> bool:
        """Atomically mark a command as 'processing'.

        Returns True if we won the claim (caller should execute).
        """
        now = datetime.utcnow()
        # Single-statement conditional update — atomic.
        rowcount = await db.execute_returning_rowcount(
            """
            UPDATE "BotCommand"
            SET status = 'processing', "startedAt" = $1
            WHERE id = $2 AND status = 'pending'
            """,
            now,
            command_id,
        )
        return rowcount > 0

    @staticmethod
    async def finish_command(
        command_id: str, status: str, result: Optional[Dict[str, Any]] = None
    ) -> None:
        await db.execute(
            """
            UPDATE "BotCommand"
            SET status = $1, result = $2, "finishedAt" = $3
            WHERE id = $4
            """,
            status,
            json.dumps(result) if result is not None else None,
            datetime.utcnow(),
            command_id,
        )

    # ----- BotHeartbeat -----

    @staticmethod
    async def upsert_heartbeat(
        *, pid: int, hostname: str, version: str, uptime: int, polling_mode: str = "long_polling"
    ) -> None:
        now = datetime.utcnow()
        try:
            await db.execute(
                """
                INSERT INTO "BotHeartbeat" (id, "lastBeatAt", pid, hostname, version, uptime, "pollingMode")
                VALUES ('singleton', $1, $2, $3, $4, $5, $6)
                """,
                now,
                pid,
                hostname,
                version,
                uptime,
                polling_mode,
            )
        except Exception:
            await db.execute(
                """
                UPDATE "BotHeartbeat"
                SET "lastBeatAt" = $1, pid = $2, hostname = $3, version = $4,
                    uptime = $5, "pollingMode" = $6
                WHERE id = 'singleton'
                """,
                now,
                pid,
                hostname,
                version,
                uptime,
                polling_mode,
            )

    @staticmethod
    async def get_heartbeat() -> Optional[Dict[str, Any]]:
        return await db.fetchrow('SELECT * FROM "BotHeartbeat" WHERE id = $1', "singleton")


# ---------- SQLite schema (mirrors prisma/schema.prisma) ----------

_SQLITE_SCHEMA = """
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "telegramId" TEXT NOT NULL UNIQUE,
    "username" TEXT,
    "firstName" TEXT,
    "language" TEXT NOT NULL DEFAULT 'ru',
    "name" TEXT,
    "birthDate" DATETIME,
    "birthTime" TEXT,
    "birthPlace" TEXT,
    "gender" TEXT,
    "ageGroup" TEXT,
    "zodiacSign" TEXT,
    "onboardingCompleted" BOOLEAN NOT NULL DEFAULT FALSE,
    "onboardingStep" TEXT NOT NULL DEFAULT 'START',
    "crystals" INTEGER NOT NULL DEFAULT 3,
    "subscriptionType" TEXT,
    "subscriptionUntil" DATETIME,
    "streakDays" INTEGER NOT NULL DEFAULT 0,
    "lastActivityDay" DATETIME,
    "lastSeenAt" DATETIME,
    "lastDailyCardAt" DATETIME,
    "lastFreeCardAt" DATETIME,
    "referredById" TEXT,
    "referralCode" TEXT NOT NULL UNIQUE,
    "referralRewardGiven" BOOLEAN NOT NULL DEFAULT FALSE,
    "rudenessCount" INTEGER NOT NULL DEFAULT 0,
    "isBlocked" BOOLEAN NOT NULL DEFAULT FALSE,
    "isAdmin" BOOLEAN NOT NULL DEFAULT FALSE,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "dailyMessageCount" INTEGER NOT NULL DEFAULT 0,
    "dailyMessageDate" DATETIME,
    "lastTopicSummary" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "User.username_index" ON "User"("username");
CREATE INDEX IF NOT EXISTS "User.referredById_index" ON "User"("referredById");
CREATE INDEX IF NOT EXISTS "User.lastSeenAt_index" ON "User"("lastSeenAt");
CREATE INDEX IF NOT EXISTS "User.subscriptionUntil_index" ON "User"("subscriptionUntil");
CREATE INDEX IF NOT EXISTS "User.onboardingCompleted_index" ON "User"("onboardingCompleted");

CREATE TABLE IF NOT EXISTS "Conversation" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "emotionTag" TEXT,
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "Conversation.userId_createdAt_index" ON "Conversation"("userId", "createdAt");

CREATE TABLE IF NOT EXISTS "Memory" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "context" TEXT,
    "importance" INTEGER NOT NULL DEFAULT 3,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
    UNIQUE ("userId", "kind", "category", "content")
);
CREATE INDEX IF NOT EXISTS "Memory.userId_importance_index" ON "Memory"("userId", "importance");

CREATE TABLE IF NOT EXISTS "Transaction" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "description" TEXT,
    "balanceAfter" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "Transaction.userId_createdAt_index" ON "Transaction"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "Transaction.type_createdAt_index" ON "Transaction"("type", "createdAt");

CREATE TABLE IF NOT EXISTS "Reading" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "question" TEXT,
    "cards" TEXT NOT NULL,
    "interpretation" TEXT NOT NULL,
    "cost" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "Reading.userId_createdAt_index" ON "Reading"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "Reading.type_createdAt_index" ON "Reading"("type", "createdAt");

CREATE TABLE IF NOT EXISTS "Referral" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "referrerId" TEXT NOT NULL,
    "refereeId" TEXT NOT NULL,
    "rewardGiven" BOOLEAN NOT NULL DEFAULT FALSE,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("referrerId") REFERENCES "User"("id"),
    FOREIGN KEY ("refereeId") REFERENCES "User"("id"),
    UNIQUE ("referrerId", "refereeId")
);

CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "targetUserId" TEXT,
    "details" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("actorId") REFERENCES "User"("id")
);

CREATE TABLE IF NOT EXISTS "BotConfig" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "key" TEXT NOT NULL UNIQUE,
    "value" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Broadcast" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "adminId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "BotCommand" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "type" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "result" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" DATETIME,
    "finishedAt" DATETIME
);
CREATE INDEX IF NOT EXISTS "BotCommand.status_createdAt_index" ON "BotCommand"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "BotCommand.type_status_index" ON "BotCommand"("type", "status");

CREATE TABLE IF NOT EXISTS "BotHeartbeat" (
    "id" TEXT PRIMARY KEY NOT NULL DEFAULT 'singleton',
    "lastBeatAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pid" INTEGER,
    "hostname" TEXT,
    "version" TEXT,
    "uptime" INTEGER,
    "pollingMode" TEXT NOT NULL DEFAULT 'long_polling'
);
CREATE INDEX IF NOT EXISTS "BotHeartbeat.lastBeatAt_index" ON "BotHeartbeat"("lastBeatAt");
"""
