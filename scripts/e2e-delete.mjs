// "Delete my account" end to end against a running app (npm start, npm run mock, a migrated SQLite DB_PATH).
// Two visitors each build a small hierarchy with a payment. One deletes their account. Everything of theirs must be gone,
// and the other visitor's data must be untouched. Exits non-zero on the first failed check.
import { DatabaseSync } from "node:sqlite";
import assert from "node:assert/strict";

const B = process.env.BASE ?? "http://localhost:3000", O = { Origin: B };
const db = new DatabaseSync(process.env.DB_PATH ?? "./dev.db");
const count = (sql, ...args) => db.prepare(sql).get(...args).n;

async function visitor(label) {
  let cookie = "";
  const call = async (method, path, body) => {
    const r = await fetch(B + path, { method, headers: { "content-type": "application/json", cookie, ...O }, body: body === undefined ? undefined : JSON.stringify(body) });
    const sc = r.headers.getSetCookie?.() ?? [];
    if (sc.length) cookie = sc.map((c) => c.split(";")[0]).join("; ");
    return { status: r.status, json: await r.json().catch(() => null) };
  };
  const email = `${label}-${Date.now()}@example.test`;
  assert.equal((await call("POST", "/api/auth/sign-up/email", { email, password: "password1234", name: label })).status, 200);
  const org = async (n) => (await call("POST", "/api/auth/organization/create", { name: n, slug: `${n}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` })).json.id;
  const [platform, merchant] = [await org(`${label}-platform`), await org(`${label}-merchant`)];
  assert.equal((await call("POST", "/api/auth/nuvion/organization/parent", { organizationId: merchant, parentOrganizationId: platform })).status, 200);
  for (const [o, n] of [[platform, "p"], [merchant, "m"]]) assert.equal((await call("POST", "/api/auth/nuvion/organization/bind", { organizationId: o, entityId: `ent_${label}_${n}`, accountId: `acc_${label}_${n}` })).status, 200);
  assert.equal((await call("POST", "/api/auth/nuvion/fee-rule", { organizationId: merchant, bps: 300 })).status, 200);
  const pay = await call("POST", "/api/auth/nuvion/payments", { organizationId: merchant, amountMinor: 10_000, currency: "GBP", redirectUrl: "https://example.com/done" });
  assert.equal(pay.status, 200, "payment created");
  return { call, email, orgs: [platform, merchant], paymentId: pay.json.paymentId };
}

const leaver = await visitor("leaver"), stayer = await visitor("stayer");
const mine = (v) => ({
  user: count("select count(*) n from user where email = ?", v.email),
  orgs: count(`select count(*) n from organization where id in (${v.orgs.map(() => "?").join(",")})`, ...v.orgs),
  members: count(`select count(*) n from member where organizationId in (${v.orgs.map(() => "?").join(",")})`, ...v.orgs),
  payments: count("select count(*) n from nuvionPayment where id = ?", v.paymentId),
  legs: count("select count(*) n from nuvionLeg where paymentId = ?", v.paymentId),
  bindings: count(`select count(*) n from nuvionBinding where organizationId in (${v.orgs.map(() => "?").join(",")})`, ...v.orgs),
  rules: count(`select count(*) n from nuvionFeeRule where organizationId in (${v.orgs.map(() => "?").join(",")})`, ...v.orgs),
});
const before = mine(leaver);
assert.ok(before.user === 1 && before.orgs === 2 && before.payments === 1 && before.legs >= 1 && before.bindings === 2, "the leaver has data to delete: " + JSON.stringify(before));
const stayerBefore = mine(stayer);

assert.equal((await leaver.call("DELETE", "/api/account", { confirm: "no" })).status, 400, "needs the confirmation word");
assert.equal((await fetch(B + "/api/account", { method: "DELETE", headers: { "content-type": "application/json", ...O }, body: JSON.stringify({ confirm: "DELETE" }) })).status, 401, "needs a session");
assert.deepEqual(mine(leaver), before, "nothing deleted by the refused calls");

assert.equal((await leaver.call("DELETE", "/api/account", { confirm: "DELETE" })).status, 200);
const after = mine(leaver);
assert.deepEqual(after, { user: 0, orgs: 0, members: 0, payments: 0, legs: 0, bindings: 0, rules: 0 }, "everything of the leaver is gone: " + JSON.stringify(after));
assert.equal(count("select count(*) n from session where userId not in (select id from user)"), 0, "no orphaned sessions");
assert.equal((await leaver.call("GET", "/api/auth/get-session")).json, null, "the old session no longer works");
assert.deepEqual(mine(stayer), stayerBefore, "the other visitor's data is untouched");
assert.equal((await stayer.call("GET", "/api/auth/get-session")).json?.user?.email, stayer.email, "the other visitor can still sign in");
console.log("delete account: ok (leaver's data removed, other visitor untouched)");
