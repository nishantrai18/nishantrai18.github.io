#!/usr/bin/env bash
# Build twice in temporary directories so checks never replace the running preview.
set -euo pipefail
site_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$site_root"
source scripts/setup_env.sh
"$site_ruby" "$GEM_HOME/bin/bundle" exec ruby scripts/check_site.rb --source-only
site_check_dir="$(mktemp -d "${TMPDIR:-/tmp}/nishant-site-check.XXXXXX")"
trap 'rm -rf "$site_check_dir"' EXIT
bash scripts/build.sh --destination "$site_check_dir/root" --quiet
"$site_ruby" "$GEM_HOME/bin/bundle" exec ruby scripts/check_site.rb --site "$site_check_dir/root"
bash scripts/build.sh --destination "$site_check_dir/subpath" --baseurl /__site_check__ --quiet
"$site_ruby" "$GEM_HOME/bin/bundle" exec ruby scripts/check_site.rb --site "$site_check_dir/subpath" --baseurl /__site_check__
