import { build } from "esbuild";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const [vault, flag] = process.argv.slice(2);
if (!vault) throw new Error("usage: node scripts/migrate-readwise.mjs <vault> [--apply]");
const apply = flag === "--apply";
const FOLDERS = ["01-Notes/Readwise", "01-Resources/Readwise"].map((f) => join(vault, f));
const READING = join(vault, "01-Resources/Reading");

const bundled = await build({ entryPoints: [new URL("../src/url.ts", import.meta.url).pathname], bundle: true, format: "esm", write: false, platform: "neutral" });
const { normalize } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`);

const meta = (text, key) => text.match(new RegExp(`^- ${key}:? (.*)$`, "m"))?.[1].trim() ?? "";
// Readwise wraps long summaries onto unprefixed lines that run until the next "- " metadata line.
const summaryOf = (text) => text.match(/^- Summary: ([\s\S]*?)\n(?=- |\n|##)/m)?.[1].trim() ?? "";
const TYPES = { "source/books": "book", "source/articles": "article", "source/tweets": "x", "source/podcasts": "podcast" };

function parseHighlights(text) {
  const body = text.split(/^## Highlights\s*$/m)[1] ?? "";
  const out = [];
  let cur = null;
  for (const line of body.split("\n")) {
    if (line.startsWith("- ")) out.push((cur = { lines: [line.slice(2)], tags: [], notes: [] }));
    else if (line.startsWith("## ")) cur = null;
    else if (!cur) continue;
    else if (/^\s+- Tags:/.test(line)) cur.tags.push(...[...line.matchAll(/\[\[([^\]]+)\]\]/g)].map((m) => `#${m[1].trim().replace(/^#+/, "").replace(/[\s-]+/g, "-")}`));
    else if (/^\s+- /.test(line)) cur.notes.push(line.trimEnd());
    else if (line.startsWith("  ") || line === "") cur.lines.push(line.replace(/^ {2}/, ""));
  }
  for (const h of out) while (h.lines.length && !h.lines.at(-1).trim()) h.lines.pop();
  return out;
}

const linkOf = (h) => h.lines.join("\n").match(/\(\[(?:View Highlight|Location\s\d+)\]\(([^)]+)\)\)/)?.[1];
const textOf = (h) => h.lines.join(" ").replace(/\s*\(\[(?:View Highlight|Location\s\d+)\]\([^)]+\)\)/, "").replace(/\s+/g, " ").trim();
// View Highlight ids are unique per highlight. One Kindle location can hold several highlights, so it also needs the text.
const keyOf = (h) => {
  const link = linkOf(h);
  return link?.includes("read.readwise.io") ? link : `${link ?? ""}|${textOf(h).replace(/\*\*|__/g, "")}`;
};
const locationOf = (h) => Number(h.lines.join(" ").match(/\[Location\s(\d+)\]/)?.[1] ?? NaN);
const weight = (h) => h.lines.length + h.tags.length * 10 + h.notes.length * 10;

function renderHighlight(h) {
  const tags = [...new Set(h.tags)].join(" ");
  const lines = h.lines.map((line, i) => {
    const m = line.match(/^(.*?)(\s*\(\[(?:View Highlight|Location\s\d+)\]\([^)]+\)\))?\s*$/);
    const [content, link = ""] = [m[1], m[2]];
    const wrap = content.trim() && !content.includes("==") ? `==${content.trim()}==` : content;
    const tagged = i === 0 && tags ? `${wrap} ${tags}` : wrap;
    return `${i === 0 ? "- " : "  "}${tagged}${link}`;
  });
  return [...lines, ...h.notes].join("\n");
}

function sourceOf(url, highlights) {
  if (url) return normalize(url)?.url ?? url;
  const asin = highlights.map((h) => h.lines.join(" ").match(/asin=([A-Z0-9]{10})/)?.[1]).find(Boolean);
  return asin ? `https://www.amazon.com/dp/${asin}` : "";
}

const yaml = (s) => JSON.stringify(s);
const fileDate = (path) => statSync(path).birthtime.toISOString().slice(0, 10);

const names = [...new Set(FOLDERS.flatMap((f) => (existsSync(f) ? readdirSync(f).filter((n) => n.endsWith(".md")) : [])))].sort();
const readingSources = new Map(
  readdirSync(READING)
    .filter((f) => f.endsWith(".md"))
    .map((f) => [readFileSync(join(READING, f), "utf8").match(/^source:\s*"?([^"\n]*)"?/m)?.[1].trim(), f])
    .filter(([s]) => s)
    .map(([s, f]) => [normalize(s)?.url ?? s, f]),
);

const plan = names.map((name) => {
  const copies = FOLDERS.map((f) => join(f, name)).filter(existsSync);
  const texts = copies.map((p) => readFileSync(p, "utf8"));
  const primary = texts[0];
  const merged = new Map();
  for (const h of texts.flatMap(parseHighlights)) {
    const k = keyOf(h);
    if (!merged.has(k) || weight(h) > weight(merged.get(k))) merged.set(k, h);
  }
  let highlights = [...merged.values()];
  if (highlights.length && highlights.every((h) => !Number.isNaN(locationOf(h)))) highlights.sort((a, b) => locationOf(a) - locationOf(b));

  const type = TYPES[meta(primary, "Category").replace(/^#/, "")] ?? "article";
  const source = sourceOf(texts.map((t) => meta(t, "URL")).find(Boolean), highlights);
  const title = meta(primary, "Full Title") || name.replace(/\.md$/, "");
  const author = texts.map((t) => meta(t, "Author")).find(Boolean) ?? "";
  const summary = texts.map(summaryOf).find(Boolean);
  const cover = primary.match(/^!\[rw-book-cover\]\([^)]+\)$/m)?.[0];
  const saved = copies.map(fileDate).sort()[0];
  const fm = ["---", `source: ${source}`, `type: ${type}`, `title: ${yaml(title)}`, `author: ${yaml(author)}`, "published:", `saved: ${saved}`, "status: read", "tags:", "  - readwise", "---"];
  const body = [cover, summary && `**Summary.** ${summary}`, "## Highlights", highlights.map(renderHighlight).join("\n")].filter(Boolean).join("\n\n");
  const target = join(READING, name);
  const clash = source && readingSources.get(source);
  const skip = clash ? `already in Reading as ${clash}` : existsSync(target) ? "a note with this name already exists in Reading" : null;
  return { name, copies, texts, highlights, type, source, target, skip, note: `${fm.join("\n")}\n\n${body}\n` };
});

const LINK = /\s*\(\[(?:View Highlight|Location\s\d+)\]\([^)]+\)\)/;
const flat = (s) => s.replace(/==|\*\*|__/g, "").replace(/\s+/g, " ").trim();

function findLostHighlights(p) {
  const note = flat(p.note);
  const originals = p.texts.flatMap(parseHighlights);
  const missing = originals.flatMap((h) => h.lines.map((l) => flat(l.replace(LINK, ""))).filter((l) => l && !note.includes(l)));
  const notes = originals.flatMap((h) => h.notes).filter((n) => !note.includes(flat(n)));
  const summaries = p.texts.map(summaryOf).filter((x) => x && !note.includes(flat(x)));
  const linksInside = (p.note.match(/==[^=\n]*\(\[(?:View Highlight|Location\s\d+)\][^=\n]*==/g) ?? []);
  return { missing: [...missing, ...summaries.map((x) => `summary: ${x.slice(0, 40)}`), ...linksInside], notes };
}

let ok = true;
for (const p of plan) {
  const v = findLostHighlights(p);
  const counts = `${p.highlights.length} highlights from ${p.copies.length} cop${p.copies.length > 1 ? "ies" : "y"}`;
  if (v.missing.length || v.notes.length) ok = false;
  console.log(`${p.skip ? "skip" : "move"}  [${p.type}] ${p.name}  ${counts}${p.skip ? `  (${p.skip})` : ""}${v.missing.length || v.notes.length ? `  MISSING ${v.missing.length} lines, ${v.notes.length} notes: ${JSON.stringify([...v.missing, ...v.notes].slice(0, 2))}` : ""}`);
}
const total = plan.reduce((n, p) => n + p.highlights.length, 0);
console.log(`${plan.length} titles, ${total} merged highlights, ${plan.filter((p) => p.skip).length} skipped, verification ${ok ? "passed" : "FAILED"}`);

if (!apply) {
  console.log("dry run: nothing changed. Rerun with --apply.");
} else if (!ok) {
  console.log("not applying: verification failed");
  process.exitCode = 1;
} else {
  const backup = join(homedir(), `readwise-backup-${new Date().toISOString().replace(/[:.]/g, "-")}`);
  for (const f of FOLDERS) cpSync(f, join(backup, f.slice(vault.length + 1)), { recursive: true });
  console.log(`backup: ${backup}`);
  mkdirSync(READING, { recursive: true });
  const written = plan.filter((p) => !p.skip);
  for (const p of written) writeFileSync(p.target, p.note);
  const reread = written.filter((p) => readFileSync(p.target, "utf8") !== p.note);
  if (reread.length) throw new Error(`written notes do not match: ${reread.map((p) => p.name).join(", ")}`);
  for (const p of written) for (const c of p.copies) rmSync(c);
  for (const f of FOLDERS) if (existsSync(f) && !readdirSync(f).length) rmSync(f, { recursive: true });
  console.log(`wrote ${written.length} notes, removed their originals, kept ${plan.length - written.length} skipped titles in place`);
}
