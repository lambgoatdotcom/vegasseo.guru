#!/bin/bash

# Build and push Docker images
echo "🐳 Building and pushing Docker images..."
docker compose -f docker-compose.amd64.yml build && docker compose -f docker-compose.amd64.yml push

# Get the exit status of the Docker commands
DOCKER_STATUS=$?

if [ $DOCKER_STATUS -eq 0 ]; then
    echo "✅ Docker images built and pushed successfully"
    
    # Add and commit changes to Git
    echo "📦 Committing changes to Git..."
    git add .
    git commit -m "chore: update application with latest changes"
    
    # Push to Git repository
    echo "🚀 Pushing to Git repository..."
    git push origin main
    
    GIT_STATUS=$?
    
    if [ $GIT_STATUS -eq 0 ]; then
        echo "✅ Git changes pushed successfully"
        echo "🎉 Deployment complete!"
    else
        echo "❌ Failed to push Git changes"
        exit 1
    fi
else
    echo "❌ Failed to build/push Docker images"
    exit 1
fi 