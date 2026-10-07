import { describe, expect, it } from "vitest";
import { appendToInbox, entryKey, parseInbox, rewriteInbox, type Outcome } from "../src/inbox";

const INBOX = [
  "# Inbox",
  "",
  "11- [Recording now available](https://www.astronomer.io/events/webinars/plan-your-airflow-3-upgrade-video/?utm_campaign=x&mkt_tok=y)a",
  "![](https://x.com/0xpili_/status/2106377863163507162)",
  "https://x.com/BHolmesDev/status/2106510336413012463/photo/1 (interesting multi-agent workflow)",
  "- https://effect.website/blog/releases/effect/40 ⚠️ http 503",
  "- [ ] read https://youtu.be/UF8uR6Z6KLc later.",
  "just a thought, no link",
].join("\n");

describe("parseInbox", () => {
  it("extracts one entry per line with a url and cleans the comment", () => {
    expect(parseInbox(INBOX)).toEqual([
      {
        line: 2,
        url: "https://www.astronomer.io/events/webinars/plan-your-airflow-3-upgrade-video/?utm_campaign=x&mkt_tok=y",
        comment: "a",
      },
      { line: 3, url: "https://x.com/0xpili_/status/2106377863163507162", comment: "" },
      { line: 4, url: "https://x.com/BHolmesDev/status/2106510336413012463/photo/1", comment: "interesting multi-agent workflow" },
      { line: 5, url: "https://effect.website/blog/releases/effect/40", comment: "" },
      { line: 6, url: "https://youtu.be/UF8uR6Z6KLc", comment: "read later." },
    ]);
  });
});

describe("rewriteInbox", () => {
  const [astronomer, pili, holmes, effect, youtube] = parseInbox(INBOX).map(entryKey) as [string, string, string, string, string];

  it("removes created and duplicate lines, marks failed lines, keeps the rest", () => {
    const outcomes = new Map<string, Outcome>([
      [astronomer, { kind: "created", path: "Reading/a.md" }],
      [pili, { kind: "duplicate", path: "Reading/b.md", commentAdded: false }],
      [holmes, { kind: "created", path: "Reading/c.md" }],
      [effect, { kind: "failed", error: "http 404" }],
      [youtube, { kind: "failed", error: "player   http 429\nretry later" }],
    ]);
    expect(rewriteInbox(INBOX, outcomes)).toBe(
      [
        "# Inbox",
        "",
        "- https://effect.website/blog/releases/effect/40 ⚠️ http 404",
        "- [ ] read https://youtu.be/UF8uR6Z6KLc later. ⚠️ player http 429 retry later",
        "just a thought, no link",
      ].join("\n"),
    );
  });

  it("replaces the error mark on every failed run instead of appending", () => {
    const failed = new Map<string, Outcome>([[effect, { kind: "failed", error: "timeout" }]]);
    const once = rewriteInbox(INBOX, failed);
    const twice = rewriteInbox(once, failed);
    expect(twice.split("\n")[5]).toBe("- https://effect.website/blog/releases/effect/40 ⚠️ timeout");
  });

  it("keeps lines appended while the run was in flight", () => {
    const atWriteTime = `${INBOX}\nhttps://example.com/new-while-running`;
    const outcomes = new Map<string, Outcome>([
      [astronomer, { kind: "created", path: "a.md" }],
      [pili, { kind: "created", path: "b.md" }],
      [holmes, { kind: "created", path: "c.md" }],
      [effect, { kind: "created", path: "d.md" }],
      [youtube, { kind: "created", path: "e.md" }],
    ]);
    expect(rewriteInbox(atWriteTime, outcomes)).toBe("# Inbox\n\njust a thought, no link\nhttps://example.com/new-while-running");
  });

  it("collapses runs of blank lines left behind", () => {
    const text = "top\n\nhttps://a.com/x\n\n\n\nbottom\n";
    const key = entryKey(parseInbox(text)[0]!);
    expect(rewriteInbox(text, new Map([[key, { kind: "created", path: "x.md" }]]))).toBe("top\n\nbottom\n");
  });
});

describe("appendToInbox", () => {
  it("appends a titled link with the comment on its own line", () => {
    expect(appendToInbox("# Inbox\n\n", { url: "https://a.com/p", title: "A [great] post", comment: " worth  it " })).toBe(
      "# Inbox\n[A great post](https://a.com/p) worth it\n",
    );
    expect(appendToInbox("", { url: "https://en.wikipedia.org/wiki/Go_(game)", title: "Go" })).toBe(
      "https://en.wikipedia.org/wiki/Go_(game)\n",
    );
  });

  it("round-trips through parseInbox", () => {
    const text = appendToInbox("x", { url: "https://a.com/p?utm_source=t", title: "T", comment: "why I saved it" });
    expect(parseInbox(text)).toEqual([{ line: 1, url: "https://a.com/p?utm_source=t", comment: "why I saved it" }]);
  });
});
