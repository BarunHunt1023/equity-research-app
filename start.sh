#!/bin/bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "========================================="
echo "  Equity Research Pro — Startup"
echo "========================================="

# Backend
echo ""
echo "[1/3] Installing backend dependencies..."
cd "$ROOT/backend"
pip install -r requirements.txt -q

echo "[2/3] Installing frontend dependencies..."
cd "$ROOT/frontend"
npm install --silent

echo ""
echo "[3/3] Starting servers..."
echo ""
echo "  Backend API : http://localhost:8000"
echo "  Frontend    : http://localhost:5173"
echo ""
echo "  Set ANTHROPIC_API_KEY env var for AI-enhanced reports."
echo "  Example: export ANTHROPIC_API_KEY=sk-ant-..."
echo ""
echo "Press Ctrl+C to stop both servers."
echo "-----------------------------------------"

# Start backend in background
cd "$ROOT/backend"
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

# Start frontend in foreground
cd "$ROOT/frontend"
npm run dev -- --host 0.0.0.0 --port 5173 &
FRONTEND_PID=$!

# Wait and clean up on exit
trap "echo 'Stopping servers...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT
wait
