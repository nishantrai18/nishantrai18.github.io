#!/usr/bin/env bash
set -euo pipefail
site_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$site_root"

if [[ "$(uname -s)" == Darwin && "$(uname -m)" == arm64 && ! -x .local/runtime/arm64/bin/ruby ]]; then
  python3 scripts/setup_runtime.py
fi

source scripts/setup_env.sh
"$site_ruby" -e 'abort "Ruby 3.4 or newer is required on this platform." if Gem::Version.new(RUBY_VERSION) < Gem::Version.new("3.4")'
"$site_ruby" -S gem install bundler --version 2.6.9 --no-document
"$site_ruby" "$GEM_HOME/bin/bundle" config set --local path vendor/bundle
"$site_ruby" "$GEM_HOME/bin/bundle" install
