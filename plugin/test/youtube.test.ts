import { describe, expect, it } from "vitest";
import type { HttpRequest } from "../src/fetchers/http";
import { fetchYoutube, timestamp, transcriptMarkdown } from "../src/fetchers/youtube";
import { fakeHttp, fixture, rawFixture } from "./fixtures";

// json3 caption tracks fetched on 2026-10-07 through the iOS player; the Stanford one is cut to its first 56 seconds.
const zoo = fixture<Parameters<typeof transcriptMarkdown>[0]>("youtube-jNQXAC9IVRw-manual.json3");
const stanford = fixture<Parameters<typeof transcriptMarkdown>[0]>("youtube-UF8uR6Z6KLc-asr.json3");

describe("transcriptMarkdown", () => {
  it("joins caption events with spaces into one paragraph under 45 seconds", () => {
    expect(transcriptMarkdown(zoo, "jNQXAC9IVRw")).toBe(
      "[00:01](https://youtu.be/jNQXAC9IVRw?t=1) All right, so here we are, in front of the elephants the cool thing about these guys is that they have really... really really long trunks and that's cool (baaaaaaaaaaahhh!!) and that's pretty much all there is to say",
    );
  });

  it("starts a new timestamped paragraph every 45 seconds and skips newline-only events", () => {
    expect(transcriptMarkdown(stanford, "UF8uR6Z6KLc")).toBe(
      [
        "[00:01](https://youtu.be/UF8uR6Z6KLc?t=1) [Music] this program is brought to you by Stanford University please visit us at stanford.edu thank you I'm uh honored to be with you today for your commencement from one of the finest universities in the [Applause] world truth be told uh I never graduated from college and uh this is the closest I've ever gotten to a college",
        "[00:46](https://youtu.be/UF8uR6Z6KLc?t=46) graduation today I want to tell you three stories from my life that's it no big deal just three stories the first story is about",
      ].join("\n\n"),
    );
  });

  it("formats timestamps past an hour as h:mm:ss", () => {
    expect([timestamp(59.9), timestamp(605), timestamp(3725)]).toEqual(["00:59", "10:05", "1:02:05"]);
  });
});

describe("fetchYoutube", () => {
  const source = { url: "https://www.youtube.com/watch?v=jNQXAC9IVRw", kind: "youtube" as const, id: "jNQXAC9IVRw" };
  const tracks = [
    { baseUrl: "https://www.youtube.com/api/timedtext?lang=de", languageCode: "de" },
    { baseUrl: "https://www.youtube.com/api/timedtext?lang=en-asr", languageCode: "en", kind: "asr" },
    { baseUrl: "https://www.youtube.com/api/timedtext?lang=en", languageCode: "en" },
  ];
  const routes = (captionTracks: typeof tracks) => ({
    "https://www.youtube.com/oembed": () => ({ title: "Me at the zoo", author_name: "jawed" }),
    "https://www.youtube.com/youtubei/v1/player": (req: HttpRequest) =>
      req.headers?.["x-youtube-client-name"] === "5"
        ? { captions: { playerCaptionsTracklistRenderer: { captionTracks } } }
        : { microformat: { playerMicroformatRenderer: { publishDate: "2005-04-23T20:31:52-07:00" } } },
    "https://www.youtube.com/api/timedtext?lang=en&fmt=json3": () => rawFixture("youtube-jNQXAC9IVRw-manual.json3"),
  });

  it("builds the embed and the transcript from the manual English track", async () => {
    const item = await fetchYoutube(source, fakeHttp(routes(tracks)));
    expect({ ...item, body: item.body.split("\n").slice(0, 5) }).toEqual({
      title: "Me at the zoo",
      author: "jawed",
      published: "2005-04-23T20:31:52-07:00",
      body: [
        "![](https://www.youtube.com/watch?v=jNQXAC9IVRw)",
        "",
        "## Transcript",
        "",
        "[00:01](https://youtu.be/jNQXAC9IVRw?t=1) All right, so here we are, in front of the elephants the cool thing about these guys is that they have really... really really long trunks and that's cool (baaaaaaaaaaahhh!!) and that's pretty much all there is to say",
      ],
    });
  });

  it("says no transcript was available when the video has no captions", async () => {
    const item = await fetchYoutube(source, fakeHttp(routes([])));
    expect(item.body).toBe("![](https://www.youtube.com/watch?v=jNQXAC9IVRw)\n\nNo transcript was available for this video.");
  });
});
