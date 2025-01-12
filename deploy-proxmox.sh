#!/bin/bash

# Configuration
PROXMOX_HOST="your-proxmox-host"  # Replace with your Proxmox host
PROXMOX_USER="root"               # Replace with your Proxmox username
IMAGE_NAME="vegasguru"
CONTAINER_NAME="vegasguru"

# Build the Docker image locally
echo "Building Docker image..."
docker build -t $IMAGE_NAME .

# Save the image to a tar file
echo "Saving image to tar file..."
docker save $IMAGE_NAME > ${IMAGE_NAME}.tar

# Transfer the image to Proxmox
echo "Transferring image to Proxmox..."
scp ${IMAGE_NAME}.tar $PROXMOX_USER@$PROXMOX_HOST:/root/

# SSH into Proxmox and load/run the container
echo "Loading and running container on Proxmox..."
ssh $PROXMOX_USER@$PROXMOX_HOST "
    # Load the image
    docker load < /root/${IMAGE_NAME}.tar

    # Stop and remove existing container if it exists
    docker stop $CONTAINER_NAME 2>/dev/null
    docker rm $CONTAINER_NAME 2>/dev/null

    # Run the new container
    docker run -d \
        --name $CONTAINER_NAME \
        --restart unless-stopped \
        -p 5173:5173 \
        -p 8000:8000 \
        -p 2368:2368 \
        --env-file .env \
        -v ghost-content:/var/lib/ghost/content \
        $IMAGE_NAME

    # Cleanup
    rm /root/${IMAGE_NAME}.tar
"

echo "Deployment complete!" 