# Inbox expansion

URLs pasted into `000- Inbox.md` become reading notes. Successful lines leave the inbox. Failed lines stay with one `⚠️` mark that later runs replace.

## Sub-features

- A URL on its own line becomes a note and the line disappears.
- Text next to a URL becomes the note's `> comment`.
- A failing URL (unreachable host, HTTP 404) stays with exactly one error mark, never two.
- Desktop expands only on startup and on the **Process inbox** command. Editing the inbox does nothing on desktop by design.

## How to get to it (user POV)

Paste a link into the inbox note, then run **Read later: Process inbox** from the command palette.

## Driving it with cdp.mjs

1. Write the inbox as a user would: `$RL_CDP eval 'app.vault.modify(app.vault.getFileByPath("000- Inbox.md"), "http://127.0.0.1:27190/article my comment\nhttp://127.0.0.1:27190/missing\n")'`
2. Run the command: `$RL_CDP eval 'app.commands.executeCommandById("read-later:process-inbox")'`
3. Poll the reading folder and read `000- Inbox.md` from `$RL_VAULT`.

Proof: one note for `/article` containing `> my comment`, and an inbox containing only the `/missing` line with a single `⚠️ page http 404`. Run the command a second time and confirm the mark is replaced, not appended.

## Gotchas

- Do not expect the modify event to trigger expansion on desktop.
- `/missing` is served by the fixture server as a 404, so the failure path needs no internet.
