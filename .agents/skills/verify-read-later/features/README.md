# Feature map for read-later

One file per user-facing feature. Each says how a user reaches it, how to drive it with `launch.sh` + `cdp.mjs`/curl, and what end state proves it. Status shows whether a run has actually executed the recipe.

| Feature | Status |
|---|---|
| [Browser capture](browser-capture.md) | proven by `scripts/drive-capture.sh` |
| [Inbox expansion](inbox-expansion.md) | recipe written, not yet run |
| [Reading queue](reading-queue.md) | recipe written, not yet run |
| [Highlights panel](highlights-panel.md) | recipe written, not yet run |

A proof that drives one entry point is incomplete when the feature file lists others. Update the status column when you run a recipe, and fix the recipe when it fails.
