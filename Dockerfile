# ── Stage 1: Build frontend ──────────────────────────────
FROM node:22-slim AS frontend-build
WORKDIR /build
COPY frontend/ frontend/
RUN cd frontend && npm ci && npm run build

# ── Stage 2: Install Python dependencies ────────────────
FROM python:3.12-slim AS backend-deps
COPY backend/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir --prefix=/install -r /tmp/requirements.txt

# ── Stage 3: Final image ────────────────────────────────
FROM node:22-slim AS final

# Install Python runtime
RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 python3-venv && \
    rm -rf /var/lib/apt/lists/*

# Copy Python packages from backend-deps
COPY --from=backend-deps /install /usr/local

WORKDIR /app

# Install Node dependencies (for tsx etc.)
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm i -g tsx

# Copy application code
COPY --from=frontend-build /build/frontend/dist ./frontend/dist
COPY backend/ ./backend/
COPY src/agent-runner-server.ts ./src/agent-runner-server.ts
COPY entrypoint.sh ./

RUN chmod +x entrypoint.sh

ENV PYTHONPATH=/app/backend
ENV OPENORCH_DATA_DIR=/data
EXPOSE 8080

CMD ["./entrypoint.sh"]
