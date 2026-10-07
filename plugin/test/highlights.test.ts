import { describe, expect, it } from "vitest";
import { extractHighlights, groupHighlights } from "../src/highlights";

const NOTE = [
  "---",
  "title: \"==not a highlight==\"",
  "tags: []",
  "---",
  "> ==comment highlight== #inbox",
  "",
  "Plain ==first one== #go #agents/tools and ==second== text.",
  "```js",
  "const s = '==in code== #nope';",
  "```",
  "Unicode ==café a = b== #café",
  "Tag needs a space ==glued==#no",
].join("\n");

describe("extractHighlights", () => {
  it("finds highlights with trailing tags outside frontmatter and code", () => {
    expect(extractHighlights("Reading/Post.md", NOTE)).toEqual([
      { file: "Reading/Post.md", line: 4, text: "comment highlight", tags: ["#inbox"] },
      { file: "Reading/Post.md", line: 6, text: "first one", tags: ["#go", "#agents/tools"] },
      { file: "Reading/Post.md", line: 6, text: "second", tags: [] },
      { file: "Reading/Post.md", line: 10, text: "café a = b", tags: ["#café"] },
      { file: "Reading/Post.md", line: 11, text: "glued", tags: [] },
    ]);
  });

  it("treats a note without frontmatter as all body", () => {
    expect(extractHighlights("a.md", "==x== #t")).toEqual([{ file: "a.md", line: 0, text: "x", tags: ["#t"] }]);
  });
});

describe("groupHighlights", () => {
  const hs = [
    ...extractHighlights("R/Zeta.md", "==z1== #go\n==z2=="),
    ...extractHighlights("R/alpha.md", "==a1== #Agents #go"),
  ];

  it("groups by tag, alphabetically, with untagged last", () => {
    expect(groupHighlights(hs, "tag").map((g) => [g.label, g.items.map((h) => h.text)])).toEqual([
      ["#Agents", ["a1"]],
      ["#go", ["z1", "a1"]],
      ["Untagged", ["z2"]],
    ]);
  });

  it("groups by note name", () => {
    expect(groupHighlights(hs, "note").map((g) => [g.label, g.items.map((h) => h.text)])).toEqual([
      ["alpha", ["a1"]],
      ["Zeta", ["z1", "z2"]],
    ]);
  });
});
