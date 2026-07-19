"""app.models — Pydantic v2 models matching the Prisma schema.

These are pure data-transfer objects; they don't talk to the DB. The
`app.db` module converts DB rows to / from these models.
"""
from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class User(BaseModel):
    """Mirrors Prisma `User` model."""

    model_config = ConfigDict(extra="ignore")

    id: str
    telegramId: str
    username: Optional[str] = None
    firstName: Optional[str] = None
    language: str = "ru"

    # Onboarding
    name: Optional[str] = None
    birthDate: Optional[datetime] = None
    birthTime: Optional[str] = None
    birthPlace: Optional[str] = None
    gender: Optional[str] = None
    ageGroup: Optional[str] = None
    zodiacSign: Optional[str] = None
    onboardingCompleted: bool = False
    onboardingStep: str = "START"

    # Currency
    crystals: int = 3

    # Subscription
    subscriptionType: Optional[str] = None
    subscriptionUntil: Optional[datetime] = None

    # Retention
    streakDays: int = 0
    lastActivityDay: Optional[datetime] = None
    lastSeenAt: Optional[datetime] = None
    lastDailyCardAt: Optional[datetime] = None
    lastFreeCardAt: Optional[datetime] = None

    # Referral
    referredById: Optional[str] = None
    referralCode: str
    referralRewardGiven: bool = False

    # Moderation
    rudenessCount: int = 0
    isBlocked: bool = False
    isAdmin: bool = False

    # Counters
    messageCount: int = 0
    dailyMessageCount: int = 0
    dailyMessageDate: Optional[datetime] = None

    # Memory
    lastTopicSummary: Optional[str] = None

    createdAt: datetime = Field(default_factory=datetime.utcnow)
    updatedAt: datetime = Field(default_factory=datetime.utcnow)


class Conversation(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    userId: str
    role: str  # "user" | "sofia"
    content: str
    emotionTag: Optional[str] = None
    tokensUsed: int = 0
    createdAt: datetime = Field(default_factory=datetime.utcnow)


class Memory(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    userId: str
    kind: str  # "fact" | "emotional"
    category: str
    content: str
    context: Optional[str] = None
    importance: int = 3
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    updatedAt: datetime = Field(default_factory=datetime.utcnow)


class Transaction(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    userId: str
    type: str  # "spend" | "add" | "admin_gift" | "referral" | "subscription" | "daily_bonus"
    amount: int
    description: Optional[str] = None
    balanceAfter: Optional[int] = None
    createdAt: datetime = Field(default_factory=datetime.utcnow)


class Reading(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    userId: str
    type: str
    question: Optional[str] = None
    cards: str  # JSON string
    interpretation: str
    cost: int = 0
    createdAt: datetime = Field(default_factory=datetime.utcnow)


class Referral(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    referrerId: str
    refereeId: str
    rewardGiven: bool = False
    createdAt: datetime = Field(default_factory=datetime.utcnow)


class AuditLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    actorId: Optional[str] = None
    action: str
    targetUserId: Optional[str] = None
    details: Optional[str] = None
    createdAt: datetime = Field(default_factory=datetime.utcnow)


class BotConfig(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    key: str
    value: str
    updatedAt: datetime = Field(default_factory=datetime.utcnow)


class Broadcast(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    adminId: str
    text: str
    sentCount: int = 0
    failedCount: int = 0
    total: int = 0
    status: str = "pending"
    createdAt: datetime = Field(default_factory=datetime.utcnow)


class BotCommand(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    type: str
    payload: str  # JSON string
    status: str = "pending"
    result: Optional[str] = None
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    startedAt: Optional[datetime] = None
    finishedAt: Optional[datetime] = None


class BotHeartbeat(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = "singleton"
    lastBeatAt: datetime = Field(default_factory=datetime.utcnow)
    pid: Optional[int] = None
    hostname: Optional[str] = None
    version: Optional[str] = None
    uptime: Optional[int] = None
    pollingMode: str = "long_polling"


# ---- Helpers ----


class Stats(BaseModel):
    """Aggregated admin stats — not a DB row."""

    totalUsers: int
    active24h: int
    onboarded: int
    totalMessages: int
    totalReadings: int
    crystalsSpent: int


class MemorySummary(BaseModel):
    """Compact memory view for /memory command."""

    facts: List[Memory] = Field(default_factory=list)
    emotional: List[Memory] = Field(default_factory=list)
