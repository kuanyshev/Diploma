#!/usr/bin/env bash
# Render build: fail fast on any step (matches production expectations).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
python -m pip install -r requirements.txt
python manage.py collectstatic --noinput
python manage.py migrate --noinput
