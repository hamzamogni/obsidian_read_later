export type HttpRequest = {
  url: string;
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
};

export type HttpResponse = {
  status: number;
  text: string;
  headers: Record<string, string>;
};

export type Http = (req: HttpRequest) => Promise<HttpResponse>;

export async function fetchOk(http: Http, req: HttpRequest, label: string): Promise<HttpResponse> {
  const res = await http(req);
  if (res.status < 200 || res.status >= 400) throw new Error(`${label} http ${res.status}`);
  return res;
}

export async function fetchJson<T>(http: Http, req: HttpRequest, label: string): Promise<T> {
  const { text } = await fetchOk(http, req, label);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`${label} returned invalid JSON`);
  }
}

export const header = (res: HttpResponse, name: string) =>
  Object.entries(res.headers).find(([k]) => k.toLowerCase() === name)?.[1] ?? "";
