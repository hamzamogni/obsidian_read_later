import { describe, expect, it } from "vitest";
import { routeCapture, type CaptureRequest } from "../src/server";

const TOKEN = "s3cret";
const EXT = "chrome-extension://abcdefghijklmnop";
const req = (over: Partial<CaptureRequest>): CaptureRequest => ({ method: "POST", path: "/save", origin: EXT, token: TOKEN, body: "", ...over });

describe("routeCapture", () => {
  it("accepts a save with the right token and returns the capture", () => {
    const res = routeCapture(req({ body: JSON.stringify({ url: "https://a.com/p", title: " A post ", comment: "" }) }), TOKEN);
    expect(res).toEqual({
      status: 200,
      headers: { "access-control-allow-origin": EXT, vary: "origin", "content-type": "application/json" },
      body: '{"ok":true}',
      capture: { url: "https://a.com/p", title: "A post", comment: undefined },
    });
  });

  it("rejects a wrong or missing token with 403 and no capture", () => {
    const body = JSON.stringify({ url: "https://a.com/p" });
    expect([routeCapture(req({ body, token: "nope" }), TOKEN), routeCapture(req({ body, token: "" }), TOKEN)].map((r) => [r.status, r.capture])).toEqual([
      [403, undefined],
      [403, undefined],
    ]);
    expect(routeCapture(req({ method: "GET", path: "/ping", token: "" }), TOKEN).status).toBe(403);
  });

  it("answers ping with the token", () => {
    expect(routeCapture(req({ method: "GET", path: "/ping", origin: "" }), TOKEN)).toEqual({
      status: 200,
      headers: { "content-type": "application/json" },
      body: '{"ok":true}',
      capture: undefined,
    });
  });

  it("answers CORS preflight only for chrome extensions", () => {
    expect(routeCapture(req({ method: "OPTIONS", token: "" }), TOKEN)).toEqual({
      status: 204,
      headers: {
        "access-control-allow-origin": EXT,
        vary: "origin",
        "access-control-allow-methods": "GET, POST, OPTIONS",
        "access-control-allow-headers": "content-type, x-read-later-token",
        "access-control-max-age": "600",
      },
      body: "",
    });
    expect(routeCapture(req({ method: "OPTIONS", origin: "https://evil.example" }), TOKEN).status).toBe(403);
  });

  it("rejects bodies without an http(s) url", () => {
    expect([req({ body: "not json" }), req({ body: '{"url":"javascript:alert(1)"}' }), req({ body: "null" })].map((r) => routeCapture(r, TOKEN).status)).toEqual([
      400, 400, 400,
    ]);
  });
});
