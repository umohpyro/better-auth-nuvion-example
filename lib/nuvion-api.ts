import { BASE_URL } from "./tenant";

export class NuvionError extends Error {
  constructor(readonly httpStatus: number, readonly type: string, message: string) { super(message); }
}

/** Calls the Nuvion API with an explicit key and returns the unwrapped `data`. Server-only. */
export async function nuvionAs<T>(apiKey: string, method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(BASE_URL + path, { method, cache: "no-store", headers: { Authorization: `Bearer ${apiKey}`, "User-Agent": "better-auth-nuvion-example/0.1", ...(body === undefined ? {} : { "Content-Type": "application/json" }) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new NuvionError(res.status, json.type ?? "error", json.message ?? `Nuvion returned ${res.status}`);
  return json.data as T;
}
