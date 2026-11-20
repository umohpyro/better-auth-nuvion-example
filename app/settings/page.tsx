"use client";
import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/ui";
import { useData } from "@/lib/data";

type Status = { operatorMode: boolean; connected: boolean; entityId: string | null; accountId: string | null; webhookUrl: string | null; webhookSecretSet: boolean; hookbox: string; https: boolean; monitoring: boolean };
type Lookup = { entities: { id: string; name: string }[]; entityId: string | null; accounts: { id: string; name: string; currency: string }[] };

const post = async (body: unknown) => {
  const r = await fetch("/api/settings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error ?? "Something went wrong");
  return j;
};

export default function Settings() {
  const { toast, refresh } = useData();
  const [st, setSt] = useState<Status | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const deleteMyAccount = async () => {
    setDeleting(true);
    const r = await fetch("/api/account", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirm: "DELETE" }) });
    if (r.ok) { window.location.href = "/"; return; }
    setDeleting(false);
    toast("Could not delete the account. Try again.", true);
  };
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [entityId, setEntityId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [secret, setSecret] = useState("");
  const [inbox, setInbox] = useState("");
  const [monSecret, setMonSecret] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { const r = await fetch("/api/settings"); if (r.ok) setSt(await r.json()); }, []);
  useEffect(() => { load(); }, [load]);
  const act = async (fn: () => Promise<void>) => { setBusy(true); try { await fn(); } catch (e) { toast(e instanceof Error ? e.message : String(e), true); } setBusy(false); };

  const find = (id?: string) => act(async () => {
    const j: Lookup = await post({ action: "lookup", apiKey, entityId: id });
    setLookup(j); setEntityId(j.entityId ?? ""); setAccountId(j.accounts[0]?.id ?? "");
  });
  const save = () => act(async () => { await post({ action: "save", apiKey, entityId, accountId }); setApiKey(""); setLookup(null); toast("Connected"); await load(); await refresh(); });
  const saveSecret = () => act(async () => { await post({ action: "webhook-secret", secret }); setSecret(""); toast("Webhook secret saved"); await load(); await refresh(); });
  const createHook = () => act(async () => { await post({ action: "create-webhook" }); toast("Webhook created"); await load(); await refresh(); });
  const monitor = () => act(async () => { const j = await post({ action: "monitor", inboxUrl: inbox }); setMonSecret(j.secret); setInbox(""); toast("Hookbox will now receive every event too"); await load(); });
  const disconnect = () => act(async () => { await post({ action: "disconnect" }); await load(); await refresh(); });
  const copy = (t: string) => navigator.clipboard?.writeText(t).then(() => toast("Copied"));

  if (!st) return <div className="page"><p>Loading…</p></div>;
  return (
    <>
      <header className="hero small">
        <p className="eyebrow light">Settings</p>
        <h1>Connect your Nuvion sandbox.</h1>
        <p>This demo never uses anyone else&apos;s keys. You bring your own sandbox key, and everything runs in your own Nuvion tenant. Connect a key, create a webhook so Nuvion can tell this app about payments, and optionally watch those webhooks in Hookbox. Everything here uses your own sandbox: payments are real sandbox checkouts and shares move by real sandbox book transfers between your accounts.</p>
      </header>
      <main className="page narrow">
        {st.operatorMode && <div className="notice"><Icon name="gear" /><span>This server has a shared <code>NUVION_API_KEY</code> (operator mode, used for local development with the mock). Per-visitor keys below still take priority.</span></div>}

        <section className="card pad">
          <p className="eyebrow">Step 1</p>
          <h3>Connect a sandbox API key</h3>
          {st.connected && st.entityId ? (
            <>
              <p><span className="badge ok"><Icon name="check" size={14} />Connected</span></p>
              <p className="hint">Entity <code>{st.entityId}</code> · account <code>{st.accountId}</code>. Your key is stored encrypted on the server and never shown again.</p>
              <button className="btn soft sm" disabled={busy} onClick={disconnect}>Disconnect and remove my key</button>
            </>
          ) : (
            <>
              <ol className="steps-text">
                <li>Open the <a href="https://app.nuvion.dev/dashboard/settings" target="_blank" rel="noreferrer">Nuvion sandbox dashboard</a> and create a <b>sandbox</b> secret API key. Use the <b>Owner</b> role: it can list your entities, create webhooks and move funds.</li>
                <li>Paste it below and press <b>Look up</b>. We list your approved entities and their accounts so you can pick instead of copying ids.</li>
                <li>Pick the entity and an account that receives payments, then <b>Save</b>.</li>
              </ol>
              <label className="field"><span>Sandbox API key</span><input type="password" autoComplete="off" spellCheck={false} placeholder="nv_test_sk_…" value={apiKey} onChange={(e) => { setApiKey(e.target.value); setLookup(null); }} /></label>
              <button className="btn primary" disabled={busy || apiKey.length < 10} onClick={() => find()}>Look up my entities</button>
              {lookup && (
                <div style={{ marginTop: 16 }}>
                  {lookup.entities.length > 0 ? (
                    <label className="field"><span>Entity</span>
                      <select value={entityId} onChange={(e) => { setEntityId(e.target.value); find(e.target.value); }}>
                        {lookup.entities.map((e) => <option key={e.id} value={e.id}>{e.name} ({e.id})</option>)}
                      </select>
                    </label>
                  ) : (
                    <label className="field"><span>Entity id (this key cannot list entities)</span><input value={entityId} onChange={(e) => setEntityId(e.target.value.trim())} placeholder="26-character entity id" /></label>
                  )}
                  {lookup.entities.length === 0 && <button className="btn soft sm" disabled={busy} onClick={() => find(entityId)}>Load accounts</button>}
                  {lookup.accounts.length > 0 ? (
                    <label className="field"><span>Account that receives payments</span>
                      <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                        {lookup.accounts.map((a) => <option key={a.id} value={a.id}>{a.name} · {a.currency} ({a.id})</option>)}
                      </select>
                    </label>
                  ) : <p className="hint">No accounts found for this entity. Create one in the sandbox dashboard first. Use a GBP account to match the default payment currency.</p>}
                  <button className="btn primary" disabled={busy || !accountId} onClick={save}>Save connection</button>
                </div>
              )}
            </>
          )}
        </section>

        <section className="card pad" style={{ opacity: st.connected ? 1 : 0.55 }}>
          <p className="eyebrow">Step 2</p>
          <h3>Create your webhook</h3>
          <p>Nuvion tells this app a payment arrived by sending a signed webhook. Without it, payments stay <code>pending</code> forever. This button creates the webhook in your sandbox for you and stores its signing secret on the server, so there is nothing to copy.</p>
          {!st.connected ? <p className="hint">Finish step 1 first. It creates your personal webhook URL.</p> : (
            <>
              <p className="hint">Your personal webhook URL (Nuvion will call this):</p>
              <div className="copyrow"><code className="copy-url">{st.webhookUrl}</code><button className="btn soft sm" onClick={() => copy(st.webhookUrl!)}>Copy</button></div>
              {!st.https && <p className="err">Nuvion only delivers to https URLs, and this page is not on https. Open the hosted app, or put this one behind a tunnel.</p>}
              {st.webhookSecretSet
                ? <p><span className="badge ok"><Icon name="check" size={14} />Webhook created and secret saved</span></p>
                : <p><button className="btn primary" disabled={busy || !st.https} onClick={createHook}>Create my webhook</button></p>}
              {st.webhookSecretSet && <p><button className="btn soft sm" disabled={busy || !st.https} onClick={createHook}>Replace it with a new one</button></p>}
              <details className="panel" style={{ ["--c" as string]: "var(--accent-text)" }}>
                <summary>I already created a webhook another way</summary>
                <p className="hint">Create a webhook with <code>POST /entity-webhooks</code> pointing at the URL above, then paste its signing secret (starts with <code>nv_wsk_</code>; Nuvion shows it once).</p>
                <label className="field"><span>Webhook signing secret</span><input type="password" autoComplete="off" spellCheck={false} placeholder="nv_wsk_…" value={secret} onChange={(e) => setSecret(e.target.value)} /></label>
                <button className="btn primary sm" disabled={busy || secret.length < 10} onClick={saveSecret}>Save secret</button>
              </details>
            </>
          )}
        </section>

        <section className="card pad" style={{ opacity: st.webhookSecretSet ? 1 : 0.55 }}>
          <p className="eyebrow">Step 3 · optional</p>
          <h3>Watch your webhooks in Hookbox</h3>
          <p><a href={st.hookbox} target="_blank" rel="noreferrer">Hookbox</a> is our webhook inbox. It catches every delivery with its headers, body and timing, checks signatures, and can replay events. Use it to see exactly what Nuvion sends.</p>
          <ol className="steps-text">
            <li>Open <a href={st.hookbox} target="_blank" rel="noreferrer">Hookbox</a> and press <b>Create an inbox</b> (no account needed). Copy the inbox&apos;s capture URL, which looks like <code>{st.hookbox}/h/…</code>.</li>
            <li>Paste it here and press <b>Send events to Hookbox too</b>. We register a second webhook in your sandbox that points at the inbox.</li>
            <li>Make a payment. Every event now shows up in Hookbox as it arrives. To check a signature there, paste the secret shown below.</li>
          </ol>
          <label className="field"><span>Hookbox capture URL</span><input value={inbox} onChange={(e) => setInbox(e.target.value.trim())} placeholder={st.hookbox + "/h/…"} /></label>
          <button className="btn primary sm" disabled={busy || !st.webhookSecretSet || !inbox} onClick={monitor}>{st.monitoring ? "Point Hookbox at a new inbox" : "Send events to Hookbox too"}</button>
          {st.monitoring && !monSecret && <p><span className="badge ok"><Icon name="check" size={14} />Hookbox is receiving events</span></p>}
          {monSecret && <div className="notice"><Icon name="key" /><span>Signing secret for Hookbox&apos;s signature check. It is shown once, so copy it now: <code className="copy-url">{monSecret}</code></span><button className="btn soft sm" onClick={() => copy(monSecret)}>Copy</button></div>}
        </section>

        <section className="card pad">
          <h3>What happens to your key</h3>
          <ul className="steps-text">
            <li>It is encrypted (AES-256-GCM) on the server before it is stored, and never sent back to your browser.</li>
            <li>It is used only for your own requests and your own webhook events, and only against the Nuvion sandbox (<code>api.nuvion.dev</code>).</li>
            <li>Why on the server and not in a cookie: splits and retries are triggered by Nuvion&apos;s webhooks, when no browser is open.</li>
            <li><b>Disconnect</b> deletes your key from this server and removes the webhooks this app created in your sandbox.</li>
          </ul>
        </section>
        <section className="card pad">
          <h3>Delete my account</h3>
          <p className="hint">Removes your account and everything this demo holds about you: your organizations with their payments and settings, your Nuvion connection (and the webhooks the demo created in your Nuvion account), your sessions and your sign-in. This cannot be undone. See the <a href="/privacy">privacy notice</a>.</p>
          <label className="field"><span>Type DELETE to confirm</span><input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" /></label>
          <button className="btn soft" disabled={confirmText !== "DELETE" || deleting} onClick={deleteMyAccount}>{deleting ? "Deleting…" : "Delete my account and data"}</button>
        </section>
      </main>
    </>
  );
}
