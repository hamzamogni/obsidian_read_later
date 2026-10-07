# Read later for Obsidian

A personal read-it-later system that lives in your vault. You drop links into an inbox note. The `read-later` plugin turns each link into its own reading note. An article becomes its text, a YouTube video its transcript, and an X post its whole thread. You highlight with `==text==` and inline `#tags`, and a panel collects every highlight.

The repo has two parts:

- `plugin/` is the Obsidian plugin. It runs on desktop and Android.
- `extension/` is a Chrome extension for one-click saves on desktop. It needs no build step.

## Build the plugin

You need Node 22 or newer.

```sh
cd plugin
npm install
npm test            # unit tests
npm run typecheck
npm run build       # writes plugin/main.js
```

`node scripts/smoke-fetchers.mjs [url ...]` runs the three fetchers against live URLs from Node. It needs the network and is not part of `npm test`.

## Install the plugin

On desktop, run the install script with the path to your vault. It builds the plugin and copies `main.js`, `manifest.json`, and `styles.css` into `<vault>/.obsidian/plugins/read-later/`.

```sh
plugin/scripts/install.sh "/path/to/vault"
```

Then open **Settings > Community plugins**, turn off restricted mode if it is on, and enable **Read later**.

On Android, put the same three files in `<vault>/.obsidian/plugins/read-later/` on the phone. Obsidian Sync does this if it syncs community plugins. Without Sync, copy the files with a file manager. Then enable **Read later** in the phone's community plugin settings.

On first load the plugin creates these files if they are missing. It never overwrites them.

- The inbox note, `000- Inbox.md` by default.
- The reading folder, `01-Resources/Reading` by default.
- `Reading queue.base` in the reading folder. It is a Bases table of notes with `status: unread`, newest first.

You can change the inbox path and the reading folder in **Settings > Read later**.

## Install the Chrome extension

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and select the `extension/` folder.
3. In Obsidian on desktop, open **Settings > Read later** and copy the token.
4. Open the extension's options, paste the token, and click **Save**.
5. Click **Test connection**. It shows "Connected to Obsidian on port 27181." when the plugin answers.

The plugin listens on `127.0.0.1:27181` and accepts requests only with the token. If you change the port in the plugin, change it in the extension options too.

## Save links

- **Desktop browser.** Click the toolbar button or press `Alt+Shift+L` to save the current tab. Right-click a link and choose **Read later** to save the link. Chrome keeps focus and nothing touches your clipboard.
- **Android.** Share a URL into the inbox note. The plugin expands it about 1.5 seconds after the note changes.
- **Any device.** Paste a URL on its own line in the inbox, or open `obsidian://read-later?url=<url>&comment=<text>`.

Desktop captures go straight to a note and never pass through the inbox, unless they fail. That keeps a phone with the same synced vault from expanding the same link at the same time.

Text next to a URL in the inbox becomes a `> comment` line at the top of the note. Saving a link that already has a note adds the new comment to that note instead of creating a second one.

The extension badge shows the save state:

| Badge | Meaning |
|---|---|
| Green `✓` for 1.5 seconds | Obsidian received the link. |
| Amber number | Links wait in the extension's queue because Obsidian is closed. The extension retries every minute and on browser start. |
| Red `!` | The token is missing or wrong. If no token is set, clicking the button opens the options page. |

## Process the inbox

On Android the plugin expands the inbox when Obsidian starts and whenever the inbox note changes. On desktop it expands the inbox only when Obsidian starts and when you run **Read later: Process inbox**. Desktop ignores inbox edits that arrive through sync, so only the phone expands a link you shared from the phone.

Each successful line leaves the inbox. A failed line stays with one error mark, for example `⚠️ page http 404`. The next run replaces that mark instead of adding another. Fix or delete the line yourself.

## Read and highlight

Open **Reading queue** to see unread notes. Read a note, highlight with `==text==`, and add tags after the highlight: `==the key point== #go #agents`. When you finish, set `status: read` in the note's properties.

Open the highlights panel with the highlighter ribbon icon or the command **Read later: Open highlights**. It lists every highlight in the reading folder, grouped by tag or by note. Click a highlight to open its note at that line.
