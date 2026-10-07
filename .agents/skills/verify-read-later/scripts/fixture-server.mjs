#!/usr/bin/env node
// Local pages for the article fetcher, so a run needs no internet.
import http from "node:http";

const article = (title, body) => `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<meta name="author" content="Ada Verifier"><meta property="article:published_time" content="2026-10-01T09:00:00Z"></head>
<body><nav>Home About</nav><article><h1>${title}</h1><p class="byline">By Ada Verifier</p>${body}</article><footer>Subscribe</footer></body></html>`;

const pages = {
  "/article": article(
    "Fixture Article For Read Later",
    Array.from({ length: 6 }, (_, i) => `<p>Paragraph ${i + 1}. Reading notes should keep this sentence about verification, because defuddle needs enough prose to call it the main content.</p>`).join(""),
  ),
};

http
  .createServer((req, res) => {
    const page = pages[(req.url ?? "").split("?")[0]];
    res.writeHead(page ? 200 : 404, { "content-type": "text/html; charset=utf-8" }).end(page ?? "not found");
  })
  .listen(Number(process.env.RL_FIXTURE_PORT ?? 27190), "127.0.0.1");
