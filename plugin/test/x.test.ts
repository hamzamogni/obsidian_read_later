import { describe, expect, it } from "vitest";
import { fetchX, renderThread, type FxThreadResponse } from "../src/fetchers/x";
import { fakeHttp, fixture } from "./fixtures";

const holmes = fixture<FxThreadResponse>("fx-thread-BHolmesDev.json");
const pili = fixture<FxThreadResponse>("fx-quote-0xpili_.json");
const greg = fixture<FxThreadResponse>("fx-article-gregisenberg.json");

describe("renderThread", () => {
  it("renders a two-post thread with its photo, separated by a rule", () => {
    const item = renderThread(holmes, "2106510336413012463");
    expect(item.title).toBe("@BHolmesDev: Here's the multi-agent system driving our software factory right now.…");
    expect(item.author).toBe("Ben Holmes (@BHolmesDev)");
    expect(item.published).toBe("2026-10-03");
    expect(item.body.split("\n").slice(-7)).toEqual([
      "Curious how this compares to factories others are deploying",
      "",
      "![](https://pbs.twimg.com/media/HTvTvIcWwAEGoF-.jpg?name=orig)",
      "",
      "---",
      "",
      "Here’s a sample of how this translates to code: https://warp.dev/factories/configuration",
    ]);
  });

  it("renders the same thread when asked for from its last post", () => {
    const fromLast = renderThread(holmes, "2106726397175844923");
    expect(fromLast.title).toBe("@BHolmesDev: Here's the multi-agent system driving our software factory right now.…");
    expect(fromLast.body.split("\n\n---\n\n").length).toBe(2);
  });

  it("renders a quoted post as an attributed blockquote with a link back", () => {
    const lines = renderThread(pili, "2106377863163507162").body.split("\n");
    expect(lines.slice(0, 5)).toEqual([
      "the amount of slop has been drastically reduced in my terminal since my agents use this skill to write in ASD-STE100: https://github.com/0xpili/simplified-technical-english",
      "",
      "> **Andrej Karpathy (@karpathy)**",
      "> We'll be spending a lot more time trying to understand the outputs of language models. A few thoughts, tips & tricks:",
      ">",
    ]);
    expect(lines.slice(-2)).toEqual([
      "> ![](https://pbs.twimg.com/media/HTlaHqgbwAAS1lv.png?name=orig)",
      "> [Quoted post](https://x.com/karpathy/status/2105819303471976479)",
    ]);
  });

  it("renders an X Article body with headings, images, numbered lists and links", () => {
    expect(renderThread(greg, "2106737353431581132")).toEqual({
      title: "VIBE MANUFACTURING IS HERE",
      author: "GREG ISENBERG (@gregisenberg)",
      published: "2026-10-04",
      body: [
        "## VIBE MANUFACTURING IS HERE",
        "![](https://pbs.twimg.com/media/HTyiQquWcAAX5dm.jpg)",
        "For the FIRST TIME in HISTORY, you can describe a physical product in one sentence and, a week later, hold it in your hands, cut from metal and built to your exact measurements.",
        "![](https://pbs.twimg.com/media/HTyfbJ3W8AEBoE4.jpg)",
        "## Why hardware was so hard",
        "1. It describes itself. When it connects, it tells the agent exactly what it can sense and do, in plain language.",
        "2. IIt reports its state constantly. Locked or unlocked, full or empty, open or closed, so the agent always knows what's true.",
        "Note: I’ll be adding more hardware startup ideas to [Ideabrowser.com](http://ideabrowser.com/) over the next 30 days.",
      ].join("\n\n"),
    });
  });
});

describe("fetchX", () => {
  it("asks the fxtwitter thread endpoint and fails on an http error", async () => {
    const http = fakeHttp({ "https://api.fxtwitter.com/2/thread/2106377863163507162": () => pili });
    const source = { url: "https://x.com/0xpili_/status/2106377863163507162", kind: "x" as const, id: "2106377863163507162" };
    expect((await fetchX(source, http)).author).toBe("pili 🪴 (@0xpili_)");
    await expect(fetchX({ ...source, id: "1" }, http)).rejects.toThrow("fxtwitter http 404");
  });
});
