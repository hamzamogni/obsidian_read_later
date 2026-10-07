# Sourced by the other scripts. Every path and port here is ours, never the user's.
export RL_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
export RL_SCRATCH=/tmp/read-later-verify
export RL_VAULT=$RL_SCRATCH/vault
export RL_CDP_PORT=9333
export RL_PLUGIN_PORT=27199
export RL_FIXTURE_PORT=27190
export RL_TOKEN=verifytoken0123456789abcdef
export RL_EVIDENCE=$RL_ROOT/scratch/verify-evidence
export RL_CDP="node $RL_ROOT/.agents/skills/verify-read-later/scripts/cdp.mjs"
