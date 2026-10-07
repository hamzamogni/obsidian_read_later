---
name: verify-read-later
description: Drive the read-later Obsidian plugin in a second, isolated Obsidian instance (scratch vault, own ports) and capture proof that a change works. Use after changing anything under plugin/src or extension/ that a user would notice, such as capture, inbox expansion, note format, the queue, or the highlights panel.
---

# Verify read-later

The surface is Obsidian desktop with the `read-later` plugin loaded. The Chrome extension is a thin client for the plugin's HTTP endpoint, so the harness replays its exact request instead of driving Chrome.

Never drive the user's own Obsidian. It is usually running with the real vault (`~/Documents/second_brain`) and the plugin on port 27181. Everything below uses a second Obsidian with its own `--user-data-dir`, a throwaway vault, and different ports. `launch.sh` refuses to start if any of its ports is taken.

All scripts live in `scripts/` next to this file. `env.sh` holds the paths and ports: scratch at `/tmp/read-later-verify`, CDP on 9333, plugin on 27199, fixture server on 27190, token `verifytoken0123456789abcdef`.

## Launch

```sh
.agents/skills/verify-read-later/scripts/launch.sh
```

It builds the plugin, seeds the vault (`data.json` with our port and token, `community-plugins.json`), starts the fixture server and Obsidian, clicks through the "Do you trust the author of this vault?" dialog over CDP, and enables the plugin. It prints `ready: ...` when `/ping` answers. A window opens on screen. That is expected.

Launch always starts from a fresh vault. Rebuild by running `cleanup.sh` then `launch.sh`.

## Doctor

```sh
.agents/skills/verify-read-later/scripts/doctor.sh
```

Read-only. Checks that our pid owns the CDP port, the open vault is the scratch vault, the plugin is enabled, the capture server answers with our token and refuses a wrong one, no modal blocks the window, and the installed `main.js` equals the freshly built one. Run it first whenever a drive misbehaves. A `FAIL` on the last check means you changed source after launch, so relaunch.

## Drive

Two handles, both stable.

**HTTP to the plugin** (browser capture, what the extension sends):

```sh
curl -X POST -H 'content-type: application/json' -H "x-read-later-token: $RL_TOKEN" \
  -d '{"url":"http://127.0.0.1:27190/article","title":"T","comment":"c"}' http://127.0.0.1:27199/save
```

**CDP into Obsidian** for everything else, through `scripts/cdp.mjs`:

```sh
$RL_CDP eval '<js>'          # awaits promises, prints JSON
$RL_CDP screenshot out.png
```

Source `scripts/env.sh` first to get `$RL_CDP`, `$RL_TOKEN`, `$RL_VAULT`. Inside `eval`, `app` is the live Obsidian app. Use real user-path calls:
- Commands: `app.commands.executeCommandById("read-later:process-inbox")` and `"read-later:open-highlights"`.
- Open a note: `app.workspace.openLinkText("<note name>", "", false)`.
- Edit as a user would: `app.vault.modify(file, text)` for note text, `app.fileManager.processFrontMatter(file, fm => ...)` for properties.

The fixture server serves `http://127.0.0.1:27190/article`, a plain article page. Add pages to `scripts/fixture-server.mjs` for new cases. YouTube and X fetchers call the real internet (`api.fxtwitter.com`, YouTube InnerTube), so proofs for those need network and a real URL. `node plugin/scripts/smoke-fetchers.mjs [url...]` checks them from Node without Obsidian.

Mapped features, with exact recipes, are in `features/README.md`. `scripts/drive-capture.sh` is the complete proof for browser capture. Run it as the template for the others.

## Evidence

A proof is complete when it has all three:

1. The action, such as the request and response or the command executed.
2. The side effects on disk in the scratch vault, read back from files, not from the plugin's own state.
3. A `cdp.mjs screenshot` of the result as Obsidian renders it.

Put them in `scratch/verify-evidence/<feature>-<timestamp>/`. That directory is under the gitignored `scratch/`, and `cleanup.sh` never touches it.

Exercise the real path. Do not call plugin methods through `app.plugins.plugins["read-later"]` or write the expected note yourself. The only mock boundary is the fixture server standing in for the open web.

Desktop capture never passes through the inbox unless expansion fails. Do not treat an empty inbox as proof that a link was expanded. Check the note.

## Cleanup

```sh
.agents/skills/verify-read-later/scripts/cleanup.sh
```

Stops only the pids `launch.sh` recorded (Obsidian and the fixture server), confirms the three ports are free, and deletes `/tmp/read-later-verify`. It never matches by process name, so the user's Obsidian is safe. Run it after every failed attempt too.

## Not drivable here

- `obsidian://read-later?...` links. The OS routes them to whichever Obsidian registered the scheme, which is the user's real one. Do not open them. The handler body is `ReadLaterPlugin.capture`, which the HTTP path already covers.
- The Chrome extension itself (badge, queue, `Alt+Shift+L`). That needs a Chrome with the unpacked extension and the scratch token and port in its options. `extension/sw.js` is small, so cover it by reading plus the HTTP replay.
- Android. No device here, and the plugin has never been run on one.
