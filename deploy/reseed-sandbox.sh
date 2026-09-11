#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
python scripts/seed_demo_tenant.py --scenario meridian-cz --tenant-id sandbox
