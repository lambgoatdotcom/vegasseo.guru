#!/bin/sh

# Wait for MySQL to be ready
sleep 10

# Navigate to Ghost directory
cd /var/lib/ghost

# Try to unlock migrations
cd versions/5.105.0
npm install knex-migrator
npx knex-migrator reset --force
npx knex-migrator init --force

# Start Ghost
cd /var/lib/ghost
node current/index.js 