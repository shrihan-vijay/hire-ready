#!/usr/bin/env sh
# Start backend and frontend dev servers together.
# Ctrl+C once kills both.

trap 'kill 0' INT TERM

cd "$(dirname "$0")/backend" && venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload &
cd "$(dirname "$0")/frontend" && npm run dev &

wait
