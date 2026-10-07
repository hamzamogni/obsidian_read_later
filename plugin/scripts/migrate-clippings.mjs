// Usage: node scripts/migrate-clippings.mjs <vault> [--apply]
// Moves Web Clipper notes from <vault>/Clippings into the reading folder as unread reading notes.
// Without --apply it only prints the plan. With --apply it first copies Clippings to a timestamped backup.
import { build } from "esbuild";
import { cpSync, existsSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const [vault, flag] = process.argv.slice(2);
if (!vault) throw new Error("usage: node scripts/migrate-clippings.mjs <vault> [--apply]");
const apply = flag === "--apply";
const from = join(vault, "Clippings");
const to = join(vault, "01-Resources/Reading");

const bundled = await build({ entryPoints: [new URL("../src/url.ts", import.meta.url).pathname], bundle: true, format: "esm", write: false, platform: "neutral" });
const { normalize } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`);

const field = (fm, key) => fm.match(new RegExp(`^${key}:[ \\t]*"?([^"\\n]*)"?[ \\t]*$`, "m"))?.[1].trim() ?? "";

function setField(fm, key, value, after) {
  const line = `${key}: ${value}`;
  if (new RegExp(`^${key}:`, "m").test(fm)) return fm.replace(new RegExp(`^${key}:.*$`, "m"), line);
  return fm.replace(new RegExp(`^(${after}:.*)$`, "m"), `$1\n${line}`);
}

const existingSources = new Set(
  readdirSync(to)
    .filter((f) => f.endsWith(".md"))
    .map((f) => field(readFileSync(join(to, f), "utf8").split("\n---")[0], "source"))
    .map((s) => normalize(s)?.url ?? s),
);

const plan = readdirSync(from)
  .filter((f) => f.endsWith(".md"))
  .map((name) => {
    const text = readFileSync(join(from, name), "utf8");
    const match = text.match(/^---\n([\s\S]*?)\n---\n?/);
    if (!match) return { name, skip: "no frontmatter" };
    const source = normalize(field(match[1], "source"));
    if (!source) return { name, skip: "no valid source url" };
    if (existingSources.has(source.url)) return { name, skip: `already in Reading as ${source.url}` };
    if (existsSync(join(to, name))) return { name, skip: "a note with this file name already exists in Reading" };
    let fm = setField(match[1], "source", source.url, "title");
    fm = setField(fm, "type", source.kind, "source");
    fm = setField(fm, "saved", field(match[1], "created") || new Date().toISOString().slice(0, 10), "published");
    fm = setField(fm, "status", "unread", "saved");
    return { name, source: source.url, kind: source.kind, next: `---\n${fm}\n---\n${text.slice(match[0].length)}` };
  });

for (const p of plan) console.log(p.skip ? `skip  ${p.name}: ${p.skip}` : `move  ${p.name}  [${p.kind}] ${p.source}`);

if (apply) {
  const backup = join(homedir(), `clippings-backup-${new Date().toISOString().replace(/[:.]/g, "-")}`);
  cpSync(from, backup, { recursive: true });
  console.log(`backup: ${backup}`);
  for (const p of plan.filter((p) => !p.skip)) {
    writeFileSync(join(from, p.name), p.next);
    renameSync(join(from, p.name), join(to, p.name));
  }
  console.log(`moved ${plan.filter((p) => !p.skip).length} of ${plan.length}`);
} else {
  console.log("dry run: nothing changed. Rerun with --apply.");
}
