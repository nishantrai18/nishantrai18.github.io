#!/usr/bin/env bash
set -euo pipefail
site_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$site_root"
source scripts/setup_env.sh
exec "$site_ruby" "$GEM_HOME/bin/bundle" exec jekyll serve --host 127.0.0.1 --port "${PORT:-8767}" "$@"
