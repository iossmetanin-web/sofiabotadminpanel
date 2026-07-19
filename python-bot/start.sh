#!/usr/bin/env bash
# start.sh — convenience launcher for local dev.
# Loads .env (if present) and runs the bot with python -m app.main.
set -euo pipefail

cd "$(dirname "$0")"

if [ -f .env ]; then
    set -a
    # shellcheck disable=SC1091
    . ./.env
    set +a
fi

export PYTHONUNBUFFERED=1
export PYTHONDONTWRITEBYTECODE=1

exec python -m app.main
