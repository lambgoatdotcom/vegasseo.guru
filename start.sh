#!/bin/bash

set -e

# Function to wait for a service to be ready
wait_for_service() {
    local host="$1"
    local port="$2"
    local service="$3"
    
    echo "Waiting for $service to be ready..."
    while ! nc -z "$host" "$port"; do
        sleep 1
    done
    echo "$service is ready!"
}

# Create ghost user and group if they don't exist
echo "Setting up ghost user and group..."
groupadd -f ghost || true
useradd -r -g ghost -d /var/lib/ghost ghost || true

# Set up Ghost directory structure
echo "Setting up Ghost directory structure..."
GHOST_INSTALL_DIR="/var/lib/ghost"
GHOST_CONTENT_DIR="/var/lib/ghost/content"

# Create Ghost installation directory
mkdir -p "$GHOST_INSTALL_DIR"
chown -R ghost:ghost "$GHOST_INSTALL_DIR"

# Create content directory if it doesn't exist
mkdir -p "$GHOST_CONTENT_DIR"
chown -R ghost:ghost "$GHOST_CONTENT_DIR"

# Set up npm environment
echo "Setting up npm environment..."
mkdir -p /home/ghost/.npm-global
chown -R ghost:ghost /home/ghost
touch /home/ghost/.profile
chown ghost:ghost /home/ghost/.profile
echo "export PATH=/home/ghost/.npm-global/bin:$PATH" >> /home/ghost/.profile
echo "export NPM_CONFIG_PREFIX=/home/ghost/.npm-global" >> /home/ghost/.profile

echo "Installing Ghost CLI..."
runuser -u ghost -- /bin/bash -c "NPM_CONFIG_PREFIX=/home/ghost/.npm-global npm install -g ghost-cli@latest"

# Wait for MySQL to be ready
echo "Waiting for MySQL..."
wait_for_service db 3306 "MySQL"

# Install Ghost
echo "Installing Ghost..."
cd "$GHOST_INSTALL_DIR"
runuser -u ghost -- /bin/bash -c "ghost install local --no-prompt --no-setup --no-stack --no-setup-linux-user --no-setup-nginx --no-setup-ssl --no-setup-mysql --no-setup-systemd --dir $GHOST_INSTALL_DIR"

# Start FastAPI backend
echo "Starting FastAPI backend..."
cd /app
. /app/venv/bin/activate
python3 -m uvicorn src.services.api_server:app --host 0.0.0.0 --port 8000 --reload &

# Start frontend
echo "Starting frontend..."
cd /app
serve -s dist --listen 0.0.0.0:5173 &

# Wait for services to be ready
wait_for_service 0.0.0.0 2368 "Ghost"
wait_for_service 0.0.0.0 8000 "FastAPI"
wait_for_service 0.0.0.0 5173 "Frontend"

echo "All services are running!"

# Keep container running and monitor logs
tail -f /var/lib/ghost/content/logs/ghost.log

docker push yourusername/vegasguru:latest