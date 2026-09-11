FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH="/app/packages:/app"

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY pyproject.toml /app/
RUN pip install --no-cache-dir -e . && \
    pip install --no-cache-dir tabulate python-multipart

# Copy application source
COPY packages/ /app/packages/
COPY apps/ /app/apps/
COPY pipelines/ /app/pipelines/
COPY Artefak/ /app/Artefak/

EXPOSE 3001

CMD ["uvicorn", "apps.api.main:app", "--host", "0.0.0.0", "--port", "3001"]
