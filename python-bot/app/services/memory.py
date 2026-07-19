"""app.services.memory — user memory (facts + emotional context).

Memory categories match the Prisma `Memory` model:
- fact categories: pain | relationship | work | family | goal | fear | promise | personality | health
- emotional categories: main_pain | loved_one | promise | unfinished_question | life_event | fear | goal | breakthrough
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from app.db import Queries
from app.services.ai import ai, LLMError
from app.utils.logger import get_logger

log = get_logger("app.memory")

FACT_CATEGORIES = {
    "pain", "relationship", "work", "family", "goal", "fear", "promise",
    "personality", "health",
}
EMOTIONAL_CATEGORIES = {
    "main_pain", "loved_one", "promise", "unfinished_question", "life_event",
    "fear", "goal", "breakthrough",
}

FACT_CATEGORY_LABELS_RU = {
    "pain": "Боль",
    "relationship": "Отношения",
    "work": "Дело",
    "family": "Семья",
    "goal": "Цель",
    "fear": "Страх",
    "promise": "Обещание",
    "personality": "Характер",
    "health": "Здоровье",
}
EMOTIONAL_CATEGORY_LABELS_RU = {
    "main_pain": "Главная боль",
    "loved_one": "Близкий человек",
    "promise": "Обещание себе",
    "unfinished_question": "Незакрытый вопрос",
    "life_event": "Событие жизни",
    "fear": "Страх",
    "goal": "Цель",
    "breakthrough": "Прорыв",
}


async def get_user_memory(user_id: str) -> List[Dict[str, Any]]:
    return await Queries.list_memories(user_id)


async def extract_and_store(
    *, user_row: Dict[str, Any], recent_dialogue: str
) -> Optional[str]:
    """Run LLM extraction on a recent dialogue and store the results.

    Returns the new `topic_summary` (or None).
    """
    if not recent_dialogue.strip():
        return None
    try:
        data = await ai.memory_extract(recent_dialogue)
    except Exception as e:
        log.warning("memory_extract_error", extra={"err": str(e)})
        return None

    if not isinstance(data, dict):
        return None

    facts = data.get("facts") or []
    emotional = data.get("emotional") or []
    topic_summary = data.get("topic_summary") or ""

    for f in facts:
        if not isinstance(f, dict):
            continue
        cat = f.get("category")
        content = f.get("content")
        if cat in FACT_CATEGORIES and content:
            importance = max(1, min(5, int(f.get("importance") or 3)))
            await Queries.save_memory(
                user_id=user_row["id"],
                kind="fact",
                category=cat,
                content=str(content)[:1000],
                importance=importance,
            )
    for e in emotional:
        if not isinstance(e, dict):
            continue
        cat = e.get("category")
        content = e.get("content")
        if cat in EMOTIONAL_CATEGORIES and content:
            importance = max(1, min(5, int(e.get("importance") or 3)))
            await Queries.save_memory(
                user_id=user_row["id"],
                kind="emotional",
                category=cat,
                content=str(content)[:1000],
                importance=importance,
            )

    if topic_summary and isinstance(topic_summary, str):
        await Queries.update_user(user_row["telegramId"], lastTopicSummary=topic_summary[:200])

    return topic_summary if topic_summary else None


async def build_context_for_llm(user_row: Dict[str, Any], limit: int = 10) -> str:
    """Build a short memory context string for the LLM prompt.

    Only the highest-importance memories are included, to keep token usage low.
    """
    memories = await get_user_memory(user_row["id"])
    if not memories:
        return ""
    top = sorted(memories, key=lambda m: m.get("importance", 3), reverse=True)[:limit]
    lines: List[str] = []
    for m in top:
        label = (
            FACT_CATEGORY_LABELS_RU.get(m["category"])
            or EMOTIONAL_CATEGORY_LABELS_RU.get(m["category"])
            or m["category"]
        )
        lines.append(f"- {label}: {m['content']}")
    return "\n".join(lines)


async def format_memory_for_user(user_row: Dict[str, Any]) -> str:
    """Render the user's memory as a friendly text block for /memory command."""
    memories = await get_user_memory(user_row["id"])
    if not memories:
        return ("Я ещё ничего о тебе не запомнила. Поговори со мной — и я начну "
                "хранить то, что важно. 🌙")

    facts = [m for m in memories if m["kind"] == "fact"]
    emotional = [m for m in memories if m["kind"] == "emotional"]

    parts: List[str] = ["📓 <b>Что я помню о тебе</b>\n"]
    if facts:
        parts.append("<b>Факты:</b>")
        for m in facts:
            label = FACT_CATEGORY_LABELS_RU.get(m["category"], m["category"])
            parts.append(f"  • {label}: {m['content']}")
    if emotional:
        parts.append("\n<b>Эмоциональные моменты:</b>")
        for m in emotional:
            label = EMOTIONAL_CATEGORY_LABELS_RU.get(m["category"], m["category"])
            parts.append(f"  • {label}: {m['content']}")
    if user_row.get("lastTopicSummary"):
        parts.append(f"\n<b>Последняя тема:</b> {user_row['lastTopicSummary']}")
    parts.append("\n\nЕсли хочешь, чтобы я забыла что-то — попроси в чате. 🌙")
    return "\n".join(parts)


async def delete_all(user_id: str) -> None:
    await Queries.delete_user_memories(user_id)
