#!/usr/bin/env bash
# Sourced by setup, build and serve; keeps all dependencies inside this checkout.
site_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
site_runtime="$site_root/.local/runtime/arm64"
if [[ -x "$site_runtime/bin/ruby" ]]; then
  export DYLD_LIBRARY_PATH="$site_runtime/lib${DYLD_LIBRARY_PATH:+:$DYLD_LIBRARY_PATH}"
  export RUBYLIB="$site_runtime/lib/ruby/3.4.0:$site_runtime/lib/ruby/3.4.0/arm64-darwin23${RUBYLIB:+:$RUBYLIB}"
  export SSL_CERT_FILE="${SSL_CERT_FILE:-/etc/ssl/cert.pem}"
  export PATH="$site_runtime/bin:$PATH"
  site_ruby="$site_runtime/bin/ruby"
else
  site_ruby="$(command -v ruby)"
fi
export GEM_HOME="$site_root/.local/gems"
site_default_gems="$("$site_ruby" -e 'puts Gem.default_dir')"
export GEM_PATH="$GEM_HOME:$site_default_gems"
export PATH="$GEM_HOME/bin:$PATH"
