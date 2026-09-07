#!/usr/bin/env bash
# Idempotent dependency setup for the Fit (aifit-engine) monorepo.
# Prepares the Python core/API and the Next.js web app so Cloud Agents can
# run the scoring engine, the FastAPI service, and the web UI end to end.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

# `python3 -m venv` needs the ensurepip module, which the base image ships
# separately. It is captured in the environment snapshot, but reinstall it
# defensively so setup also works from a bare Python 3.12 image.
if ! python3 -c "import ensurepip" >/dev/null 2>&1; then
  sudo apt-get update
  sudo apt-get install -y python3.12-venv
fi

# Python: create/refresh the virtualenv and install the editable package with
# dev extras (pytest, httpx). Re-running against an existing venv is safe.
python3 -m venv .venv
./.venv/bin/pip install --upgrade pip
./.venv/bin/pip install -e ".[dev]"

# Web: install locked Node dependencies and the Chromium build used by the
# Playwright happy-path e2e suite.
cd apps/web
npm ci
npx playwright install chromium
