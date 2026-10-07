import { describe, expect, it } from "vitest";
import { insertComment, noteFileName, notePath, renderNote, sourceOf } from "../src/note";

const source = { url: "https://x.com/poteto/status/2106916667599278365", kind: "x" as const, id: "2106916667599278365" };
const item = { title: 'Lauren says "hi": a thread', author: "Lauren Tan (@poteto)", published: "2026-10-04T13:25:00.000Z", body: "\nPost text\n\n" };

describe("renderNote", () => {
  it("writes the spec frontmatter, the comment, then the body", () => {
    expect(renderNote(source, item, "read before standup", "2026-10-06")).toBe(
      [
        "---",
        "source: https://x.com/poteto/status/2106916667599278365",
        "type: x",
        'title: "Lauren says \\"hi\\": a thread"',
        'author: "Lauren Tan (@poteto)"',
        "published: 2026-10-04",
        "saved: 2026-10-06",
        "status: unread",
        "tags: []",
        "---",
        "> read before standup",
        "",
        "Post text",
        "",
      ].join("\n"),
    );
  });

  it("leaves published empty when the date is unknown and parses loose dates", () => {
    const empty = renderNote(source, { ...item, published: "" }, "", "2026-10-06");
    expect(empty.split("\n").slice(5, 7)).toEqual(["published:", "saved: 2026-10-06"]);
    expect(empty.split("\n").slice(9)).toEqual(["---", "", "Post text", ""]);
    const loose = renderNote(source, { ...item, published: "Sep 30, 2026" }, "", "2026-10-06");
    expect(loose.split("\n")[5]).toBe("published: 2026-09-30");
  });
});

describe("noteFileName", () => {
  it("strips characters that are illegal in file names or links and caps length", () => {
    expect(noteFileName('Effect 4.0 / Effect Blog: "what\'s new" [#1]?', "x")).toBe("Effect 4.0 Effect Blog what's new 1");
    expect(noteFileName("a".repeat(100), "x")).toBe("a".repeat(80));
    expect(noteFileName("...", "fallback-id")).toBe("fallback-id");
  });
});

describe("notePath", () => {
  it("appends the id, then a counter, on collisions", () => {
    const taken = new Set(["R/T.md", "R/T 123.md"]);
    expect(notePath("R", "New", "123", (p) => taken.has(p))).toBe("R/New.md");
    expect(notePath("R", "T", "123", (p) => taken.has(p))).toBe("R/T 2.md");
    expect(notePath("R", "T", "456", (p) => taken.has(p))).toBe("R/T 456.md");
  });
});

describe("insertComment", () => {
  const note = renderNote(source, item, "", "2026-10-06");

  it("adds the first comment right after the frontmatter", () => {
    expect(insertComment(note, "second look").split("\n").slice(9, 13)).toEqual(["---", "> second look", "", "Post text"]);
  });

  it("adds later comments after existing ones and skips ones already present", () => {
    const withTwo = insertComment(insertComment(note, "one"), "two");
    expect(withTwo.split("\n").slice(9, 14)).toEqual(["---", "> one", "> two", "", "Post text"]);
    expect(insertComment(withTwo, "one")).toBe(withTwo);
  });

  it("keeps a blank line before a body that starts right after the frontmatter", () => {
    expect(insertComment("---\na: 1\n---\nbody", "c")).toBe("---\na: 1\n---\n> c\n\nbody");
  });
});

describe("sourceOf", () => {
  it("reads the source from the frontmatter only", () => {
    expect(sourceOf(renderNote(source, item, "", "2026-10-06"))).toBe("https://x.com/poteto/status/2106916667599278365");
    expect(sourceOf('---\nsource: "https://a.com/x"\n---\n')).toBe("https://a.com/x");
    expect(sourceOf("no frontmatter\nsource: https://a.com")).toBeNull();
  });
});
