#!/bin/sh
set -e

cleanup() {
  kill -- -$$ 2>/dev/null || true
}
trap cleanup SIGTERM SIGINT

# Start backend (FastAPI)
python3 -m uvicorn backend.main:app --host 0.0.0.0 --port 8080 &

# Start TS agent-runner engine
node --import tsx src/agent-runner-server.ts &

# Wait for either to exit, then kill the other
wait -n
cleanup
