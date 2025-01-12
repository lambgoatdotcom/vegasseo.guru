#!/bin/bash

# Configuration
PROXMOX_HOST="your-proxmox-host"  # Replace with your Proxmox host
PROXMOX_USER="root"               # Replace with your Proxmox username
IMAGE_NAME="obelisk/vegasguru:latest"
CONTAINER_NAME="vegasguru"

# SSH into Proxmox and run the container
echo "Deploying container on Proxmox..."
ssh $PROXMOX_USER@$PROXMOX_HOST "
    # Pull the latest image
    docker pull $IMAGE_NAME

    # Stop and remove existing container if it exists
    docker stop $CONTAINER_NAME 2>/dev/null
    docker rm $CONTAINER_NAME 2>/dev/null

    # Run the new container
    docker run -d \
        --name $CONTAINER_NAME \
        --restart unless-stopped \
        -p 5174:5173 \
        -p 8001:8000 \
        -p 2369:2368 \
        --env-file .env \
        -v ghost_content:/var/lib/ghost/content \
        --user root \
        $IMAGE_NAME
"

echo "Deployment complete!"