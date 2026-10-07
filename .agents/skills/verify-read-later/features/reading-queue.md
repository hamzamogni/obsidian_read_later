# Reading queue

`Reading queue.base` is a Bases table of notes in the reading folder with `status: unread`, newest `saved` first. The plugin creates it on first load and never overwrites it.

## Sub-features

- Unread notes appear. Setting `status: read` removes a note from the table.
- The base file is created if missing and left alone if present.

## How to get to it (user POV)

Open `01-Resources/Reading/Reading queue.base` from the file explorer.

## Driving it with cdp.mjs

1. Capture two notes (see [browser-capture](browser-capture.md); add a second fixture page to `scripts/fixture-server.mjs`).
2. Open the base: `$RL_CDP eval 'app.workspace.openLinkText("01-Resources/Reading/Reading queue.base", "", false)'`, screenshot it.
3. Mark one read: `$RL_CDP eval 'app.fileManager.processFrontMatter(app.vault.getFileByPath("<note path>"), fm => { fm.status = "read" })'`, screenshot again.

Proof: the first screenshot lists both titles, the second lists one. Also read the note file and confirm `status: read`.

## Gotchas

- Bases rendering is asynchronous. Wait about a second before the screenshot.
- Only the filter and sort are the plugin's own work (`queueBase` in `plugin/src/main.ts`). Table rendering belongs to Obsidian.
