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
ENV PATH="/app/venv/bin:$PATH"
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Final stage using Ghost as base
FROM ghost:5

# Install system dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    nodejs \
    npm \
    netcat-openbsd \
    && rm -rf /var/lib/apt/lists/*

# Create app user and set up directories
RUN mkdir -p /app /home/ghost/.npm-global && \
    chown -R node:node /app /home/ghost

# Set up Python virtual environment
RUN python3 -m venv /app/venv && \
    chown -R node:node /app/venv
ENV PATH="/app/venv/bin:$PATH"
ENV PYTHONPATH="/app"

# Set up npm global directory
ENV NPM_CONFIG_PREFIX=/home/ghost/.npm-global
ENV PATH="/home/ghost/.npm-global/bin:$PATH"

# Install global npm packages
RUN npm install -g serve

# Copy builds from previous stages
COPY --from=frontend-builder --chown=node:node /app/dist /app/dist
COPY --from=backend-builder --chown=node:node /app/venv /app/venv
COPY --chown=node:node src /app/src
COPY --chown=node:node start.sh /app/start.sh

WORKDIR /app
RUN chmod +x start.sh

CMD ["./start.sh"]