import { describe, expect, it } from "vitest";
import { normalize } from "../src/url";

describe("normalize", () => {
  it.each([
    ["https://x.com/poteto/status/2106916667599278365?s=20", "https://x.com/poteto/status/2106916667599278365", "2106916667599278365"],
    ["https://x.com/BHolmesDev/status/2106510336413012463/photo/1", "https://x.com/BHolmesDev/status/2106510336413012463", "2106510336413012463"],
    ["https://twitter.com/karpathy/status/2069465879696576844?t=abc#m", "https://x.com/karpathy/status/2069465879696576844", "2069465879696576844"],
    ["https://mobile.twitter.com/theo/status/2103710437951131865", "https://x.com/theo/status/2103710437951131865", "2103710437951131865"],
    ["https://fxtwitter.com/0xpili_/status/2106377863163507162", "https://x.com/0xpili_/status/2106377863163507162", "2106377863163507162"],
    ["https://vxtwitter.com/trq212/status/2105333496768319969/", "https://x.com/trq212/status/2105333496768319969", "2105333496768319969"],
  ])("maps X url %s to the canonical status url", (raw, url, id) => {
    expect(normalize(raw)).toEqual({ url, kind: "x", id });
  });

  it.each([
    ["https://www.youtube.com/watch?v=UF8uR6Z6KLc&t=42s&list=PL123"],
    ["https://youtu.be/UF8uR6Z6KLc?si=AbCdEf123"],
    ["https://www.youtube.com/shorts/UF8uR6Z6KLc"],
    ["https://m.youtube.com/watch?v=UF8uR6Z6KLc&feature=share"],
    ["https://youtube.com/live/UF8uR6Z6KLc?si=x"],
  ])("maps YouTube url %s to the watch url", (raw) => {
    expect(normalize(raw)).toEqual({ url: "https://www.youtube.com/watch?v=UF8uR6Z6KLc", kind: "youtube", id: "UF8uR6Z6KLc" });
  });

  it("strips tracking params and the hash from articles and keeps the rest", () => {
    expect(
      normalize("https://www.astronomer.io/events/webinars/plan-your-airflow-3-upgrade-video/?utm_campaign=x&mkt_tok=y"),
    ).toEqual({ url: "https://www.astronomer.io/events/webinars/plan-your-airflow-3-upgrade-video/", kind: "article" });
    expect(normalize("https://example.com/post?id=7&utm_source=hn&fbclid=1&gclid=2&mc_cid=3&mc_eid=4&ref=feed&s=09&si=5&q=a%20b#section")).toEqual({
      url: "https://example.com/post?id=7&q=a%20b",
      kind: "article",
    });
  });

  it("treats a non-status X url as an article", () => {
    expect(normalize("https://x.com/karpathy")).toEqual({ url: "https://x.com/karpathy", kind: "article" });
  });

  it("rejects non-http urls and garbage", () => {
    expect(normalize("mailto:a@b.c")).toBeNull();
    expect(normalize("not a url")).toBeNull();
    expect(normalize("https://effect.website/blog/releases/effect/40")).toEqual({
      url: "https://effect.website/blog/releases/effect/40",
      kind: "article",
    });
  });
});
