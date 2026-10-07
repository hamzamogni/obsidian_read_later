#!/usr/bin/env bash
# Builds the plugin, seeds a throwaway vault, and starts a second Obsidian that shares nothing with the user's own.
set -euo pipefail
. "$(dirname "$0")/env.sh"

if [ -f "$RL_SCRATCH/obsidian.pid" ] && kill -0 "$(cat "$RL_SCRATCH/obsidian.pid")" 2>/dev/null; then
  echo "a verification Obsidian is already running (pid $(cat "$RL_SCRATCH/obsidian.pid")); run cleanup.sh first" >&2; exit 1
fi
for p in $RL_CDP_PORT $RL_PLUGIN_PORT $RL_FIXTURE_PORT; do
  if lsof -nP -iTCP:$p -sTCP:LISTEN >/dev/null; then echo "port $p is taken by something that is not ours; refusing to start" >&2; exit 1; fi
done

rm -rf "$RL_SCRATCH"
mkdir -p "$RL_VAULT/.obsidian/plugins/read-later" "$RL_SCRATCH/userdata"
(cd "$RL_ROOT/plugin" && npm run --silent build)
cp "$RL_ROOT"/plugin/{main.js,manifest.json,styles.css} "$RL_VAULT/.obsidian/plugins/read-later/"
echo '["read-later"]' > "$RL_VAULT/.obsidian/community-plugins.json"
echo "{\"port\":$RL_PLUGIN_PORT,\"token\":\"$RL_TOKEN\",\"inboxPath\":\"000- Inbox.md\",\"readingFolder\":\"01-Resources/Reading\"}" \
  > "$RL_VAULT/.obsidian/plugins/read-later/data.json"
echo "{\"vaults\":{\"verifyvault0001\":{\"path\":\"$RL_VAULT\",\"ts\":$(date +%s)000,\"open\":true}}}" > "$RL_SCRATCH/userdata/obsidian.json"

nohup node "$(dirname "$0")/fixture-server.mjs" > "$RL_SCRATCH/fixture.log" 2>&1 &
echo $! > "$RL_SCRATCH/fixture.pid"
nohup /Applications/Obsidian.app/Contents/MacOS/Obsidian --user-data-dir="$RL_SCRATCH/userdata" --remote-debugging-port=$RL_CDP_PORT \
  > "$RL_SCRATCH/obsidian.log" 2>&1 &
echo $! > "$RL_SCRATCH/obsidian.pid"

for _ in $(seq 40); do curl -sf "http://127.0.0.1:$RL_CDP_PORT/json/version" >/dev/null && break; sleep 0.5; done
for _ in $(seq 40); do
  $RL_CDP eval 'typeof app !== "undefined" && !!app.workspace.layoutReady' 2>/dev/null | grep -q true && break; sleep 0.5
done

$RL_CDP eval '(async () => {
  const trust = [...document.querySelectorAll("button")].find((b) => b.textContent.includes("Trust author and enable plugins"));
  trust?.click();
  await new Promise((r) => setTimeout(r, 500));
  await app.plugins.setEnable(true);
  await app.plugins.enablePlugin("read-later");
})()' >/dev/null

for _ in $(seq 40); do
  curl -sf -H "x-read-later-token: $RL_TOKEN" "http://127.0.0.1:$RL_PLUGIN_PORT/ping" >/dev/null && { echo "ready: vault=$RL_VAULT plugin=:$RL_PLUGIN_PORT cdp=:$RL_CDP_PORT fixture=:$RL_FIXTURE_PORT"; exit 0; }
  sleep 0.5
done
echo "plugin server never answered on :$RL_PLUGIN_PORT; see $RL_SCRATCH/obsidian.log" >&2; exit 1
