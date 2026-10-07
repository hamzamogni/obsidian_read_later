#!/usr/bin/env bash
# Proves browser capture end to end: the request the Chrome extension sends, the note on disk, and the note rendered in Obsidian.
# Run after launch.sh. Writes evidence to scratch/verify-evidence/capture-<timestamp>/.
set -euo pipefail
. "$(dirname "$0")/env.sh"
out=$RL_EVIDENCE/capture-$(date +%Y%m%dT%H%M%S); mkdir -p "$out"
folder=$RL_VAULT/01-Resources/Reading
save() { curl -s -w '\nHTTP %{http_code}\n' -X POST -H 'content-type: application/json' -H "x-read-later-token: $RL_TOKEN" \
  -d "$1" "http://127.0.0.1:$RL_PLUGIN_PORT/save"; }
notes() { find "$folder" -name '*.md' | wc -l | tr -d ' '; }

[ "$(notes)" = 0 ] || { echo "reading folder is not empty; run cleanup.sh and launch.sh for a clean vault" >&2; exit 1; }

echo "== 1. save with tracking params" | tee "$out/steps.log"
save "{\"url\":\"http://127.0.0.1:$RL_FIXTURE_PORT/article?utm_source=newsletter&fbclid=abc\",\"title\":\"Fixture Article For Read Later\"}" | tee -a "$out/steps.log"
for _ in $(seq 40); do [ "$(notes)" = 1 ] && break; sleep 0.5; done
[ "$(notes)" = 1 ] || { echo "FAIL: expected 1 note after first save, found $(notes)" | tee -a "$out/steps.log"; exit 1; }
note=$(find "$folder" -name '*.md')
cp "$note" "$out/note-after-first-save.md"

echo "== 2. same page, different tracking params, with a comment" | tee -a "$out/steps.log"
save "{\"url\":\"http://127.0.0.1:$RL_FIXTURE_PORT/article?utm_medium=social&ref=tw\",\"title\":\"Fixture Article For Read Later\",\"comment\":\"worth rereading\"}" | tee -a "$out/steps.log"
for _ in $(seq 40); do grep -q '^> worth rereading' "$note" && break; sleep 0.5; done
cp "$note" "$out/note-after-second-save.md"
cp "$RL_VAULT/000- Inbox.md" "$out/inbox-after.md"

echo "== 3. checks" | tee -a "$out/steps.log"
fail=0
check() { if eval "$2"; then echo "ok    $1" | tee -a "$out/steps.log"; else echo "FAIL  $1" | tee -a "$out/steps.log"; fail=1; fi; }
check "still exactly one note"                      '[ "$(notes)" = 1 ]'
check "source is normalized (no utm/fbclid/ref)"    'grep -qx "source: http://127.0.0.1:$RL_FIXTURE_PORT/article" "$note"'
check "type is article"                             'grep -qx "type: article" "$note"'
check "status is unread"                            'grep -qx "status: unread" "$note"'
check "title came from the page"                    'grep -q "^title: \"Fixture Article For Read Later\"" "$note"'
check "body is non-empty"                           '[ "$(awk "/^---\$/{n++; next} n>=2" "$note" | grep -c Paragraph)" -ge 3 ]'
check "comment landed as a quote line"              'grep -qx "> worth rereading" "$note"'
check "inbox is untouched (capture bypasses it)"    '[ -z "$(tr -d "[:space:]" < "$RL_VAULT/000- Inbox.md")" ]'

$RL_CDP eval "app.workspace.openLinkText('$(basename "$note" .md)', '', false).then(() => 'opened')" >/dev/null
sleep 1
$RL_CDP screenshot "$out/obsidian-note.png" >/dev/null
echo "evidence: $out"
exit $fail
