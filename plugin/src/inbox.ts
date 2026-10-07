export type InboxEntry = {
  line: number;
  url: string;
  comment: string;
};

export type Outcome =
  | { kind: "created"; path: string }
  | { kind: "duplicate"; path: string; commentAdded: boolean }
  | { kind: "failed"; error: string };

export type Capture = {
  url: string;
  title?: string;
  comment?: string;
};

const MD_LINK = /!?\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/;
const MD_LINKS = /!?\[[^\]]*\]\([^)]*\)/g;
const BARE_URL = /https?:\/\/[^\s<>()[\]]+/;
const BARE_URLS = /https?:\/\/\S+/g;
const ERROR_MARK = /\s*⚠️?.*$/;
const LIST_MARKER = /^\s*(?:[-*+](?:\s+\[[ xX]\])?|\d+[.)-])\s*/;

function parseLine(text: string, line: number): InboxEntry | null {
  const body = text.replace(ERROR_MARK, "");
  const url = body.match(MD_LINK)?.[1] ?? body.match(BARE_URL)?.[0].replace(/[.,;:!?'"]+$/, "");
  if (!url) return null;
  const comment = body
    .replace(LIST_MARKER, "")
    .replace(MD_LINKS, " ")
    .replace(BARE_URLS, " ")
    .replace(/[()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return { line, url, comment };
}

export function parseInbox(text: string): InboxEntry[] {
  return text.split("\n").flatMap((l, i) => parseLine(l, i) ?? []);
}

// Identifies an entry across rewrites: line numbers shift when lines are appended or removed mid-run.
export const entryKey = (e: InboxEntry) => `${e.url}\n${e.comment}`;

const shortError = (error: string) => {
  const oneLine = error.replace(/\s+/g, " ").trim();
  return oneLine.length > 80 ? `${oneLine.slice(0, 79)}…` : oneLine;
};

export function rewriteInbox(text: string, outcomes: Map<string, Outcome>): string {
  const kept = text.split("\n").flatMap((l, i) => {
    const entry = parseLine(l, i);
    const outcome = entry && outcomes.get(entryKey(entry));
    if (!outcome) return [l];
    if (outcome.kind === "failed") return [`${l.replace(ERROR_MARK, "")} ⚠️ ${shortError(outcome.error)}`];
    return [];
  });
  return kept.join("\n").replace(/\n{3,}/g, "\n\n");
}

export function appendToInbox(text: string, capture: Capture): string {
  const title = capture.title?.replace(/[[\]\s]+/g, " ").trim();
  const link = title && !/[()]/.test(capture.url) ? `[${title}](${capture.url})` : capture.url;
  const comment = capture.comment?.replace(/\s+/g, " ").trim();
  const base = text.trimEnd();
  return `${base ? `${base}\n` : ""}${comment ? `${link} ${comment}` : link}\n`;
}
