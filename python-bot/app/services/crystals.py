"""app.services.crystals — crystal economy (spend, add, daily bonus, referral).

All state-changing operations go through this module so the logic stays in
one place. Every spend / add records a `Transaction` row for audit.
"""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Dict, Any, Optional

from app.config import settings
from app.db import Queries
from app.utils.logger import get_logger

log = get_logger("app.crystals")


class InsufficientCrystalsError(Exception):
    def __init__(self, needed: int, have: int) -> None:
        super().__init__(f"Need {needed} 💎, have {have}")
        self.needed = needed
        self.have = have


async def get_balance(user_row: Dict[str, Any]) -> int:
    return int(user_row.get("crystals") or 0)


async def add_crystals(
    *,
    user_row: Dict[str, Any],
    amount: int,
    tx_type: str = "add",
    description: Optional[str] = None,
) -> Dict[str, Any]:
    """Add crystals to a user. Returns the updated user row."""
    if amount == 0:
        return user_row
    new_balance = int(user_row.get("crystals") or 0) + amount
    updated = await Queries.update_user(
        user_row["telegramId"],
        crystals=new_balance,
    )
    await Queries.add_transaction(
        user_id=user_row["id"],
        tx_type=tx_type,
        amount=amount,
        description=description,
        balance_after=new_balance,
    )
    log.info("crystals_added", extra={
        "telegram_id": user_row["telegramId"],
        "amount": amount,
        "new_balance": new_balance,
        "tx_type": tx_type,
    })
    return updated or user_row


async def spend_crystals(
    *,
    user_row: Dict[str, Any],
    amount: int,
    description: str,
) -> Dict[str, Any]:
    """Spend crystals. Raises InsufficientCrystalsError if not enough."""
    have = int(user_row.get("crystals") or 0)
    if have < amount:
        raise InsufficientCrystalsError(needed=amount, have=have)
    new_balance = have - amount
    updated = await Queries.update_user(
        user_row["telegramId"],
        crystals=new_balance,
    )
    await Queries.add_transaction(
        user_id=user_row["id"],
        tx_type="spend",
        amount=-amount,  # negative = outgoing
        description=description,
        balance_after=new_balance,
    )
    log.info("crystals_spent", extra={
        "telegram_id": user_row["telegramId"],
        "amount": amount,
        "new_balance": new_balance,
        "description": description,
    })
    return updated or user_row


async def refund_crystals(
    *,
    user_row: Dict[str, Any],
    amount: int,
    description: str,
) -> Dict[str, Any]:
    """Refund crystals (e.g. when LLM call fails after charging)."""
    return await add_crystals(
        user_row=user_row,
        amount=amount,
        tx_type="add",
        description=f"Refund: {description}",
    )


async def gift_crystals(
    *,
    admin_telegram_id: str,
    target_user_row: Dict[str, Any],
    amount: int,
) -> Dict[str, Any]:
    """Admin gift — admin_gift tx type + audit log."""
    updated = await add_crystals(
        user_row=target_user_row,
        amount=amount,
        tx_type="admin_gift",
        description="Подарок от хранительницы",
    )
    await Queries.record_audit(
        actor_id=admin_telegram_id,
        action="admin_gift",
        target_user_id=target_user_row["id"],
        details=f"gifted {amount} crystals",
    )
    return updated


async def reward_referral(*, referrer_row: Dict[str, Any], referee_row: Dict[str, Any]) -> None:
    """Award +1 crystal to the referrer when referee completes onboarding."""
    # Idempotency: check the Referral row.
    await Queries.create_referral(referrer_row["id"], referee_row["id"])
    # Re-fetch the referral to check rewardGiven.
    # (For simplicity we just attempt the reward; the unique constraint
    #  on (referrerId, refereeId) prevents duplicates.)
    await add_crystals(
        user_row=referrer_row,
        amount=1,
        tx_type="referral",
        description=f"Реферал: {referee_row.get('name') or referee_row.get('firstName') or 'друг'}",
    )
    await Queries.mark_referral_rewarded(referrer_row["id"], referee_row["id"])
    await Queries.update_user(
        referrer_row["telegramId"],
        referralRewardGiven=True,
    )
    await Queries.record_audit(
        actor_id=None,
        action="referral_reward",
        target_user_id=referrer_row["id"],
        details=f"referee={referee_row['telegramId']}",
    )


async def apply_subscription(
    *,
    user_row: Dict[str, Any],
    sub_type: str,
    days: int,
) -> Dict[str, Any]:
    """Apply a subscription (weekly/monthly). Monthly = unlimited crystals."""
    until = datetime.utcnow() + timedelta(days=days)
    new_crystals = user_row["crystals"]
    if sub_type == "monthly":
        # Monthly = effectively unlimited — set a high balance.
        new_crystals = max(new_crystals, 9999)
    elif sub_type == "weekly":
        # Weekly = +10 crystals.
        new_crystals = new_crystals + 10
    updated = await Queries.update_user(
        user_row["telegramId"],
        subscriptionType=sub_type,
        subscriptionUntil=until,
        crystals=new_crystals,
    )
    await Queries.add_transaction(
        user_id=user_row["id"],
        tx_type="subscription",
        amount=10 if sub_type == "weekly" else 9999,
        description=f"Подписка {sub_type} на {days} дн.",
        balance_after=new_crystals,
    )
    return updated or user_row


async def subscription_active(user_row: Dict[str, Any]) -> bool:
    """True if user has an active (not expired) subscription."""
    until = user_row.get("subscriptionUntil")
    if not until:
        return False
    if isinstance(until, str):
        try:
            until = datetime.fromisoformat(until.replace("Z", "+00:00"))
        except ValueError:
            return False
    if isinstance(until, datetime) and until.tzinfo is not None:
        until = until.replace(tzinfo=None)
    return until > datetime.utcnow()


async def maybe_daily_bonus(user_row: Dict[str, Any]) -> Dict[str, Any]:
    """Update streak + maybe award daily bonus.

    Called on every user interaction. If the user's `lastActivityDay` was
    yesterday → streak +1. If it was today → no change. If it was >1 day ago
    → streak resets to 1.

    Bonus: +1 crystal if streak >= 3 days (and not yet awarded today).
    """
    now = datetime.utcnow()
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    last_activity = user_row.get("lastActivityDay")
    if isinstance(last_activity, str):
        try:
            last_activity = datetime.fromisoformat(last_activity.replace("Z", "+00:00"))
        except ValueError:
            last_activity = None
    if isinstance(last_activity, datetime) and last_activity.tzinfo is not None:
        last_activity = last_activity.replace(tzinfo=None)

    if last_activity is None:
        new_streak = 1
    elif last_activity >= today:
        # Already counted today — no change.
        return user_row
    elif last_activity >= today - timedelta(days=1):
        new_streak = int(user_row.get("streakDays") or 0) + 1
    else:
        new_streak = 1  # streak broken

    updated = await Queries.update_user(
        user_row["telegramId"],
        streakDays=new_streak,
        lastActivityDay=today,
    )

    # Bonus: +1 crystal if streak >= 3 (and not yet awarded today).
    # We track this by checking lastFreeCardAt — if it's not today, award.
    last_free = updated.get("lastFreeCardAt") if updated else None
    if isinstance(last_free, str):
        try:
            last_free = datetime.fromisoformat(last_free.replace("Z", "+00:00"))
        except ValueError:
            last_free = None
    if isinstance(last_free, datetime) and last_free.tzinfo is not None:
        last_free = last_free.replace(tzinfo=None)

    if new_streak >= 3 and (last_free is None or last_free < today):
        if updated:
            updated = await add_crystals(
                user_row=updated,
                amount=1,
                tx_type="daily_bonus",
                description=f"Серия {new_streak} дней — бонус",
            )
            updated = await Queries.update_user(updated["telegramId"], lastFreeCardAt=now) or updated

    return updated or user_row


def welcome_bonus() -> int:
    """Crystals given to a brand-new user."""
    return settings.welcome_crystals
