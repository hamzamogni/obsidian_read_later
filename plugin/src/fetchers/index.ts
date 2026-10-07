import type { FetchedItem } from "../note";
import type { Source, SourceKind } from "../url";
import { fetchArticle } from "./article";
import type { Http } from "./http";
import { fetchX } from "./x";
import { fetchYoutube } from "./youtube";

type Fetcher<K extends SourceKind> = (source: Extract<Source, { kind: K }>, http: Http) => Promise<FetchedItem>;

export const FETCHERS: { [K in SourceKind]: Fetcher<K> } = {
  article: fetchArticle,
  youtube: fetchYoutube,
  x: fetchX,
};

export const fetchItem = (source: Source, http: Http): Promise<FetchedItem> =>
  (FETCHERS[source.kind] as Fetcher<SourceKind>)(source as never, http);
