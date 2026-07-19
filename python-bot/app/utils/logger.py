"""app.utils.logger — structured JSON logging to stdout.

Render / Fly / Railway capture stdout automatically. JSON lines are easy to
grep and ship to Loki / Datadog / CloudWatch Logs Insights.

Usage:
    from app.utils.logger import get_logger
    log = get_logger("app.bot")
    log.info("bot_started", extra={"version": "1.0.0"})
    log.error("db_failed", extra={"err": str(e)})
"""
from __future__ import annotations

import json
import logging
import sys
from datetime import datetime, timezone
from typing import Any, Dict

from app.config import settings


class JsonFormatter(logging.Formatter):
    """One-line JSON per log record."""

    def format(self, record: logging.LogRecord) -> str:
        payload: Dict[str, Any] = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        # Merge LogRecord extras (skip standard attrs).
        std = set(vars(logging.LogRecord("", 0, "", 0, "", None, None)).keys()) | {
            "levelname", "name", "msg", "args", "exc_info", "exc_text",
            "stack_info", "lineno", "funcName", "filename", "module",
            "threadName", "thread", "processName", "process", "msecs",
            "relativeCreated", "created", "levelno", "pathname", "message",
        }
        for k, v in record.__dict__.items():
            if k in std:
                continue
            try:
                json.dumps(v)
                payload[k] = v
            except (TypeError, ValueError):
                payload[k] = str(v)
        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False, default=str)


def _configure_root() -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(settings.log_level)
    # Silence noisy libs.
    logging.getLogger("aiogram.event").setLevel(logging.WARNING)
    logging.getLogger("asyncpg").setLevel(logging.WARNING)


def get_logger(name: str = "app") -> logging.Logger:
    """Return a configured logger.

    The root logger is configured once on first call.
    """
    if not logging.getLogger().handlers:
        _configure_root()
    return logging.getLogger(name)
