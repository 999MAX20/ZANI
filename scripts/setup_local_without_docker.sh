#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [ ! -d ".venv" ]; then
  python3 -m venv .venv
fi

source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install --require-hashes -r requirements.txt
python -m pip install --require-hashes -r requirements-dev.txt

if [ ! -f ".env" ]; then
  cp .env.local.example .env
  echo "Created .env from .env.local.example"
else
  echo ".env already exists; keeping it unchanged"
fi

python manage.py migrate
python manage.py check

echo "Local backend is ready. Start it with: source .venv/bin/activate && python manage.py runserver 0.0.0.0:8000"
echo "Frontend: cd frontend && npm ci && npm run dev"
