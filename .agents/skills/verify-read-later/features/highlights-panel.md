# Highlights panel

A right-sidebar view listing every `==highlight==` in the reading folder, grouped by tag or by note. Clicking an entry opens the note at that line.

## Sub-features

- Group by tag (default, untagged last) or by note.
- Inline tags after a highlight (`==text== #go #agents`) put it under each tag.
- Highlights in code fences and frontmatter are ignored.
- The panel refreshes when notes change, are renamed, or are deleted.

## How to get to it (user POV)

Click the highlighter ribbon icon, or run **Read later: Open highlights**.

## Driving it with cdp.mjs

1. Capture a note ([browser-capture](browser-capture.md)).
2. Add a highlight as a user would: read the note with `app.vault.read`, append `\n==the key point== #go #agents\n`, write back with `app.vault.modify`.
3. Open the panel: `$RL_CDP eval 'app.commands.executeCommandById("read-later:open-highlights")'`.
4. Read it back: `$RL_CDP eval 'document.querySelector(".read-later-highlights").innerText'` and screenshot.

Proof: the text lists `the key point` under both `#go` and `#agents`. Click the entry (`querySelector` on its element, then `.click()`) and confirm the active file is the note.

## Gotchas

- The refresh is debounced by 400 ms. Wait before reading the DOM.
- The view's element classes are in `plugin/src/view.ts`. Read it before writing selectors.
