#!/usr/bin/env bash
set -e

echo "=== Installing frontend dependencies ==="
cd frontend
npm install

echo "=== Building React frontend ==="
npm run build

echo "=== Installing backend dependencies ==="
cd ../backend
pip install --upgrade pip
pip install -r requirements.txt

echo "=== Build complete ==="
