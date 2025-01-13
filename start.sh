#!/bin/bash

set -e

# Function to wait for a service to be ready
wait_for_service() {
    local host="$1"
    local port="$2"
    local service="$3"
    local max_attempts="$4"
    local attempt=0
    
    echo "Waiting for $service to be ready..."
    while ! nc -z "$host" "$port"; do
        attempt=$(( attempt + 1 ))
        if [ $attempt -ge $max_attempts ]; then
            echo "ERROR: $service failed to start after $max_attempts attempts"
            return 1
        fi
        echo "Waiting for $service... ($(( max_attempts - attempt )) attempts remaining)"
        sleep 2
    done
    echo "$service is ready!"
    return 0
}

# Create ghost user and group if they don't exist
echo "Setting up ghost user and group..."
groupadd -f node || true
useradd -r -g node -d /var/lib/ghost node || true

# Set up npm environment first
echo "Setting up npm environment..."
mkdir -p /home/node/.npm-global
chown -R node:node /home/node

# Create and configure .profile
cat > /home/node/.profile << 'EOF'
export PATH=/home/node/.npm-global/bin:$PATH
export NPM_CONFIG_PREFIX=/home/node/.npm-global
EOF

chown node:node /home/node/.profile

# Wait for MySQL to be ready
echo "Waiting for MySQL..."
if ! wait_for_service db 3306 "MySQL" 30; then
    echo "ERROR: MySQL failed to start"
    exit 1
fi

# Setup process management
pids=()
cleanup() {
    echo "Cleaning up processes..."
    for pid in "${pids[@]}"; do
        if kill -0 $pid 2>/dev/null; then
            kill $pid
        fi
    done
    exit 0
}
trap cleanup SIGTERM SIGINT

# Start frontend first
echo "Starting frontend..."
cd /app

# Install frontend dependencies
echo "Installing frontend dependencies..."
su node -c "bash -c 'source /home/node/.profile && npm ci'" || {
    echo "npm ci failed, trying npm install..."
    su node -c "bash -c 'source /home/node/.profile && npm install'"
} || {
    echo "ERROR: Failed to install frontend dependencies"
    exit 1
}

# Install and configure Tailwind
echo "Setting up Tailwind..."
su node -c "bash -c 'source /home/node/.profile && npm install -D tailwindcss postcss autoprefixer'" || {
    echo "ERROR: Failed to install Tailwind dependencies"
    exit 1
}

# Start the Vite dev server
echo "Starting Vite development server..."
export VITE_HOST=0.0.0.0
export VITE_PORT=5173
su node -c "bash -c 'source /home/node/.profile && VITE_HOST=0.0.0.0 npm run dev'" &
frontend_pid=$!
pids+=($frontend_pid)

# Verify Vite server
echo "Verifying Vite server..."
if ! wait_for_service 0.0.0.0 5173 "Vite server" 30; then
    echo "ERROR: Vite server failed to start"
    cleanup
    exit 1
fi

# Start FastAPI backend
echo "Starting FastAPI backend..."
cd /app
. /app/venv/bin/activate
python3 -m uvicorn src.services.api_server:app --host 0.0.0.0 --port 8000 --reload &
backend_pid=$!
pids+=($!)

# Verify FastAPI
echo "Verifying FastAPI backend..."
if ! wait_for_service 0.0.0.0 8000 "FastAPI backend" 30; then
    echo "ERROR: FastAPI backend failed to start"
    cleanup
    exit 1
fi

# Set up Ghost directory structure
echo "Setting up Ghost directory structure..."
GHOST_INSTALL_DIR="/var/lib/ghost"
GHOST_CONTENT_DIR="/var/lib/ghost/content"

mkdir -p "$GHOST_CONTENT_DIR"/{themes,data,images,files,logs}
mkdir -p "$GHOST_CONTENT_DIR/themes/source/assets/css"

# Copy default theme
if [ -d "$GHOST_INSTALL_DIR/current/content/themes/casper" ]; then
    cp -r "$GHOST_INSTALL_DIR/current/content/themes/casper" "$GHOST_CONTENT_DIR/themes/"
fi

# Start Ghost
echo "Starting Ghost..."
cd "$GHOST_INSTALL_DIR/current"
node current/index.js &
ghost_pid=$!
pids+=($ghost_pid)

# Verify Ghost
echo "Verifying Ghost..."
if ! wait_for_service 0.0.0.0 2368 "Ghost" 60; then
    echo "ERROR: Ghost failed to start"
    cleanup
    exit 1
fi

echo "All services started successfully!"
echo "Frontend: http://localhost:5173"
echo "Backend: http://localhost:8000"
echo "Ghost: http://localhost:2368"

# Monitor running processes
while true; do
    for pid in "${pids[@]}"; do
        if ! kill -0 $pid 2>/dev/null; then
            echo "Process $pid has died. Initiating cleanup..."
            cleanup
            exit 1
        fi
    done
    sleep 5
done