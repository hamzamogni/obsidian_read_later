import { Notice, type App } from "obsidian";
import { fetchItem } from "./fetchers";
import type { Http } from "./fetchers/http";
import { entryKey, parseInbox, rewriteInbox, type InboxEntry, type Outcome } from "./inbox";
import { insertComment, localDate, noteFileName, notePath, renderNote, sourceOf } from "./note";
import type { Settings } from "./settings";
import { normalize, type Source } from "./url";

const CONCURRENCY = 4;

async function mapLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  const queue = [...items];
  const worker = async () => {
    for (let item = queue.shift(); item !== undefined; item = queue.shift()) await fn(item);
  };
  await Promise.all(Array.from({ length: Math.min(limit, queue.length) }, worker));
}

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

export class Expander {
  private running: Promise<void> | null = null;
  private dirty = false;
  /** The inbox text this expander last wrote, so its own write does not trigger another run. */
  lastInboxWrite: string | null = null;

  constructor(
    private app: App,
    private settings: () => Settings,
    private http: Http,
  ) {}

  run(): Promise<void> {
    if (this.running) {
      this.dirty = true;
      return this.running;
    }
    this.running = (async () => {
      do {
        this.dirty = false;
        try {
          await this.runOnce();
        } catch (err) {
          new Notice(`Read later: ${message(err)}`);
        }
      } while (this.dirty);
    })().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  private async runOnce(): Promise<void> {
    const { inboxPath, readingFolder } = this.settings();
    const inbox = this.app.vault.getFileByPath(inboxPath);
    if (!inbox) return;
    const entries = [...new Map(parseInbox(await this.app.vault.read(inbox)).map((e) => [entryKey(e), e])).values()];
    if (!entries.length) return;

    const index: Map<string, string | Promise<string>> = await this.sourceIndex(readingFolder);
    const reserved = new Set<string>();
    const outcomes = new Map<string, Outcome>();

    const create = async (source: Source, comment: string) => {
      const item = await fetchItem(source, this.http);
      const id = source.kind === "article" ? undefined : source.id;
      const name = noteFileName(item.title, id ?? new URL(source.url).hostname);
      const path = notePath(readingFolder, name, id, (p) => reserved.has(p) || !!this.app.vault.getAbstractFileByPath(p));
      reserved.add(path);
      await this.app.vault.create(path, renderNote(source, item, comment, localDate(new Date())));
      return path;
    };

    const expand = async (entry: InboxEntry): Promise<Outcome> => {
      try {
        const source = normalize(entry.url);
        if (!source) return { kind: "failed", error: "not a valid http(s) url" };
        const existing = index.get(source.url);
        if (existing) {
          const path = await existing;
          return { kind: "duplicate", path, commentAdded: await this.addComment(path, entry.comment) };
        }
        const creating = create(source, entry.comment);
        index.set(source.url, creating);
        return { kind: "created", path: await creating };
      } catch (err) {
        return { kind: "failed", error: message(err) };
      }
    };

    await mapLimit(entries, CONCURRENCY, async (e) => {
      outcomes.set(entryKey(e), await expand(e));
    });
    let changed = false;
    this.lastInboxWrite = await this.app.vault.process(inbox, (text) => {
      // Lines appended mid-run are in this write, so the modify event they caused will be ignored; run again for them.
      if (parseInbox(text).some((e) => !outcomes.has(entryKey(e)))) this.dirty = true;
      const next = rewriteInbox(text, outcomes);
      changed = next !== text;
      return next;
    });
    // A rerun that only hits the same failures again leaves the inbox as it was and stays quiet.
    if (changed) new Notice(summary([...outcomes.values()]));
  }

  private async sourceIndex(folder: string): Promise<Map<string, string>> {
    const index = new Map<string, string>();
    for (const file of this.app.vault.getMarkdownFiles()) {
      if (!file.path.startsWith(`${folder}/`)) continue;
      const cache = this.app.metadataCache.getFileCache(file);
      // A note created moments ago may not be indexed yet; reading it keeps the next run from duplicating it.
      const raw: unknown = cache ? cache.frontmatter?.source : sourceOf(await this.app.vault.cachedRead(file));
      if (typeof raw === "string") index.set(normalize(raw)?.url ?? raw, file.path);
    }
    return index;
  }

  private async addComment(path: string, comment: string): Promise<boolean> {
    const file = this.app.vault.getFileByPath(path);
    if (!comment || !file) return false;
    let added = false;
    await this.app.vault.process(file, (text) => {
      const next = insertComment(text, comment);
      added = next !== text;
      return next;
    });
    return added;
  }
}

function summary(outcomes: Outcome[]): string {
  const count = (kind: Outcome["kind"]) => outcomes.filter((o) => o.kind === kind).length;
  const parts = [
    [count("created"), "saved"],
    [count("duplicate"), "already saved"],
    [count("failed"), "failed (see inbox)"],
  ].flatMap(([n, label]) => (n ? [`${n} ${label}`] : []));
  return `Read later: ${parts.join(", ")}`;
}
