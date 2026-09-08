#!/usr/bin/env bash
# ForestGuard AI — resilient ML backend starter.
# Starts the FastAPI service on :3010 only if it is not already healthy.

set -u
cd "$(dirname "$0")/.."   # project root

PORT=3010
if curl -sf "http://localhost:${PORT}/health" > /dev/null 2>&1; then
    echo "[ml] ForestGuard backend already healthy on :${PORT}"
    exit 0
fi

echo "[ml] Starting ForestGuard backend on :${PORT}"
mkdir -p logs
nohup python3 -m uvicorn server.app:app --host 0.0.0.0 --port "$PORT" \
    >> logs/ml-server.log 2>&1 &
echo "[ml] started with PID $!"
