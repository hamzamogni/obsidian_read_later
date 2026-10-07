import type * as NodeHttp from "node:http";
import type { Capture } from "./inbox";

export type CaptureRequest = {
  method: string;
  path: string;
  origin: string;
  token: string;
  body: string;
};

export type CaptureResponse = {
  status: number;
  headers: Record<string, string>;
  body: string;
  capture?: Capture;
};

const MAX_BODY_BYTES = 64 * 1024;

const optionalString = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

function parseCapture(body: string): Capture | null {
  let data: unknown;
  try {
    data = JSON.parse(body);
  } catch {
    return null;
  }
  const d = (data ?? {}) as Record<string, unknown>;
  if (typeof d.url !== "string" || !/^https?:\/\/\S+$/.test(d.url)) return null;
  return { url: d.url, title: optionalString(d.title), comment: optionalString(d.comment) };
}

export function routeCapture(req: CaptureRequest, token: string): CaptureResponse {
  const fromExtension = req.origin.startsWith("chrome-extension://");
  const cors: Record<string, string> = fromExtension ? { "access-control-allow-origin": req.origin, vary: "origin" } : {};
  const json = (status: number, body: object, capture?: Capture): CaptureResponse => ({
    status,
    headers: { ...cors, "content-type": "application/json" },
    body: JSON.stringify(body),
    capture,
  });

  if (req.method === "OPTIONS") {
    if (!fromExtension) return { status: 403, headers: {}, body: "" };
    return {
      status: 204,
      headers: {
        ...cors,
        "access-control-allow-methods": "GET, POST, OPTIONS",
        "access-control-allow-headers": "content-type, x-read-later-token",
        "access-control-max-age": "600",
      },
      body: "",
    };
  }
  if (!token || req.token !== token) return json(403, { ok: false, error: "missing or wrong token" });
  if (req.method === "GET" && req.path === "/ping") return json(200, { ok: true });
  if (req.method === "POST" && req.path === "/save") {
    const capture = parseCapture(req.body);
    return capture ? json(200, { ok: true }, capture) : json(400, { ok: false, error: "expected JSON {url, title?, comment?} with an http(s) url" });
  }
  return json(404, { ok: false, error: "not found" });
}

export type StopServer = () => void;

const loadDesktopOnlyHttp = () => require("http") as typeof NodeHttp;

export function startCaptureServer(
  port: number,
  token: () => string,
  onCapture: (capture: Capture) => void,
  onError: (message: string) => void,
): StopServer {
  const http = loadDesktopOnlyHttp();
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (chunk: Buffer) => {
      body += chunk.toString("utf8");
      if (body.length > MAX_BODY_BYTES) req.destroy();
    });
    req.on("end", () => {
      const out = routeCapture(
        {
          method: req.method ?? "",
          path: (req.url ?? "").split("?")[0] ?? "",
          origin: String(req.headers.origin ?? ""),
          token: String(req.headers["x-read-later-token"] ?? ""),
          body,
        },
        token(),
      );
      res.writeHead(out.status, out.headers).end(out.body);
      if (out.capture) onCapture(out.capture);
    });
  });
  server.on("error", (err: NodeJS.ErrnoException) =>
    onError(err.code === "EADDRINUSE" ? `port ${port} is already in use, browser capture is off` : err.message),
  );
  server.listen(port, "127.0.0.1");
  return () => server.close();
}
