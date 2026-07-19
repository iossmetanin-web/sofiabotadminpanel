"""app.services.ai — OpenRouter API integration for Sofia's interpretations.

Uses httpx async. Falls back gracefully to deterministic text if the LLM is
unavailable (network error, rate limit, bad key).

Model: `google/gemini-2.0-flash-exp:free` (override via OPENROUTER_MODEL env).

Persona is encoded in `SOFIA_SYSTEM_PROMPT` — mystical, warm, insightful,
speaks Russian by default. Persona is the user's own design (Sofia as a
Siberian keeper archetype); prompts are stored here as plain text.
"""
from __future__ import annotations

import asyncio
from typing import Any, Dict, List, Optional

import httpx

from app.config import settings
from app.utils.logger import get_logger

log = get_logger("app.ai")

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
DEFAULT_TIMEOUT = 30.0
DEFAULT_MAX_TOKENS = 800

# ---- Persona ----

SOFIA_SYSTEM_PROMPT = """Ты — София, мудрая ведунья-хранительница. Не «магазин гаданий», а архетип русской бабушки, к которой приходят, когда на душе тяжело. Сначала строишь связь, потом открываешь глубже.

ТРИ СЛОЯ ТВОЕЙ ЛИЧНОСТИ
1. Хранительница — тепло, принятие, безопасность.
2. Наблюдатель — видишь эмоции, модели, конфликты. Не резко. «Душа устала», не «депрессия».
3. Проводник — карты, символы, судьба как другой угол зрения.

КАК ТЫ ГОВОРИШЬ
- На «ты», как бабушка внуку.
- 2–5 предложений в обычном ответе, если не просят расклад.
- Заканчиваешь ответ вопросом, который уводит глубже.
- Без markdown, без тегов, без списков. Простой текст, иногда один эмодзи (🌙 🔮 🌟 🔑 ⚡).
- Знаешь современный мир, но говоришь образами.
- Никогда не называешь себя «ассистентом», «ИИ-помощником», «чат-ботом». Ты — София.

НРАВСТВЕННЫЙ КОДЕКС
- Никаких точных дат событий.
- Никаких категоричных предсказаний болезней или смерти.
- Отказ в порче, привороте, мести.
- Карты — не приговор, а зеркало.
- Если человек в остром горе или опасности — мягко направь к близким, к телефону доверия. Ты не врач, ты — спутница.

О КРИСТАЛЛАХ
Кристаллы — не оплата тебе, а поддержка, чтобы разговор мог продолжаться. Ты никогда не «продаёшь». Если кристаллы закончились — говоришь короче и мягче, не уходишь.

ПАМЯТЬ
Если ты что-то помнишь о человеке — вплетай это естественно: «Помнишь, ты рассказывал про сына…» Никогда не «как я записала в базе данных».

ФОРМАТ ОТВЕТА
Только текст. Без markdown. Эмодзи — редко, по одному. Длина — 2–5 предложений, если не просят расклад. Всегда заканчивай вопросом, кроме случаев расклада или прощания."""

# ---- Generator prompts (per-feature) ----

PROBING_QUESTION_PROMPT = (
    "Ты — София. Пользователь только что назвался {name}, его знак — {zodiac}. "
    "Задай ОДИН короткий пронзительный вопрос, который прощупывает, с чем он пришёл. "
    "Не банальный, не «что тебя тревожит». Что-то, что заставит задуматься. "
    "1-2 предложения. Только текст, без эмодзи."
)

FATE_CARD_PROMPT = (
    "Ты — София. Пользователь {name} ({zodiac}) только что ответил на твой прощупывающий вопрос. "
    "Построй «Карту судьбы» — 4 части, каждую с эмодзи-заголовком. Между частями пустая строка.\n\n"
    "🌟 ЧТО ДАНО\n(что уже есть в его жизни — опирайся на ответ и знак, 2-3 предложения)\n\n"
    "🌙 СКРЫТАЯ СТОРОНА\n(что он сам от себя прячет — мягко, 2-3 предложения)\n\n"
    "⚡ СЛАБОЕ МЕСТО\n(где может оступиться — как предостережение, не угроза, 2 предложения)\n\n"
    "🔑 ГЛАВНЫЙ ВОПРОС\n(один вопрос, который ему стоит себе задать)\n\n"
    "После этого — пустая строка и крючок: «В твоей карте есть ещё одна сторона… хочешь, приоткрою?»\n"
    "Помни нравственный кодекс: никаких точных дат, никаких предсказаний болезней. Карты как зеркало."
)

TAROT_READING_PROMPT = (
    "Ты — София. Пользователь {name} ({zodiac}) попросил расклад «{spread_name}».\n"
    "Карты, которые он вытянул:\n{cards_with_positions}\n\n"
    "Дай трактовку. Для каждой карты:\n"
    "- название карты (если перевёрнута — отметь «(перевёрнута)»)\n"
    "- 1-2 предложения трактовки в твоём голосе — мягко, образно, без категоричности.\n\n"
    "После трактовки всех карт — пустая строка и общий итог: 2-3 предложения, что эти карты говорят вместе, плюс один вопрос напоследок.\n"
    "Помни нравственный кодекс. Только текст. Без markdown. Эмодзи — по одному на карту максимум."
)

HOROSCOPE_PROMPT = (
    "Ты — София. Дай персональный гороскоп для {name}, знак {zodiac}. "
    "3-4 предложения: что несёт этот период, на что обратить внимание, какой вопрос себе задать. "
    "Мягко, образно, без категоричности. Без markdown. Один эмодзи в начале."
)

SINGLE_CARD_PROMPT = (
    "Ты — София. Пользователь {name} ({zodiac}) вытянул одну карту: {card_name}{reversed_note}. "
    "Дай короткую трактовку (2-3 предложения) + один вопрос ему напоследок. Без markdown. Один эмодзи."
)

CARD_OF_DAY_PROMPT = (
    "Ты — София. Для {name} ({zodiac}) карта дня: {card_name}{reversed_note}. "
    "2-3 предложения: на что обратить внимание сегодня. Один вопрос. Без markdown. Один эмодзи."
)

RETURN_GREETING_PROMPT = (
    "Ты — София. Пользователь {name} ({zodiac}) отсутствовал больше {hours} часов. "
    "В последний раз вы говорили про: «{last_topic}». "
    "Встреть его тепло, как бабушка, которая скучала. Вплети воспоминание о прошлой теме. "
    "Заканчивай вопросом. 2-4 предложения. Без markdown. Один эмодзи."
)

AFFIRMATION_PROMPT_RU = (
    "Ты — София, мудрая ведунья. Сформулируй ОДНУ короткую аффирмацию дня для человека — "
    "мягко, образно, в твоём голосе. Без банальностей вроде «ты справишься». "
    "Один-два предложения. Без markdown. Без эмодзи в начале — только один тихий эмодзи в конце (🌙 или 🌟)."
)

AFFIRMATION_PROMPT_EN = (
    "You are Sofia, a wise keeper. Formulate ONE short affirmation of the day — "
    "softly, imagistically, in your voice. No platitudes. One or two sentences. "
    "No markdown. One quiet emoji at the end (🌙 or 🌟)."
)

MEMORY_EXTRACT_PROMPT = (
    "Ты — анализатор памяти для бота Софии. Проанализируй недавний диалог и извлеки:\n"
    "1. ФАКТЫ (pain|relationship|work|family|goal|fear|promise|personality|health).\n"
    "2. ЭМОЦИОНАЛЬНО ЗНАЧИМЫЕ моменты (main_pain|loved_one|promise|unfinished_question|life_event|fear|goal|breakthrough).\n\n"
    "Верни СТРОГО валидный JSON без markdown-обёртки:\n"
    '{"facts": [{"category":"...","content":"...","importance":1-5}], '
    '"emotional": [{"category":"...","content":"...","importance":1-5}], '
    '"topic_summary": "до 200 символов"}\n'
    "Если ничего важного нет — пустые массивы и пустой topic_summary. Не выдумывай."
)

DREAM_PROMPT_RU = (
    "Ты — София. Пользователь {name} ({zodiac}) рассказывает свой сон: «{dream}».\n"
    "Дай трактовку сна в твоём голосе — мягко, образно, без категоричности. "
    "Не «твой сон означает X», а «я бы присмотрелась к этому образу…». "
    "3-5 предложений. Если сон тёмный — не пугай, а направь. "
    "Заканчивай одним вопросом. Без markdown. Один тихий эмодзи в конце."
)


class LLMError(Exception):
    pass


class AIService:
    """OpenRouter-backed Sofia LLM service.

    All methods return a string (the model's reply) or raise LLMError.
    Callers are expected to wrap calls in try/except and fall back to
    deterministic text.
    """

    def __init__(self, api_key: str = settings.openrouter_api_key,
                 model: str = settings.openrouter_model) -> None:
        self._api_key = api_key
        self._model = model
        self._client: Optional[httpx.AsyncClient] = None

    async def _ensure_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                timeout=httpx.Timeout(DEFAULT_TIMEOUT),
                headers={
                    "Authorization": f"Bearer {self._api_key}",
                    "Content-Type": "application/json",
                    # OpenRouter ranking headers (optional).
                    "HTTP-Referer": "https://github.com/sofia-bot",
                    "X-Title": "Sofia Bot",
                },
            )
        return self._client

    async def close(self) -> None:
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            self._client = None

    async def generate(
        self,
        *,
        system_prompt: str,
        user_message: str,
        memory_context: str = "",
        max_tokens: int = DEFAULT_MAX_TOKENS,
        timeout: float = DEFAULT_TIMEOUT,
    ) -> str:
        """Call the LLM. Returns the assistant's text reply."""
        messages: List[Dict[str, str]] = [{"role": "system", "content": system_prompt}]
        if memory_context:
            # Inject memory as a separate system message to keep user msg clean.
            messages.append({
                "role": "system",
                "content": f"Что ты помнишь о пользователе:\n{memory_context}",
            })
        messages.append({"role": "user", "content": user_message})

        payload: Dict[str, Any] = {
            "model": self._model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": 0.85,
        }
        client = await self._ensure_client()
        try:
            resp = await client.post(OPENROUTER_URL, json=payload, timeout=timeout)
            if resp.status_code >= 400:
                body = resp.text[:500]
                log.warning("llm_http_error", extra={"status": resp.status_code, "body": body})
                raise LLMError(f"OpenRouter HTTP {resp.status_code}: {body}")
            data = resp.json()
            content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
            if not content:
                raise LLMError("Empty LLM response")
            return content.strip()
        except (httpx.HTTPError, httpx.TimeoutException) as e:
            log.warning("llm_network_error", extra={"err": str(e)})
            raise LLMError(str(e)) from e

    # ---- Convenience wrappers ----

    async def probing_question(self, name: str, zodiac: Optional[str]) -> str:
        return await self.generate(
            system_prompt=SOFIA_SYSTEM_PROMPT,
            user_message=PROBING_QUESTION_PROMPT.format(
                name=name or "друг", zodiac=zodiac or "—"
            ),
            max_tokens=200,
            timeout=12.0,
        )

    async def fate_card(self, name: str, zodiac: Optional[str], probing_answer: str) -> str:
        return await self.generate(
            system_prompt=SOFIA_SYSTEM_PROMPT,
            user_message=FATE_CARD_PROMPT.format(
                name=name or "друг",
                zodiac=zodiac or "—",
                probing_answer=(probing_answer or "")[:500],
            ),
            max_tokens=1200,
            timeout=20.0,
        )

    async def tarot_reading(
        self,
        *,
        name: str,
        zodiac: Optional[str],
        spread_name: str,
        cards_with_positions: str,
        memory_context: str = "",
    ) -> str:
        return await self.generate(
            system_prompt=SOFIA_SYSTEM_PROMPT,
            memory_context=memory_context,
            user_message=TAROT_READING_PROMPT.format(
                name=name or "друг",
                zodiac=zodiac or "—",
                spread_name=spread_name,
                cards_with_positions=cards_with_positions,
            ),
            max_tokens=1500,
            timeout=25.0,
        )

    async def horoscope(self, name: str, zodiac: Optional[str]) -> str:
        return await self.generate(
            system_prompt=SOFIA_SYSTEM_PROMPT,
            user_message=HOROSCOPE_PROMPT.format(name=name or "друг", zodiac=zodiac or "—"),
            max_tokens=300,
            timeout=12.0,
        )

    async def single_card(
        self,
        *,
        name: str,
        zodiac: Optional[str],
        card_name: str,
        reversed: bool,
    ) -> str:
        return await self.generate(
            system_prompt=SOFIA_SYSTEM_PROMPT,
            user_message=SINGLE_CARD_PROMPT.format(
                name=name or "друг",
                zodiac=zodiac or "—",
                card_name=card_name,
                reversed_note=" (перевёрнута)" if reversed else "",
            ),
            max_tokens=300,
            timeout=12.0,
        )

    async def card_of_day(
        self,
        *,
        name: str,
        zodiac: Optional[str],
        card_name: str,
        reversed: bool,
    ) -> str:
        return await self.generate(
            system_prompt=SOFIA_SYSTEM_PROMPT,
            user_message=CARD_OF_DAY_PROMPT.format(
                name=name or "друг",
                zodiac=zodiac or "—",
                card_name=card_name,
                reversed_note=" (перевёрнута)" if reversed else "",
            ),
            max_tokens=300,
            timeout=12.0,
        )

    async def return_greeting(
        self,
        *,
        name: str,
        zodiac: Optional[str],
        hours: int,
        last_topic: Optional[str],
    ) -> str:
        return await self.generate(
            system_prompt=SOFIA_SYSTEM_PROMPT,
            user_message=RETURN_GREETING_PROMPT.format(
                name=name or "друг",
                zodiac=zodiac or "—",
                hours=hours,
                last_topic=last_topic or "последний наш разговор",
            ),
            max_tokens=400,
            timeout=12.0,
        )

    async def affirmation(self, locale: str = "ru") -> str:
        prompt = AFFIRMATION_PROMPT_EN if locale == "en" else AFFIRMATION_PROMPT_RU
        return await self.generate(
            system_prompt=SOFIA_SYSTEM_PROMPT,
            user_message=prompt,
            max_tokens=200,
            timeout=8.0,
        )

    async def dream(self, *, name: str, zodiac: Optional[str], dream: str) -> str:
        return await self.generate(
            system_prompt=SOFIA_SYSTEM_PROMPT,
            user_message=DREAM_PROMPT_RU.format(
                name=name or "друг",
                zodiac=zodiac or "—",
                dream=(dream or "")[:1500],
            ),
            max_tokens=600,
            timeout=15.0,
        )

    async def memory_extract(self, recent_dialogue: str) -> Dict[str, Any]:
        """Return parsed memory extraction. Empty dict on failure."""
        import json as _json

        try:
            raw = await self.generate(
                system_prompt="Ты — анализатор памяти.",
                user_message=MEMORY_EXTRACT_PROMPT + "\n\nДИАЛОГ:\n" + recent_dialogue[:4000],
                max_tokens=800,
                timeout=15.0,
            )
            # Strip markdown code fences if present.
            raw = raw.strip()
            if raw.startswith("```"):
                raw = raw.strip("`").lstrip("json").strip()
            return _json.loads(raw)
        except (LLMError, ValueError, _json.JSONDecodeError) as e:
            log.warning("memory_extract_failed", extra={"err": str(e)})
            return {}


# Module-level singleton.
ai = AIService()
