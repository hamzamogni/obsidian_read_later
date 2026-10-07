import type { Source } from "./url";

export type FetchedItem = {
  title: string;
  author: string;
  published: string;
  body: string;
};

const pad = (n: number) => String(n).padStart(2, "0");

export const localDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function toIsoDate(raw: string): string {
  const iso = raw.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (iso) return iso;
  const t = Date.parse(raw);
  return Number.isNaN(t) ? "" : localDate(new Date(t));
}

export function renderNote(source: Source, item: FetchedItem, comment: string, saved: string): string {
  const frontmatter = [
    "---",
    `source: ${source.url}`,
    `type: ${source.kind}`,
    `title: ${JSON.stringify(item.title)}`,
    `author: ${JSON.stringify(item.author)}`,
    `published: ${toIsoDate(item.published)}`.trimEnd(),
    `saved: ${saved}`,
    "status: unread",
    "tags: []",
    "---",
  ];
  if (comment) frontmatter.push(`> ${comment}`);
  return `${frontmatter.join("\n")}\n\n${item.body.trim()}\n`;
}

export function noteFileName(title: string, fallback: string): string {
  const name = title
    .replace(/[\\/:*?"<>|#^[\]\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "")
    .slice(0, 80)
    .replace(/[.\s]+$/, "");
  return name || fallback;
}

export function notePath(folder: string, name: string, id: string | undefined, exists: (path: string) => boolean): string {
  const at = (suffix: string) => `${folder}/${name}${suffix}.md`;
  if (!exists(at(""))) return at("");
  if (id && !exists(at(` ${id}`))) return at(` ${id}`);
  for (let n = 2; ; n++) if (!exists(at(` ${n}`))) return at(` ${n}`);
}

const frontmatterEnd = (lines: string[]) => {
  if (lines[0] !== "---") return 0;
  const close = lines.indexOf("---", 1);
  return close === -1 ? 0 : close + 1;
};

// Comments sit directly under the frontmatter with no blank line; the body always starts after a blank line.
export function insertComment(note: string, comment: string): string {
  const quoted = `> ${comment}`;
  const lines = note.split("\n");
  if (!comment || lines.includes(quoted)) return note;
  let at = frontmatterEnd(lines);
  while (lines[at]?.startsWith(">")) at++;
  lines.splice(at, 0, ...(lines[at] === "" ? [quoted] : [quoted, ""]));
  return lines.join("\n");
}

export function sourceOf(note: string): string | null {
  const lines = note.split("\n");
  const fm = lines.slice(1, frontmatterEnd(lines) - 1);
  const raw = fm.find((l) => l.startsWith("source:"))?.slice("source:".length).trim();
  return raw ? raw.replace(/^(["'])(.*)\1$/, "$2") : null;
}
