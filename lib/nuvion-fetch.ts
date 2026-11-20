import { BASE_URL, loadCreds, operatorKey, tenant } from "./tenant";

/**
 * The `fetch` handed to the plugin (its documented test seam). It puts the current visitor's own API key on each call and
 * pins the host, so one deployment can serve many visitors, each with their own Nuvion tenant.
 */
export const nuvionFetch: typeof fetch = async (input, init) => {
  const url = new URL(
    typeof input === "string" || input instanceof URL ? input : input.url,
  );
  if (url.origin !== new URL(BASE_URL).origin)
    throw new Error("Blocked a request to an unexpected host.");
  const userId = tenant.getStore()?.userId;
  const key =
    (userId && (await loadCreds(userId))?.creds.apiKey) || operatorKey();
  if (!key)
    throw new Error("Connect your Nuvion sandbox on the Settings page first.");
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${key}`);
  headers.set("User-Agent", "better-auth-nuvion-example/0.1");
  return fetch(input, { ...init, headers });
};
