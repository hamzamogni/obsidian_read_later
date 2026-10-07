import Defuddle from "defuddle/full";
import type { FetchedItem } from "../note";
import type { Source } from "../url";
import { fetchOk, header, type Http } from "./http";

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

export async function fetchArticle(source: Extract<Source, { kind: "article" }>, http: Http): Promise<FetchedItem> {
  const res = await fetchOk(
    http,
    { url: source.url, headers: { "user-agent": BROWSER_UA, accept: "text/html,application/xhtml+xml" } },
    "page",
  );
  const type = header(res, "content-type");
  if (type && !/html|xml/i.test(type)) throw new Error(`not a web page (${type.split(";")[0]})`);
  const doc = new DOMParser().parseFromString(res.text, "text/html");
  const parsed = new Defuddle(doc, { url: source.url, markdown: true }).parse();
  const body = parsed.content.trim();
  if (!body) throw new Error("no readable content found");
  return { title: parsed.title || source.url, author: parsed.author ?? "", published: parsed.published ?? "", body };
}
