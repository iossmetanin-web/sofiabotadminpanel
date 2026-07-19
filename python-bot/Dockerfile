FROM python:3.12-slim

WORKDIR /app

# System deps (asyncpg builds fine without them, but keep them for safety)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Healthcheck is optional; bot is a long-polling worker.
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD python -c "import os, sys; sys.exit(0 if os.getenv('BOT_TOKEN') else 1)"

CMD ["python", "-m", "app.main"]
