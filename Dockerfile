# Build stage for frontend
FROM node:18-slim AS frontend-builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Python backend stage
FROM python:3.9-slim AS backend-builder
WORKDIR /app
RUN python -m venv /app/venv
COPY requirements.txt .
RUN . /app/venv/bin/activate && pip install --no-cache-dir -r requirements.txt

# Final stage using Ghost as base
FROM ghost:5

# Install system dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    rsync \
    netcat-openbsd \
    bash \
    python3-uvicorn \
    python3-fastapi \
    python3-dotenv \
    python3-aiohttp \
    python3-bs4 \
    python3-pydantic \
    python3-typing-extensions \
    && rm -rf /var/lib/apt/lists/* \
    && pip3 install --break-system-packages textblob

# Set up directories
RUN mkdir -p /app /home/node/.npm-global && \
    chown -R node:node /app /home/node

# Install serve globally
USER node
ENV NPM_CONFIG_PREFIX=/home/node/.npm-global
ENV PATH="/home/node/.npm-global/bin:$PATH"
RUN npm install -g serve

# Copy frontend build
COPY --from=frontend-builder --chown=node:node /app/dist /app/dist
COPY --from=frontend-builder --chown=node:node /app/package*.json /app/
COPY --from=frontend-builder --chown=node:node /app/src /app/src
COPY --from=frontend-builder --chown=node:node /app/index.html /app/
COPY --from=frontend-builder --chown=node:node /app/tsconfig*.json /app/
COPY --from=frontend-builder --chown=node:node /app/vite.config.ts /app/
COPY --from=frontend-builder --chown=node:node /app/postcss.config.js /app/
COPY --from=frontend-builder --chown=node:node /app/tailwind.config.js /app/

# Install frontend dependencies
USER node
WORKDIR /app
RUN npm ci

# Copy backend files
COPY --from=backend-builder --chown=node:node /app/venv /app/venv
COPY --chown=node:node src /app/src
COPY --chown=node:node requirements.txt /app/

# Copy startup script
COPY --chown=node:node start.sh /app/start.sh
WORKDIR /app
RUN chmod +x start.sh

ENV PYTHONPATH=/app
ENV PATH="/app/venv/bin:$PATH"

USER root
CMD ["/app/start.sh"]