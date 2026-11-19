// Drives the running app over HTTP, then posts signed webhooks. Needs: npm run mock, npm start, migrated DB.
import { createHmac } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
const B = "http://localhost:3000", O = { Origin: B };
const secret = process.env.NUVION_WEBHOOK_SECRET ?? "nv_wsk_local_test_secret";
let cookie = "";
const api = async (p, body) => {
  const r = await fetch(B + "/api/auth" + p, { method: "POST", headers: { "content-type": "application/json", cookie, ...O }, body: JSON.stringify(body) });
  const sc = r.headers.getSetCookie?.() ?? []; if (sc.length) cookie = sc.map((c) => c.split(";")[0]).join("; ");
  return { status: r.status, json: await r.json().catch(() => null) };
};
const email = process.env.EMAIL ?? `u${Date.now()}@example.com`;
console.log("signup", (await api("/sign-up/email", { email, password: "password1234", name: "T" })).status);
const mk = async (n) => (await api("/organization/create", { name: n, slug: n + Date.now() })).json.id;
const [plat, resel, merch] = [await mk("platform"), await mk("reseller"), await mk("merchant")];
console.log("parent reseller->platform", (await api("/nuvion/organization/parent", { organizationId: resel, parentOrganizationId: plat })).status);
console.log("parent merchant->reseller", (await api("/nuvion/organization/parent", { organizationId: merch, parentOrganizationId: resel })).status);
const cyc = await api("/nuvion/organization/parent", { organizationId: plat, parentOrganizationId: merch });
console.log("cycle platform->merchant (expect 400)", cyc.status, cyc.json?.message);
const o4 = await mk("deep");
const deep = await api("/nuvion/organization/parent", { organizationId: o4, parentOrganizationId: merch });
console.log("depth-4 (expect 400)", deep.status, deep.json?.message);
for (const [o, n] of [[plat, "p"], [resel, "r"], [merch, "m"]]) console.log("bind", n, (await api("/nuvion/organization/bind", { organizationId: o, entityId: "ent_" + n, accountId: "acc_" + n })).status);
const db = new DatabaseSync(process.env.DB_PATH ?? "./dev.db"); // read-only use below; the plugin creates counterparties itself on the first split
console.log("fee reseller (platform takes 2% + 50, payer)", (await api("/nuvion/fee-rule", { organizationId: resel, bps: 200, flatMinor: 50, bearer: "payer" })).status);
console.log("fee merchant (reseller takes 1%, merchant)", (await api("/nuvion/fee-rule", { organizationId: merch, bps: 100, bearer: "merchant" })).status);
const pay = await api("/nuvion/payments", { organizationId: merch, amountMinor: Number(process.env.AMOUNT || 10000), currency: "GBP", redirectUrl: "https://example.com/done" });
console.log("pay", pay.status, JSON.stringify(pay.json));
const ref = db.prepare("select reference from nuvionPayment where id=?").get(pay.json.paymentId).reference;
const send = async (id, body, sig) => {
  const raw = JSON.stringify(body), ts = new Date().toISOString();
  const s = sig ?? createHmac("sha256", secret).update(`${ts}.${raw}`).digest("hex");
  const r = await fetch(B + "/api/auth/nuvion/webhook", { method: "POST", headers: { "content-type": "application/json", "x-nuvion-event-id": id, "x-nuvion-event-timestamp": ts, "x-nuvion-event-signature": s }, body: raw });
  return `${r.status} ${await r.text()}`;
};
if (process.env.NOPOST) { console.log("seeded; stopping before webhooks"); process.exit(0); }
const FAIL = Number(process.env.FAIL || 0);
if (FAIL) await fetch("http://localhost:4010/_mode", { method: "POST", body: JSON.stringify({ transfers: FAIL }) });
const inflow = { event: "inflows.completed", data: { unique_reference: "other-" + ref, narration: ref, amount: pay.json.chargedMinor, currency: "GBP", entity_id: "ent_m" } };
console.log("bad signature (expect 401):", await send("evt_bad", inflow, "deadbeef"));
console.log("good inflows.completed:", await send("evt_in_" + Date.now(), inflow));
console.log("legs:", JSON.stringify(db.prepare("select kind, fromOrganizationId f, toOrganizationId t, amountMinor, state from nuvionLeg").all()));
if (!FAIL) {
  for (const l of db.prepare("select id, attempt from nuvionLeg where state = 'sent'").all()) {
    const r = await send("evt_out_" + l.id, { event: "outflows.completed", data: { unique_reference: `${l.id}-a${l.attempt}` } });
    console.log("outflows.completed (confirmed with the mock):", r);
  }
  console.log("payment:", JSON.stringify(db.prepare("select status from nuvionPayment").all()));
}
if (FAIL && process.env.RETRY !== "0") {
  const st = () => JSON.stringify([db.prepare("select status from nuvionPayment").all(), db.prepare("select state, attempt, error from nuvionLeg").all()]);
  console.log("after failing transfers:", st());
  await fetch("http://localhost:4010/_mode", { method: "POST", body: JSON.stringify({ transfers: null }) });
  const r = await api("/nuvion/payments/retry", { paymentId: pay.json.paymentId });
  console.log("retryLegs", r.status, JSON.stringify(r.json));
  console.log("after retry:", st());
}
