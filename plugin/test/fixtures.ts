import { readFileSync } from "node:fs";
import type { Http, HttpRequest } from "../src/fetchers/http";

export const fixture = <T = unknown>(name: string): T =>
  JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8")) as T;

export const rawFixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

type Route = (req: HttpRequest) => unknown;

export const fakeHttp =
  (routes: Record<string, Route>): Http =>
  async (req) => {
    const key = Object.keys(routes).find((k) => req.url.startsWith(k));
    if (!key) return { status: 404, text: "", headers: {} };
    const body = routes[key]!(req);
    return { status: 200, text: typeof body === "string" ? body : JSON.stringify(body), headers: {} };
  };
