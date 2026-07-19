"""app.utils.heartbeat — periodic heartbeat updater.

Every `settings.heartbeat_interval_seconds` (default 20s), updates the
singleton row in `BotHeartbeat` with:

- `lastBeatAt`  = now
- `pid`         = current process PID
- `hostname`    = socket.gethostname()
- `version`     = settings.bot_version
- `uptime`      = seconds since start
- `pollingMode` = "long_polling"

The admin panel reads `lastBeatAt` to show bot online/offline status.
"""
from __future__ import annotations

import asyncio
import os
import socket
import time
from typing import Optional

from app.config import settings
from app.db import Queries
from app.utils.logger import get_logger

log = get_logger("app.heartbeat")

_START_TS: float = time.time()
_HOSTNAME: str = socket.gethostname()
_PID: int = os.getpid()


class HeartbeatWorker:
    """Background task that writes the heartbeat row."""

    def __init__(self, interval_seconds: int = settings.heartbeat_interval_seconds) -> None:
        self._interval = interval_seconds
        self._task: Optional[asyncio.Task[None]] = None
        self._stop = asyncio.Event()

    async def _loop(self) -> None:
        log.info("heartbeat_started", extra={"interval": self._interval, "pid": _PID, "hostname": _HOSTNAME})
        # Write once immediately so admin panel sees us as online right away.
        while not self._stop.is_set():
            try:
                uptime = int(time.time() - _START_TS)
                await Queries.upsert_heartbeat(
                    pid=_PID,
                    hostname=_HOSTNAME,
                    version=settings.bot_version,
                    uptime=uptime,
                    polling_mode="long_polling",
                )
            except Exception as e:
                log.warning("heartbeat_failed", extra={"err": str(e)})
            try:
                await asyncio.wait_for(self._stop.wait(), timeout=self._interval)
            except asyncio.TimeoutError:
                continue
        log.info("heartbeat_stopped")

    def start(self) -> None:
        if self._task is None or self._task.done():
            self._stop = asyncio.Event()
            self._task = asyncio.create_task(self._loop(), name="heartbeat")

    async def stop(self) -> None:
        self._stop.set()
        if self._task and not self._task.done():
            try:
                await asyncio.wait_for(self._task, timeout=5)
            except (asyncio.TimeoutError, asyncio.CancelledError):
                self._task.cancel()


def uptime_seconds() -> int:
    return int(time.time() - _START_TS)
