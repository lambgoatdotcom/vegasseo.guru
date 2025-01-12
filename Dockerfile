# Build stage for frontend
FROM node:18-alpine AS frontend-builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Python backend stage
FROM python:3.9-alpine AS backend-builder
WORKDIR /app
RUN python -m venv /app/venv
ENV PATH="/app/venv/bin:$PATH"
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Final stage using Ghost as base
FROM ghost:5-alpine AS final

# Install system dependencies
RUN apk add --no-cache python3 py3-pip nodejs npm

# Create app user and set up directories
RUN addgroup -S appgroup && \
    adduser -S appuser -G appgroup && \
    mkdir -p /app /home/appuser/.npm-global && \
    chown -R appuser:appgroup /app /home/appuser

# Set up Python virtual environment
RUN python3 -m venv /app/venv && \
    chown -R appuser:appgroup /app/venv
ENV PATH="/app/venv/bin:$PATH"
ENV PYTHONPATH="/app"

# Set up npm global directory
ENV NPM_CONFIG_PREFIX=/home/appuser/.npm-global
ENV PATH="/home/appuser/.npm-global/bin:$PATH"

# Switch to non-root user
USER appuser

# Install global npm packages
RUN npm install -g serve

# Copy builds from previous stages
COPY --from=frontend-builder --chown=appuser:appgroup /app/dist /app/dist
COPY --from=backend-builder --chown=appuser:appgroup /app/venv /app/venv
COPY --chown=appuser:appgroup src /app/src
COPY --chown=appuser:appgroup start.sh /app/start.sh

WORKDIR /app
RUN chmod +x start.sh

CMD ["./start.sh"] 