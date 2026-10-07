# Browser capture

The Chrome extension saves the current tab or a right-clicked link. The plugin expands it directly into a note and does not touch the inbox unless expansion fails.

## Sub-features

- Save with tracking params stripped (`utm_*`, `fbclid`, `ref`, ...) so the note's `source` is the normalized URL.
- Saving the same page again, even with different tracking params, makes no second note.
- A `comment` becomes a `> comment` line at the top of the existing note.
- Wrong or missing token gets 403. Non-http(s) URL gets 400.

## How to get to it (user POV)

Click the toolbar button, press `Alt+Shift+L`, or right-click a link and choose **Read later**. The extension POSTs `{url, title}` to `http://127.0.0.1:<port>/save` with header `x-read-later-token`.

## Driving it with curl and cdp.mjs

Run `scripts/drive-capture.sh` after `launch.sh`. It posts twice to `/save`, polls `01-Resources/Reading/` until the note appears, asserts the frontmatter and body from the file on disk, opens the note over CDP and screenshots it.

For the error paths, post with `-H "x-read-later-token: wrong"` (expect 403) or `-d '{"url":"ftp://x"}'` (expect 400) and assert no file appeared.

## Gotchas

- The script requires an empty reading folder. Relaunch for a clean vault.
- The fixture article is on `127.0.0.1`. Real sites also exercise defuddle against messier HTML, so use a real URL when changing `fetchers/article.ts`.
- A failed expansion writes the URL to the inbox with `⚠️ ...`. Check `000- Inbox.md` when no note appears.
