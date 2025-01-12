#!/bin/bash

# Enable debug mode and error handling
set -x
set -e

# Function to wait for a service to be ready
wait_for_service() {
    local host=$1
    local port=$2
    local service=$3
    
    echo "Waiting for $service to be ready..."
    local max_attempts=30
    local attempt=1
    
    while ! nc -z $host $port; do
        if [ $attempt -ge $max_attempts ]; then
            echo "$service failed to start after $max_attempts attempts"
            return 1
        fi
        echo "Attempt $attempt: $service not ready yet..."
        sleep 2
        ((attempt++))
    done
    echo "$service is ready!"
    return 0
}

echo "Setting up Ghost user..."
# Debug information
echo "Current user: $(whoami)"
echo "Current permissions:"
ls -la /var/lib
ls -la /home

# Check if ghost group exists, create only if it doesn't
if getent group ghost > /dev/null; then
    echo "Ghost group already exists"
else
    echo "Creating ghost group..."
    addgroup -S ghost || { echo "Failed to create ghost group"; exit 1; }
fi

# Check if ghost user exists, create only if it doesn't
if getent passwd ghost > /dev/null; then
    echo "Ghost user already exists"
else
    echo "Creating ghost user..."
    adduser -S -D -H -h /home/ghost -s /sbin/nologin -G ghost ghost || { echo "Failed to create ghost user"; exit 1; }
fi

echo "Setting up directories..."
# Set up Ghost directory with correct permissions
mkdir -p /var/lib/ghost || { echo "Failed to create /var/lib/ghost"; exit 1; }
mkdir -p /home/ghost || { echo "Failed to create /home/ghost"; exit 1; }
mkdir -p /home/ghost/.npm-global || { echo "Failed to create .npm-global directory"; exit 1; }

echo "Setting permissions..."
echo "Before chown:"
ls -la /var/lib/ghost
ls -la /home/ghost

# Set permissions with verbose output
chown -Rv ghost:ghost /var/lib/ghost || { echo "Failed to set permissions on /var/lib/ghost"; exit 1; }
chown -Rv ghost:ghost /home/ghost || { echo "Failed to set permissions on /home/ghost"; exit 1; }

echo "After chown:"
ls -la /var/lib/ghost
ls -la /home/ghost

# Set up npm for ghost user
echo "Setting up npm environment..."
touch /home/ghost/.profile || { echo "Failed to create .profile"; exit 1; }
chown ghost:ghost /home/ghost/.profile || { echo "Failed to set permissions on .profile"; exit 1; }
echo 'export PATH=/home/ghost/.npm-global/bin:$PATH' >> /home/ghost/.profile
echo 'export NPM_CONFIG_PREFIX=/home/ghost/.npm-global' >> /home/ghost/.profile

echo "Starting Ghost..."
# Install Ghost CLI as ghost user
echo "Installing Ghost CLI..."
su-exec ghost /bin/sh -c "NPM_CONFIG_PREFIX=/home/ghost/.npm-global npm install -g ghost-cli@latest"

# Switch to ghost user and install/start Ghost
cd /var/lib/ghost

# Clean the directory before installation
echo "Cleaning Ghost directory..."
su-exec ghost /bin/sh -c "rm -rf /var/lib/ghost/*"

echo "Installing Ghost..."
su-exec ghost /bin/sh -c "source /home/ghost/.profile && cd /var/lib/ghost && ghost install local --no-prompt --no-stack --no-setup --dir /var/lib/ghost"

echo "Starting Ghost..."
su-exec ghost /bin/sh -c "source /home/ghost/.profile && cd /var/lib/ghost && ghost start --development --no-setup" &
sleep 15  # Give Ghost more time to initialize

if ! wait_for_service 0.0.0.0 2368 "Ghost"; then
    echo "Ghost failed to start"
    echo "Ghost logs:"
    cat /var/lib/ghost/content/logs/ghost.log
    echo "Process status:"
    ps aux | grep ghost
    exit 1
fi

echo "Starting FastAPI backend..."
cd /app
source /app/venv/bin/activate
echo "Python path: $PYTHONPATH"
echo "Current directory: $(pwd)"
ls -la
python3 -m uvicorn src.services.api_server:app --host 0.0.0.0 --port 8000 --log-level debug &
if ! wait_for_service 0.0.0.0 8000 "FastAPI"; then
    echo "FastAPI failed to start"
    exit 1
fi

echo "Starting frontend..."
cd /app
echo "Current directory for frontend: $(pwd)"
ls -la dist/
# Start serve with explicit host binding and more verbose output
NODE_ENV=production serve -s dist --listen 0.0.0.0:5173 --no-clipboard --debug &
if ! wait_for_service 0.0.0.0 5173 "Frontend"; then
    echo "Frontend failed to start"
    exit 1
fi

echo "All services started successfully!"
echo "Service status:"
echo "Ghost: $(nc -z 0.0.0.0 2368 && echo 'UP' || echo 'DOWN')"
echo "FastAPI: $(nc -z 0.0.0.0 8000 && echo 'UP' || echo 'DOWN')"
echo "Frontend: $(nc -z 0.0.0.0 5173 && echo 'UP' || echo 'DOWN')"

# Monitor all services and their logs
while true; do
    echo "Checking service status at $(date)"
    
    if ! nc -z 0.0.0.0 2368; then
        echo "Ghost is down!"
        echo "Ghost logs:"
        cat /var/lib/ghost/content/logs/ghost.log
        echo "Process status:"
        ps aux | grep ghost
        exit 1
    fi
    
    if ! nc -z 0.0.0.0 8000; then
        echo "FastAPI is down!"
        exit 1
    fi
    
    if ! nc -z 0.0.0.0 5173; then
        echo "Frontend is down!"
        ps aux | grep serve
        exit 1
    fi
    
    # Print running processes
    echo "Running processes:"
    ps aux
    
    # Print network connections
    echo "Network connections:"
    netstat -tulpn
    
    echo "All services running"
    sleep 30
done 