#!/usr/bin/env bash
# Read-only. Exit 0 means the verification instance is worth driving.
. "$(dirname "$0")/env.sh"
fail=0
check() { if eval "$2" >/dev/null 2>&1; then echo "ok    $1"; else echo "FAIL  $1"; fail=1; fi; }

check "our Obsidian pid is alive" 'kill -0 "$(cat $RL_SCRATCH/obsidian.pid)"'
check "CDP port $RL_CDP_PORT is owned by our pid" '[ "$(lsof -nP -iTCP:$RL_CDP_PORT -sTCP:LISTEN -t | head -1)" = "$(cat $RL_SCRATCH/obsidian.pid)" ]'
check "open vault is the scratch vault" '[ "$($RL_CDP eval "app.vault.adapter.basePath")" = "\"$RL_VAULT\"" ]'
check "plugin enabled with the plugin build on disk" '[ "$($RL_CDP eval "app.plugins.enabledPlugins.has(\"read-later\")")" = true ]'
check "capture server answers /ping with our token" 'curl -sf -H "x-read-later-token: $RL_TOKEN" http://127.0.0.1:$RL_PLUGIN_PORT/ping'
check "capture server refuses a wrong token" '[ "$(curl -s -o /dev/null -w %{http_code} -H "x-read-later-token: nope" http://127.0.0.1:$RL_PLUGIN_PORT/ping)" = 403 ]'
check "no modal is blocking the window" '[ "$($RL_CDP eval "document.querySelectorAll(\".modal-container\").length")" = 0 ]'
check "fixture server serves /article" 'curl -sf http://127.0.0.1:$RL_FIXTURE_PORT/article'
check "built main.js matches the installed copy" 'cmp "$RL_ROOT/plugin/main.js" "$RL_VAULT/.obsidian/plugins/read-later/main.js"'
exit $fail
