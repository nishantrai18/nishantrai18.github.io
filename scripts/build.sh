#!/usr/bin/env bash
set -euo pipefail
site_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$site_root"
source scripts/setup_env.sh
JEKYLL_ENV=production "$site_ruby" "$GEM_HOME/bin/bundle" exec jekyll build "$@"
