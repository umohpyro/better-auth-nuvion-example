// Interac and idempotency end to end against the running app and the mock Nuvion.
// Needs: npm run mock, npm start, a migrated DB. Exits non-zero on the first failed check.
import assert from "node:assert/strict";

const B = process.env.BASE ?? "http://localhost:3000";
const MOCK = process.env.MOCK ?? "http://localhost:4010";
const O = { Origin: B };
let cookie = "";
const call = async (method, path, body) => {
  const r = await fetch(B + path, {
    method,
    headers: { "content-type": "application/json", cookie, ...O },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const sc = r.headers.getSetCookie?.() ?? [];
  if (sc.length) cookie = sc.map((c) => c.split(";")[0]).join("; ");
  return { status: r.status, json: await r.json().catch(() => null) };
};
const api = (p, body) => call("POST", "/api/auth" + p, body);
const outcome = (o) =>
  fetch(MOCK + "/_interac", {
    method: "POST",
    body: JSON.stringify({ outcome: o }),
  });
const sessionsCreated = async () =>
  (await (await fetch(MOCK + "/_calls")).json()).filter(
    (c) => c.method === "POST" && c.path === "/funding-sessions",
  ).length;

// The scripts before this one use most of Better Auth's rate limit window (100 requests per 10 seconds per address). Let it reset.
await new Promise((r) => setTimeout(r, 11_000));

const email = `interac${Date.now()}@example.test`;
assert.equal(
  (
    await api("/sign-up/email", {
      email,
      password: "password1234",
      name: "Interac",
    })
  ).status,
  200,
);
const mk = async (n) =>
  (await api("/organization/create", { name: n, slug: n + Date.now() })).json
    .id;
const [platform, merchant] = [await mk("platform"), await mk("merchant")];
assert.equal(
  (
    await api("/nuvion/organization/parent", {
      organizationId: merchant,
      parentOrganizationId: platform,
    })
  ).status,
  200,
);
for (const [o, n] of [
  [platform, "p"],
  [merchant, "m"],
])
  assert.equal(
    (
      await api("/nuvion/organization/bind", {
        organizationId: o,
        entityId: "ent_" + n,
        accountId: "acc_" + n,
      })
    ).status,
    200,
  );
assert.equal(
  (await api("/nuvion/fee-rule", { organizationId: merchant, bps: 300 }))
    .status,
  200,
);

const body = (key) => ({
  organizationId: merchant,
  amountMinor: 10_000,
  currency: "CAD",
  method: "interac",
  payer: { name: "Ada Lovelace", email: "ada@example.test" },
  idempotencyKey: key,
});
const refresh = (id) => api("/nuvion/payments/refresh", { paymentId: id });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// 1. a request is created, with no checkout page; a repeat with the same key is the same payment
await outcome("processing");
const before = await sessionsCreated();
const first = await api("/nuvion/payments", body("order-1"));
assert.equal(first.status, 200, JSON.stringify(first.json));
assert.equal(first.json.method, "interac");
assert.equal(first.json.checkoutUrl, null);
assert.ok(first.json.referenceNumber);
assert.equal(first.json.idempotentReplay, false);
const repeat = await api("/nuvion/payments", body("order-1"));
assert.equal(repeat.json.paymentId, first.json.paymentId);
assert.equal(repeat.json.idempotentReplay, true);
assert.equal(
  (await sessionsCreated()) - before,
  1,
  "one Interac request, not two",
);
assert.equal(
  (await api("/nuvion/payments", { ...body("order-1"), amountMinor: 20_000 }))
    .status,
  409,
  "the same key for another amount",
);
console.log("interac: request created, repeat returned the same payment");

// 2. the payer has not answered: refresh keeps it pending
let r = await refresh(first.json.paymentId);
assert.equal(r.json.paymentStatus, "pending");
console.log("interac: refresh while unanswered -> pending");

// 3. the payer accepts: the next refresh settles it and the platform's share is sent
await outcome("settled");
await wait(10_500); // refresh is limited to one call per payment every 10 seconds
r = await refresh(first.json.paymentId);
assert.equal(r.status, 200, JSON.stringify(r.json));
assert.equal(r.json.recovered, 1);
assert.equal(r.json.paymentStatus, "splitting");
console.log("interac: accepted -> refresh settled it, shares sent (splitting)");

// 4. a second request that the payer declines: it ends as failed
await outcome("failed");
const declined = await api("/nuvion/payments", body("order-2"));
assert.equal(declined.status, 200);
r = await refresh(declined.json.paymentId);
assert.equal(r.json.paymentStatus, "failed");
assert.equal(
  (await api("/nuvion/payments/refund", { paymentId: declined.json.paymentId }))
    .status,
  400,
  "nothing was paid, so nothing to refund",
);
console.log("interac: declined -> failed, and it cannot be refunded");
console.log("interac e2e: ok");
