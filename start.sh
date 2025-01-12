#!/bin/bash

# Start Ghost
cd /var/lib/ghost && ghost start &

# Start FastAPI backend
cd /app && uvicorn src.services.api_server:app --host 0.0.0.0 --port 8000 &

# Start frontend
serve -s dist -l 5173 &

# Wait for any process to exit
wait -n

# Exit with status of process that exited first
exit $? 