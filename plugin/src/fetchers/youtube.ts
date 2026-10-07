import type { FetchedItem } from "../note";
import type { Source } from "../url";
import { fetchJson, fetchOk, type Http } from "./http";

type Json3 = { events?: { tStartMs: number; segs?: { utf8: string }[] }[] };

type CaptionTrack = { baseUrl: string; languageCode?: string; kind?: string };

type PlayerResponse = {
  captions?: { playerCaptionsTracklistRenderer?: { captionTracks?: CaptionTrack[] } };
  microformat?: { playerMicroformatRenderer?: { publishDate?: string } };
};

const IOS_VERSION = "20.10.4";
const IOS_UA = `com.google.ios.youtube/${IOS_VERSION} (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X;)`;
const IOS_CLIENT = {
  clientName: "IOS",
  clientVersion: IOS_VERSION,
  deviceMake: "Apple",
  deviceModel: "iPhone16,2",
  osName: "iPhone",
  osVersion: "18.3.2.22D82",
};
const WEB_CLIENT = { clientName: "WEB", clientVersion: "2.20250219.01.00" };

const PARAGRAPH_SECONDS = 45;

const pad = (n: number) => String(n).padStart(2, "0");

export function timestamp(seconds: number): string {
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`;
}

export function transcriptMarkdown(json3: Json3, id: string): string {
  const paragraphs: { start: number; parts: string[] }[] = [];
  for (const e of json3.events ?? []) {
    // Caption events are display lines; words never span two events, so events are joined with a space.
    const text = (e.segs ?? []).map((s) => s.utf8).join("").replace(/\s+/g, " ").trim();
    if (!text) continue;
    const start = e.tStartMs / 1000;
    const last = paragraphs.at(-1);
    if (last && start - last.start < PARAGRAPH_SECONDS) last.parts.push(text);
    else paragraphs.push({ start, parts: [text] });
  }
  return paragraphs
    .map((p) => `[${timestamp(p.start)}](https://youtu.be/${id}?t=${Math.floor(p.start)}) ${p.parts.join(" ")}`)
    .join("\n\n");
}

export function youtubeBody(source: Extract<Source, { kind: "youtube" }>, transcript: string): string {
  const embed = `![](${source.url})`;
  return transcript ? `${embed}\n\n## Transcript\n\n${transcript}` : `${embed}\n\nNo transcript was available for this video.`;
}

export function pickTrack(tracks: CaptionTrack[]): CaptionTrack | undefined {
  const english = tracks.filter((t) => t.languageCode?.startsWith("en"));
  return english.find((t) => t.kind !== "asr") ?? english[0] ?? tracks[0];
}

const player = (http: Http, id: string, client: Record<string, string>, clientId: string, ua?: string) =>
  fetchJson<PlayerResponse>(
    http,
    {
      url: "https://www.youtube.com/youtubei/v1/player?prettyPrint=false",
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-youtube-client-name": clientId,
        "x-youtube-client-version": client.clientVersion ?? "",
        ...(ua ? { "user-agent": ua } : {}),
      },
      body: JSON.stringify({ context: { client: { hl: "en", gl: "US", ...client } }, videoId: id, contentCheckOk: true, racyCheckOk: true }),
    },
    "youtube player",
  );

async function transcript(http: Http, id: string): Promise<string> {
  const res = await player(http, id, IOS_CLIENT, "5", IOS_UA);
  const track = pickTrack(res.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? []);
  if (!track) return "";
  const { text } = await fetchOk(http, { url: `${track.baseUrl}&fmt=json3`, headers: { "user-agent": IOS_UA } }, "youtube captions");
  return text.trim() ? transcriptMarkdown(JSON.parse(text) as Json3, id) : "";
}

// The iOS player response has no publish date; the web client's does, even when it refuses playback.
const publishDate = (http: Http, id: string) =>
  player(http, id, WEB_CLIENT, "1").then(
    (r) => r.microformat?.playerMicroformatRenderer?.publishDate ?? "",
    () => "",
  );

export async function fetchYoutube(source: Extract<Source, { kind: "youtube" }>, http: Http): Promise<FetchedItem> {
  const oembedUrl = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(source.url)}`;
  const [meta, text, published] = await Promise.all([
    fetchJson<{ title: string; author_name: string }>(http, { url: oembedUrl }, "youtube oembed"),
    transcript(http, source.id),
    publishDate(http, source.id),
  ]);
  return { title: meta.title, author: meta.author_name, published, body: youtubeBody(source, text) };
}
