#!/usr/bin/env bash
# Stops only the processes launch.sh recorded. Leaves scratch/verify-evidence/ alone.
. "$(dirname "$0")/env.sh"
for name in obsidian fixture; do
  pidfile=$RL_SCRATCH/$name.pid
  [ -f "$pidfile" ] || continue
  pid=$(cat "$pidfile")
  kill -0 "$pid" 2>/dev/null && kill "$pid"
  for _ in $(seq 20); do kill -0 "$pid" 2>/dev/null || break; sleep 0.25; done
  kill -0 "$pid" 2>/dev/null && { echo "pid $pid ($name) did not exit; leaving it for you to inspect" >&2; continue; }
  rm -f "$pidfile"
done
for p in $RL_CDP_PORT $RL_PLUGIN_PORT $RL_FIXTURE_PORT; do
  lsof -nP -iTCP:$p -sTCP:LISTEN >/dev/null && echo "port $p is still listening" >&2
done
[ -f "$RL_SCRATCH/obsidian.pid" ] || rm -rf "$RL_SCRATCH"
echo "cleaned; evidence kept in $RL_EVIDENCE"
