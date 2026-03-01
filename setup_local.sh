#!/bin/bash
# Run this on YOUR local machine to set up Equity Research Pro
set -e

echo "Setting up Equity Research Pro..."

# Check Python
if ! command -v python3 &>/dev/null; then
  echo "ERROR: Python 3 is required. Install from https://python.org"
  exit 1
fi

# Check Node.js
if ! command -v node &>/dev/null; then
  echo "ERROR: Node.js is required. Install from https://nodejs.org"
  exit 1
fi

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "[1/3] Installing Python dependencies..."
cd "$ROOT/backend"
pip install -r requirements.txt

echo "[2/3] Installing Node.js dependencies..."
cd "$ROOT/frontend"
npm install

echo ""
echo "Setup complete! To start the application run:"
echo ""
echo "  ./start.sh"
echo ""
echo "Then open: http://localhost:5173"
echo ""
echo "For AI-enhanced reports, set your API key first:"
echo "  export ANTHROPIC_API_KEY=sk-ant-..."
