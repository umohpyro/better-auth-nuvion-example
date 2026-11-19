import { createHmac, timingSafeEqual } from "node:crypto";
import { auth } from "@/lib/auth";
import { findByToken, pluginSecret, tenant } from "@/lib/tenant";

/**
 * Each visitor's own webhook URL: https://<host>/api/nuvion/webhook/<token>. Nuvion signs with that visitor's webhook
 * secret, so it is verified here (HMAC-SHA256 over `{timestamp}.{raw body}`), then the event is handed to the plugin's own
 * webhook handler, re-signed with the server's internal secret, inside that visitor's context.
 */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const owner = await findByToken(token);
  if (!owner) return Response.json({ error: "unknown webhook url" }, { status: 404 });
  if (!owner.creds.webhookSecret) return Response.json({ error: "no webhook secret saved for this url; add it on the Settings page" }, { status: 409 });

  const raw = await req.text();
  const ts = req.headers.get("x-nuvion-event-timestamp") ?? "";
  const sig = req.headers.get("x-nuvion-event-signature") ?? "";
  const want = createHmac("sha256", owner.creds.webhookSecret).update(`${ts}.${raw}`).digest("hex");
  const age = Math.abs(Date.now() - Date.parse(ts));
  if (want.length !== sig.length || !timingSafeEqual(Buffer.from(want), Buffer.from(sig)) || !(age < 5 * 60_000))
    return Response.json({ error: "invalid signature" }, { status: 401 });

  const now = new Date().toISOString();
  const forward = new Request(new URL("/api/auth/nuvion/webhook", req.url), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-nuvion-event-id": req.headers.get("x-nuvion-event-id") ?? "",
      "x-nuvion-event-timestamp": now,
      "x-nuvion-event-signature": createHmac("sha256", pluginSecret()).update(`${now}.${raw}`).digest("hex"),
    },
    body: raw,
  });
  return tenant.run({ userId: owner.userId }, () => auth.handler(forward));
}
