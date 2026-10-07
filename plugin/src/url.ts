export type Source =
  | { url: string; kind: "article" }
  | { url: string; kind: "youtube"; id: string }
  | { url: string; kind: "x"; id: string };

export type SourceKind = Source["kind"];

type HostRule = (u: URL) => Source | null;

const xStatus: HostRule = (u) => {
  const [, user, id] = u.pathname.match(/^\/(\w{1,15})\/status(?:es)?\/(\d+)/) ?? [];
  return user && id ? { url: `https://x.com/${user}/status/${id}`, kind: "x", id } : null;
};

const youtube = (id: string | null | undefined): Source | null =>
  id && /^[\w-]{11}$/.test(id) ? { url: `https://www.youtube.com/watch?v=${id}`, kind: "youtube", id } : null;

const youtubeCom: HostRule = (u) =>
  youtube(u.pathname === "/watch" ? u.searchParams.get("v") : u.pathname.match(/^\/(?:shorts|live|embed)\/([^/]+)/)?.[1]);

const youtuBe: HostRule = (u) => youtube(u.pathname.split("/")[1]);

const HOST_RULES: Record<string, HostRule> = {
  "x.com": xStatus,
  "mobile.x.com": xStatus,
  "twitter.com": xStatus,
  "mobile.twitter.com": xStatus,
  "fxtwitter.com": xStatus,
  "vxtwitter.com": xStatus,
  "youtube.com": youtubeCom,
  "m.youtube.com": youtubeCom,
  "youtu.be": youtuBe,
};

const TRACKING_PARAMS = new Set(["mkt_tok", "fbclid", "gclid", "mc_cid", "mc_eid", "ref", "s", "si"]);

const isTracking = (pair: string) => {
  const name = decodeURIComponent(pair.split("=")[0] ?? "");
  return name.startsWith("utm_") || TRACKING_PARAMS.has(name);
};

// Filters the raw query string instead of using searchParams so kept params keep their original encoding.
const article = (u: URL): Source => {
  const query = u.search.slice(1).split("&").filter((p) => p && !isTracking(p)).join("&");
  return { url: `${u.origin}${u.pathname}${query ? `?${query}` : ""}`, kind: "article" };
};

export function normalize(raw: string): Source | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  return HOST_RULES[u.hostname.replace(/^www\./, "")]?.(u) ?? article(u);
}
