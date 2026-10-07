#!/usr/bin/env bash
set -euo pipefail

vault="${1:?usage: install.sh <vault-path>}"
[ -d "$vault/.obsidian" ] || { echo "not an Obsidian vault (no .obsidian folder): $vault" >&2; exit 1; }

cd "$(dirname "$0")/.."
npm run --silent build
dest="$vault/.obsidian/plugins/read-later"
mkdir -p "$dest"
cp main.js manifest.json styles.css "$dest/"
echo "installed into $dest; enable \"Read later\" under Settings > Community plugins"
