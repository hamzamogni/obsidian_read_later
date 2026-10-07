// Runs the real fetchers against live URLs from Node. Not part of the test suite: it needs the network.
// Usage: node scripts/smoke-fetchers.mjs [url ...]
import esbuild from "esbuild";
import { DOMParser } from "linkedom";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const URLS = process.argv.slice(2).length
  ? process.argv.slice(2)
  : [
      "https://effect.website/blog/releases/effect/40",
      "https://x.com/BHolmesDev/status/2106510336413012463",
      "https://www.youtube.com/watch?v=UF8uR6Z6KLc",
    ];

const out = join(mkdtempSync(join(tmpdir(), "read-later-smoke-")), "fetchers.mjs");
await esbuild.build({
  stdin: {
    contents: 'export { fetchItem } from "./src/fetchers/index.ts"; export { normalize } from "./src/url.ts";',
    resolveDir: new URL("..", import.meta.url).pathname,
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: out,
  logLevel: "error",
});
globalThis.DOMParser = DOMParser;
// defuddle's markdown converter looks up window.DOMParser when it loads, which Obsidian has and Node does not.
globalThis.window = { DOMParser };
const { fetchItem, normalize } = await import(pathToFileURL(out).href);

const http = async ({ url, method = "GET", headers, body }) => {
  const res = await fetch(url, { method, headers, body, redirect: "follow", signal: AbortSignal.timeout(30_000) });
  return { status: res.status, text: await res.text(), headers: Object.fromEntries(res.headers) };
};

let failed = 0;
for (const raw of URLS) {
  const source = normalize(raw);
  const started = performance.now();
  try {
    const item = await fetchItem(source, http);
    const words = item.body.match(/\S+/g)?.length ?? 0;
    console.log(`\n== ${source.kind} ${source.url} (${Math.round(performance.now() - started)} ms)`);
    console.log(`title:     ${item.title}`);
    console.log(`author:    ${item.author}`);
    console.log(`published: ${item.published}`);
    console.log(`words:     ${words}`);
    console.log(item.body.split("\n").filter(Boolean).slice(0, 4).map((l) => `  | ${l.slice(0, 160)}`).join("\n"));
    if (!words) failed++;
  } catch (err) {
    failed++;
    console.log(`\n== ${raw} FAILED: ${err.message}`);
  }
}
writeFileSync(out, "");
process.exit(failed ? 1 : 0);
