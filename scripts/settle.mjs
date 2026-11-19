// Posts signed outflows.completed for every sent leg, then replays one event (should dedupe).
import { createHmac } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
const secret = process.env.NUVION_WEBHOOK_SECRET ?? "nv_wsk_local_test_secret";
const db = new DatabaseSync("./dev.db");
const post = async (id, body) => {
  const raw = JSON.stringify(body), ts = new Date().toISOString();
  const r = await fetch("http://localhost:3000/api/auth/nuvion/webhook", { method: "POST", headers: { "x-nuvion-event-id": id, "x-nuvion-event-timestamp": ts, "x-nuvion-event-signature": createHmac("sha256", secret).update(`${ts}.${raw}`).digest("hex") }, body: raw });
  return `${r.status} ${await r.text()}`;
};
for (const l of db.prepare("select id, attempt from nuvionLeg").all()) {
  const body = { event: "outflows.completed", data: { unique_reference: `${l.id}-a${l.attempt}` } };
  console.log(await post("evt_out_" + l.id, body));
  console.log("replay:", await post("evt_out_" + l.id, body));
}
console.log(db.prepare("select state from nuvionLeg").all(), db.prepare("select status from nuvionPayment").all());
