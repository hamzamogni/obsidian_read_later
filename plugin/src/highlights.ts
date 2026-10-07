export type Highlight = {
  file: string;
  line: number;
  text: string;
  tags: string[];
};

export type GroupBy = "tag" | "note";

export type HighlightGroup = {
  label: string;
  items: Highlight[];
};

const TAG = /#[\p{L}\p{N}_/-]+/gu;
const HIGHLIGHT = /==([^\n]+?)==((?:[ \t]+#[\p{L}\p{N}_/-]+)*)/gu;
const FENCE = /^\s*(`{3,}|~{3,})/;

export function extractHighlights(file: string, markdown: string): Highlight[] {
  const lines = markdown.split("\n");
  const out: Highlight[] = [];
  let i = 0;
  if (lines[0] === "---") {
    const close = lines.indexOf("---", 1);
    if (close !== -1) i = close + 1;
  }
  let fence: string | null = null;
  for (; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const marker = line.match(FENCE)?.[1];
    if (marker) {
      if (!fence) fence = marker;
      else if (marker[0] === fence[0] && marker.length >= fence.length) fence = null;
      continue;
    }
    if (fence) continue;
    for (const m of line.matchAll(HIGHLIGHT)) {
      out.push({ file, line: i, text: (m[1] ?? "").trim(), tags: m[2]?.match(TAG) ?? [] });
    }
  }
  return out;
}

export const UNTAGGED = "Untagged";

export const noteName = (path: string) => (path.split("/").pop() ?? path).replace(/\.md$/, "");

export function groupHighlights(highlights: Highlight[], by: GroupBy): HighlightGroup[] {
  const groups = new Map<string, Highlight[]>();
  for (const h of highlights) {
    const labels = by === "note" ? [noteName(h.file)] : h.tags.length ? h.tags : [UNTAGGED];
    for (const label of labels) groups.set(label, [...(groups.get(label) ?? []), h]);
  }
  const rank = (label: string) => (by === "tag" && label === UNTAGGED ? 1 : 0);
  return [...groups]
    .map(([label, items]) => ({ label, items }))
    .sort((a, b) => rank(a.label) - rank(b.label) || a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
}
