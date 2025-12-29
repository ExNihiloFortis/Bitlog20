#!/usr/bin/env bash
set -euo pipefail

./scripts/restore_preflight.sh
./scripts/make_restore_point.sh "${1:-$(date +%F)}"
