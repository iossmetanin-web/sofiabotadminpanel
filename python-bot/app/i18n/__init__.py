"""app.i18n — internationalization (RU + EN).

Locale detection: read from `user.language` field in the DB (set by user via
/lang command, defaults to "ru"). Falls back to "ru".

Usage:
    from app.i18n import t, locale_label
    text = t(loc, "menu_title")
    text = t(loc, "profile_crystals", count=5)
"""
from __future__ import annotations

import re
from typing import Any, Dict, Optional

from app.i18n import ru as _ru
from app.i18n import en as _en

DEFAULT_LOCALE = "ru"
SUPPORTED = {"ru", "en"}

_Dicts = {"ru": _ru.DICT, "en": _en.DICT}


def is_locale(s: Optional[str]) -> bool:
    return s in SUPPORTED


def normalize(loc: Optional[str]) -> str:
    if loc in SUPPORTED:
        return loc  # type: ignore[return-value]
    return DEFAULT_LOCALE


def t(loc: Optional[str], key: str, **params: Any) -> str:
    """Translate `key` in `loc`, substituting `{param}` placeholders."""
    loc = normalize(loc)
    d = _Dicts.get(loc, _ru.DICT)
    tmpl = d.get(key)
    if tmpl is None:
        # Fall back to Russian, then to the key itself.
        tmpl = _ru.DICT.get(key, key)
    if not params:
        return tmpl
    # Replace {name} with params['name'].
    def _sub(match: re.Match) -> str:
        name = match.group(1)
        if name in params:
            return str(params[name])
        return match.group(0)

    return re.sub(r"\{(\w+)\}", _sub, tmpl)


def locale_label(loc: str) -> str:
    return "🇷🇺 Русский" if normalize(loc) == "ru" else "🇬🇧 English"
