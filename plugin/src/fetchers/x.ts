import type { FetchedItem } from "../note";
import type { Source } from "../url";
import { fetchJson, type Http } from "./http";

type FxAuthor = { screen_name: string; name: string };

type FxMedia = { type: string; url: string; thumbnail_url?: string };

type FxBlock = {
  text: string;
  type: string;
  entityRanges: { key: number; offset: number; length: number }[];
};

type FxEntity = { type: string; data: { url?: string; mediaItems?: { mediaId: string }[] } };

type FxArticle = {
  title: string;
  cover_media?: { media_info?: { original_img_url?: string } };
  content?: { blocks: FxBlock[]; entityMap: { key: string; value: FxEntity }[] | Record<string, FxEntity> };
  media_entities?: { media_id: string; media_info?: { original_img_url?: string } }[];
};

type FxPost = {
  type: string;
  id: string;
  url: string;
  text: string;
  // Posts after the first in a thread carry only the screen name.
  author: FxAuthor | string;
  created_timestamp: number;
  media?: { all?: FxMedia[] };
  quote?: FxPost;
  article?: FxArticle;
};

export type FxThreadResponse = {
  status?: FxPost;
  thread?: FxPost[];
  author?: FxAuthor;
};

const handleOf = (p: FxPost) => (typeof p.author === "string" ? p.author : p.author.screen_name);

const quote = (s: string) =>
  s
    .split("\n")
    .map((l) => (l ? `> ${l}` : ">"))
    .join("\n");

const media = (items: FxMedia[] = []) =>
  items.map((m) => (m.type === "photo" ? `![](${m.url})` : `[![${m.type}](${m.thumbnail_url ?? ""})](${m.url})`)).join("\n");

function linkify(block: FxBlock, entities: Map<string, FxEntity>): string {
  let text = block.text;
  for (const r of [...block.entityRanges].sort((a, b) => b.offset - a.offset)) {
    const url = entities.get(String(r.key))?.data.url;
    if (url) text = `${text.slice(0, r.offset)}[${text.slice(r.offset, r.offset + r.length)}](${url})${text.slice(r.offset + r.length)}`;
  }
  return text;
}

function renderArticle(a: FxArticle): string {
  const em = a.content?.entityMap ?? [];
  const entities = new Map(Array.isArray(em) ? em.map((e) => [String(e.key), e.value]) : Object.entries(em));
  const images = new Map((a.media_entities ?? []).map((m) => [m.media_id, m.media_info?.original_img_url]));
  let n = 0;
  const blocks = (a.content?.blocks ?? []).map((b) => {
    if (b.type !== "ordered-list-item") n = 0;
    if (b.type === "atomic") {
      const id = entities.get(String(b.entityRanges[0]?.key))?.data.mediaItems?.[0]?.mediaId;
      const src = id && images.get(id);
      return src ? `![](${src})` : "";
    }
    const text = linkify(b, entities);
    switch (b.type) {
      case "header-one":
        return `# ${text}`;
      case "header-two":
        return `## ${text}`;
      case "header-three":
        return `### ${text}`;
      case "unordered-list-item":
        return `- ${text}`;
      case "ordered-list-item":
        return `${++n}. ${text}`;
      case "blockquote":
        return quote(text);
      case "code-block":
        return `\`\`\`\n${text}\n\`\`\``;
      default:
        return text;
    }
  });
  const cover = a.cover_media?.media_info?.original_img_url;
  return [`## ${a.title}`, cover ? `![](${cover})` : "", ...blocks].filter(Boolean).join("\n\n");
}

function renderPost(p: FxPost): string {
  const text = p.article && /^https?:\/\/\S+$/.test(p.text.trim()) ? "" : p.text;
  const parts = [text, media(p.media?.all)];
  if (p.quote) {
    const q = p.quote;
    const who = typeof q.author === "string" ? `@${q.author}` : `${q.author.name} (@${q.author.screen_name})`;
    parts.push(quote([`**${who}**`, "", q.text, media(q.media?.all), `[Quoted post](${q.url})`].filter(Boolean).join("\n")));
  }
  if (p.article) parts.push(renderArticle(p.article));
  return parts.filter(Boolean).join("\n\n");
}

const titleFrom = (handle: string, text: string) => {
  const line = text.replace(/https?:\/\/\S+/g, "").split("\n").map((l) => l.trim()).find(Boolean) ?? "";
  const short = line.length > 70 ? `${line.slice(0, 70).replace(/\s+\S*$/, "")}…` : line;
  return short ? `@${handle}: ${short}` : `@${handle} post`;
};

export function renderThread(res: FxThreadResponse, id: string): FetchedItem {
  const posts = (res.thread?.length ? res.thread : res.status ? [res.status] : []).filter((p) => p.type !== "tombstone");
  const target = posts.find((p) => p.id === id) ?? res.status;
  if (!target) throw new Error("fxtwitter returned no post");
  const handle = handleOf(target);
  const own = posts.filter((p) => handleOf(p).toLowerCase() === handle.toLowerCase());
  const first = own[0] ?? target;
  const name = typeof first.author === "string" ? (res.author?.name ?? handle) : first.author.name;
  return {
    title: first.article?.title ?? titleFrom(handle, first.text),
    author: `${name} (@${handle})`,
    published: new Date(first.created_timestamp * 1000).toISOString().slice(0, 10),
    body: own.map(renderPost).join("\n\n---\n\n"),
  };
}

export async function fetchX(source: Extract<Source, { kind: "x" }>, http: Http): Promise<FetchedItem> {
  const res = await fetchJson<FxThreadResponse>(http, { url: `https://api.fxtwitter.com/2/thread/${source.id}` }, "fxtwitter");
  return renderThread(res, source.id);
}
