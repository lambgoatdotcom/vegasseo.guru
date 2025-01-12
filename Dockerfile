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
    && rm -rf /var/lib/apt/lists/*

# Set up directories
RUN mkdir -p /app /home/ghost/.npm-global && \
    chown -R node:node /app

# Install serve globally
RUN npm install -g serve

# Copy frontend build
COPY --from=frontend-builder --chown=node:node /app/dist /app/dist

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

CMD ["/app/start.sh"]