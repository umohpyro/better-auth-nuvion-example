// The visitor's Nuvion connection. The API key is only ever read here on the server and stored sealed; it is never returned.
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { NuvionError, nuvionAs } from "@/lib/nuvion-api";
import { deleteCreds, loadCreds, operatorKey, saveCreds } from "@/lib/tenant";

const HOOKBOX = "https://hook.umoh.name.ng";
const HOOKBOX_INBOX = /^https:\/\/hook\.umoh\.name\.ng\/h\/[A-Za-z0-9_-]+$/;
// What this app needs Nuvion to send. expires_in is required by the API but never expires the webhook.
const EVENTS = { inflows: { completed: true, failed: true }, outflows: { created: true, completed: true, failed: true, cancelled: true, refunded: true } };
const createHook = (apiKey: string, entityId: string, url: string, description: string) =>
  nuvionAs<{ id: string; secret?: string }>(apiKey, "POST", "/entity-webhooks", { url, description, entity_id: entityId, expires_in: 2_592_000, enabled_events: EVENTS });
type List<T> = { data: T[] };
const ID = /^[0-9A-Z]{26}$/;

async function userId() {
  return (await auth.api.getSession({ headers: await headers() }))?.user.id ?? null;
}
const fail = (e: unknown) =>
  e instanceof NuvionError
    ? Response.json({ error: e.httpStatus === 401 ? "Nuvion rejected this key. Use a sandbox API key from app.nuvion.dev." : e.message }, { status: 400 })
    : Response.json({ error: e instanceof Error ? e.message : "failed" }, { status: 400 });

export async function GET(req: Request) {
  const uid = await userId();
  if (!uid) return Response.json({ error: "unauthorized" }, { status: 401 });
  const c = await loadCreds(uid);
  return Response.json({
    operatorMode: !!operatorKey(),
    connected: !!c,
    entityId: c?.creds.entityId ?? null,
    accountId: c?.creds.accountId ?? null,
    webhookUrl: c ? `${new URL(req.url).origin}/api/nuvion/webhook/${c.token}` : null,
    webhookSecretSet: !!c?.creds.webhookSecret,
    hookbox: HOOKBOX,
    https: new URL(req.url).protocol === "https:",
    monitoring: !!c?.creds.monitorId,
  });
}

export async function POST(req: Request) {
  const uid = await userId();
  if (!uid) return Response.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json();
  try {
    if (body.action === "lookup") {
      const apiKey = String(body.apiKey ?? "").trim();
      if (apiKey.length < 10) throw new Error("Paste your sandbox API key.");
      let entities: { id: string; name: string }[] = [];
      try {
        const all = await nuvionAs<List<{ id: string; name: string; status: string }>>(apiKey, "GET", "/entities?limit=50");
        entities = all.data.filter((e) => e.status === "approved").map((e) => ({ id: e.id, name: e.name }));
      } catch (e) {
        if (!(e instanceof NuvionError && e.httpStatus === 403)) throw e; // this key's role cannot list entities: ask for the id instead
      }
      const entityId = String(body.entityId ?? entities[0]?.id ?? "");
      let accounts: { id: string; name: string; currency: string }[] = [];
      if (ID.test(entityId)) {
        const list = await nuvionAs<List<{ id: string; display_name?: string; currency: string }>>(apiKey, "GET", `/accounts?entity_id=${entityId}&limit=100`);
        accounts = list.data.map((a) => ({ id: a.id, name: a.display_name ?? a.id, currency: a.currency }));
      }
      return Response.json({ entities, entityId: ID.test(entityId) ? entityId : null, accounts });
    }
    if (body.action === "save") {
      const apiKey = String(body.apiKey ?? "").trim(), entityId = String(body.entityId ?? ""), accountId = String(body.accountId ?? "");
      if (!ID.test(entityId) || !ID.test(accountId)) throw new Error("Choose an entity and an account.");
      await nuvionAs(apiKey, "GET", `/accounts/${accountId}?entity_id=${entityId}`); // proves the key can use this account
      const prev = await loadCreds(uid);
      await saveCreds(uid, { apiKey, entityId, accountId, webhookSecret: prev?.creds.webhookSecret });
      return Response.json({ ok: true });
    }
    if (body.action === "webhook-secret") {
      const prev = await loadCreds(uid);
      if (!prev) throw new Error("Connect your sandbox first.");
      const secret = String(body.secret ?? "").trim();
      if (!/^nv_wsk_[0-9a-f]{64}$/.test(secret)) throw new Error("That is not a webhook signing secret. It starts with nv_wsk_ and is 71 characters long.");
      await saveCreds(uid, { ...prev.creds, webhookSecret: secret });
      return Response.json({ ok: true });
    }
    if (body.action === "create-webhook") {
      const c = await loadCreds(uid);
      if (!c) throw new Error("Connect your sandbox first.");
      const url = `${new URL(req.url).origin}/api/nuvion/webhook/${c.token}`;
      if (!url.startsWith("https://")) throw new Error("Nuvion only delivers to https URLs. Use the hosted app, or put this one behind a tunnel.");
      if (c.creds.webhookId) await nuvionAs(c.creds.apiKey, "DELETE", `/entity-webhooks/${c.creds.webhookId}?entity_id=${c.creds.entityId}`).catch(() => {}); // replace, do not duplicate
      let hook;
      try { hook = await createHook(c.creds.apiKey, c.creds.entityId, url, "better-auth-nuvion example"); }
      catch (e) { if (e instanceof NuvionError && e.httpStatus === 403) throw new Error("This key's role cannot create webhooks. Use a sandbox key with the Owner or Developer role."); throw e; }
      if (!hook.secret) throw new Error("Nuvion did not return a signing secret.");
      await saveCreds(uid, { ...c.creds, webhookId: hook.id, webhookSecret: hook.secret });
      return Response.json({ ok: true });
    }
    if (body.action === "monitor") {
      const c = await loadCreds(uid);
      if (!c) throw new Error("Connect your sandbox first.");
      const url = String(body.inboxUrl ?? "").trim();
      if (!HOOKBOX_INBOX.test(url)) throw new Error("Paste the capture URL of a Hookbox inbox. It looks like https://hook.umoh.name.ng/h/…");
      if (c.creds.monitorId) await nuvionAs(c.creds.apiKey, "DELETE", `/entity-webhooks/${c.creds.monitorId}?entity_id=${c.creds.entityId}`).catch(() => {});
      const hook = await createHook(c.creds.apiKey, c.creds.entityId, url, "Hookbox monitor (better-auth-nuvion example)");
      await saveCreds(uid, { ...c.creds, monitorId: hook.id });
      return Response.json({ ok: true, secret: hook.secret ?? null }); // shown once, for Hookbox's signature check
    }
    if (body.action === "accounts") {
      const c = await loadCreds(uid);
      if (!c) throw new Error("Connect your sandbox first.");
      const list = await nuvionAs<List<{ id: string; display_name?: string; currency: string; balance?: { available?: number } }>>(c.creds.apiKey, "GET", `/accounts?entity_id=${c.creds.entityId}&limit=100`);
      return Response.json({ accounts: list.data.map((a) => ({ id: a.id, name: a.display_name ?? a.id, currency: a.currency, available: a.balance?.available ?? null })) });
    }
    if (body.action === "create-account") {
      const c = await loadCreds(uid);
      if (!c) throw new Error("Connect your sandbox first.");
      const name = String(body.name ?? "").trim().slice(0, 60);
      if (!name) throw new Error("Give the account a name.");
      const a = await nuvionAs<{ id?: string; account?: { id: string } }>(c.creds.apiKey, "POST", "/accounts", { type: "checking", currency: "GBP", display_name: name, entity_id: c.creds.entityId });
      return Response.json({ ok: true, id: a.account?.id ?? a.id });
    }
    if (body.action === "disconnect") {
      const c = await loadCreds(uid);
      if (c) for (const id of [c.creds.webhookId, c.creds.monitorId]) if (id) await nuvionAs(c.creds.apiKey, "DELETE", `/entity-webhooks/${id}?entity_id=${c.creds.entityId}`).catch(() => {}); // clean up what we created
      await deleteCreds(uid);
      return Response.json({ ok: true });
    }
    return Response.json({ error: "unknown action" }, { status: 400 });
  } catch (e) {
    return fail(e);
  }
}
