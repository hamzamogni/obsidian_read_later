#!/usr/bin/env node
// usage: cdp.mjs eval '<js expression>'   prints the JSON result
//        cdp.mjs screenshot <out.png>
const PORT = process.env.RL_CDP_PORT ?? "9333";
const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
const page = targets.find((t) => t.type === "page" && t.url.startsWith("app://obsidian.md/index.html"));
if (!page) throw new Error(`no Obsidian vault window on CDP port ${PORT}`);

const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((ok, no) => ((ws.onopen = ok), (ws.onerror = no)));
let id = 0;
const pending = new Map();
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id) pending.get(msg.id)?.(msg), pending.delete(msg.id);
};
const send = (method, params = {}) => new Promise((ok) => (pending.set(++id, ok), ws.send(JSON.stringify({ id, method, params }))));

const [cmd, arg] = process.argv.slice(2);
if (cmd === "eval") {
  const r = await send("Runtime.evaluate", { expression: arg, awaitPromise: true, returnByValue: true });
  if (r.result.exceptionDetails) {
    console.error(r.result.exceptionDetails.exception?.description ?? JSON.stringify(r.result.exceptionDetails));
    process.exitCode = 1;
  } else console.log(JSON.stringify(r.result.result.value));
} else if (cmd === "screenshot") {
  const r = await send("Page.captureScreenshot", { format: "png" });
  (await import("node:fs")).writeFileSync(arg, Buffer.from(r.result.data, "base64"));
  console.log(arg);
} else {
  console.error("usage: cdp.mjs eval '<js>' | screenshot <out.png>");
  process.exitCode = 2;
}
ws.close();
