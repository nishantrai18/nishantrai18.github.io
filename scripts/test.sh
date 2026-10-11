#!/usr/bin/env bash
set -euo pipefail
site_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$site_root"

# Prefer an installed Node; Codex's bundled runtime is an optional local fallback.
site_bundled_runtime="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies"
if ! command -v node >/dev/null 2>&1 && [[ -x "$site_bundled_runtime/node/bin/node" ]]; then
  export PATH="$site_bundled_runtime/node/bin:$PATH"
fi
if ! command -v node >/dev/null 2>&1; then
  echo "Install Node.js 20 or newer to run the interaction tests." >&2
  exit 1
fi
if [[ ! -d tests/node_modules/happy-dom ]]; then
  if command -v pnpm >/dev/null 2>&1; then
    pnpm --dir tests install --frozen-lockfile --ignore-scripts
  elif [[ -x "$site_bundled_runtime/bin/fallback/pnpm" ]]; then
    "$site_bundled_runtime/bin/fallback/pnpm" --dir tests install --frozen-lockfile --ignore-scripts
  else
    echo "Run 'cd tests && pnpm install --frozen-lockfile' once, then retry." >&2
    exit 1
  fi
fi
bash scripts/build.sh
node --test tests/site.test.cjs
