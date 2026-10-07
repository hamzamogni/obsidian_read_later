import { Notice, type App } from "obsidian";
import { fetchItem } from "./fetchers";
import type { Http } from "./fetchers/http";
import { appendToInbox, entryKey, parseInbox, rewriteInbox, type Capture, type InboxEntry, type Outcome } from "./inbox";
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

const captureEntry = (c: Capture): InboxEntry => ({ line: -1, url: c.url, comment: c.comment ?? "" });

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

export class Expander {
  private running: Promise<void> | null = null;
  private inboxRequested = false;
  private captures: Capture[] = [];
  /** The inbox text this expander last wrote, so its own write does not trigger another run. */
  lastInboxWrite: string | null = null;

  constructor(
    private app: App,
    private settings: () => Settings,
    private http: Http,
  ) {}

  /** Expands every line in the inbox. */
  run(): Promise<void> {
    this.inboxRequested = true;
    return this.schedule();
  }

  /**
   * Expands one desktop capture without passing it through the synced inbox, so another device never sees it
   * half-done and expands it a second time. Only a failed capture is written to the inbox, with its error.
   */
  capture(capture: Capture): Promise<void> {
    this.captures.push(capture);
    return this.schedule();
  }

  private schedule(): Promise<void> {
    if (this.running) return this.running;
    this.running = (async () => {
      try {
        while (this.inboxRequested || this.captures.length) {
          const includeInbox = this.inboxRequested;
          this.inboxRequested = false;
          try {
            await this.runOnce(includeInbox, this.captures.splice(0));
          } catch (err) {
            new Notice(`Read later: ${message(err)}`);
          }
        }
      } finally {
        this.running = null;
      }
    })();
    return this.running;
  }

  private async runOnce(includeInbox: boolean, captures: Capture[]): Promise<void> {
    const { inboxPath, readingFolder } = this.settings();
    const inbox = this.app.vault.getFileByPath(inboxPath);
    const fromInbox = includeInbox && inbox ? parseInbox(await this.app.vault.read(inbox)) : [];
    const fromCaptures = captures.map(captureEntry);
    const entries = [...new Map([...fromInbox, ...fromCaptures].map((e) => [entryKey(e), e])).values()];
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

    const failedCaptures = captures.filter((c) => outcomes.get(entryKey(captureEntry(c)))?.kind === "failed");
    if (!includeInbox && !failedCaptures.length) return;
    const file = inbox ?? (await this.app.vault.create(inboxPath, ""));
    let changed = false;
    this.lastInboxWrite = await this.app.vault.process(file, (text) => {
      // Lines appended mid-run are in this write, so the modify event they caused will be ignored; run again for them.
      if (includeInbox && parseInbox(text).some((e) => !outcomes.has(entryKey(e)))) this.inboxRequested = true;
      const next = rewriteInbox(failedCaptures.reduce(appendToInbox, text), outcomes);
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
