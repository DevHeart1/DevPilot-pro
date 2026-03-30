#!/bin/bash
# Enable verbose tracing
set -x

export PORT="${PORT:-8080}"

echo "--- DevPilot Sandbox Startup (Headless MVP) ---"
echo "Environment: PORT=$PORT"

# Start Node.js API server
echo "Starting Node.js server on port $PORT..."
exec node dist/index.js
