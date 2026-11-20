// Demo-only helpers: reading the visitor's data for the UI, and (local mock only, DEMO_SIMULATE=1) simulating Nuvion webhooks. Not part of the plugin.
// Uses Better Auth's adapter so it runs on SQLite and Postgres alike.
import { createHmac, randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { loadCreds, operatorKey, pluginSecret, tenant } from "@/lib/tenant";

type Row = Record<string, any>;
const adapter = async () => (await auth.$context).adapter as any;
const IN = (field: string, value: string[]) => [
  { field, operator: "in", value },
];
const EQ = (field: string, value: string) => [{ field, value }];
// bigint columns come back as strings from Postgres
const nums = (r: Row, keys: string[]) => ({
  ...r,
  ...Object.fromEntries(
    keys.filter((k) => r[k] != null).map((k) => [k, Number(r[k])]),
  ),
});

async function session() {
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s) return null;
  const a = await adapter();
  const members: Row[] = await a.findMany({
    model: "member",
    where: EQ("userId", s.user.id),
  });
  return {
    a,
    userId: s.user.id,
    mine: members.map((m) => m.organizationId as string),
    admin: members
      .filter((m) => ["owner", "admin"].includes(String(m.role)))
      .map((m) => m.organizationId as string),
  };
}
const many = async (
  a: any,
  model: string,
  field: string,
  ids: string[],
): Promise<Row[]> =>
  ids.length ? a.findMany({ model, where: IN(field, ids) }) : [];

export async function GET() {
  const s = await session();
  if (!s) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { a, mine, admin, userId } = s;
  const payments = (await many(a, "nuvionPayment", "organizationId", admin))
    .map((p) => nums(p, ["chargedMinor", "baseMinor", "createdAt"]))
    .sort((x, y) => y.createdAt - x.createdAt);
  const legs = (
    await many(
      a,
      "nuvionLeg",
      "paymentId",
      payments.map((p) => p.id),
    )
  ).map((l) => nums(l, ["amountMinor", "attempt"]));
  const c = await loadCreds(userId);
  return Response.json({
    localSimulate: process.env.DEMO_SIMULATE === "1",
    connection: {
      connected: !!c || !!operatorKey(),
      operatorMode: !!operatorKey(),
      entityId: c?.creds.entityId ?? null,
      accountId: c?.creds.accountId ?? null,
      webhookSecretSet: !!c?.creds.webhookSecret,
    },
    orgs: (await many(a, "organization", "id", mine)).map((o) => ({
      id: o.id,
      name: o.name,
      parentOrganizationId: o.parentOrganizationId ?? null,
    })),
    bindings: await many(a, "nuvionBinding", "organizationId", mine),
    rules: (await many(a, "nuvionFeeRule", "organizationId", mine)).map((r) =>
      nums(r, ["flatMinor", "bps", "minMinor", "capMinor"]),
    ),
    destinations: (
      await many(a, "nuvionDestination", "fromOrganizationId", mine)
    ).map((d) => ({
      fromOrganizationId: d.fromOrganizationId,
      toOrganizationId: d.toOrganizationId,
    })),
    payments: payments.map((p) => ({
      ...p,
      legs: legs.filter((l) => l.paymentId === p.id),
    })),
  });
}

export async function POST(req: Request) {
  const s = await session();
  if (!s) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { a, admin, userId } = s;
  const { action, paymentId } = await req.json();

  if (action === "simulate-inflow" || action === "simulate-settle") {
    const p: Row | null = await a.findOne({
      model: "nuvionPayment",
      where: EQ("id", paymentId),
    });
    if (!p || !admin.includes(p.organizationId))
      return Response.json({ error: "not found" }, { status: 404 });
    // Delivered straight to the plugin's webhook handler, signed with the server's internal secret.
    const post = async (id: string, body: unknown) => {
      const raw = JSON.stringify(body),
        ts = new Date().toISOString();
      const sig = createHmac("sha256", pluginSecret())
        .update(`${ts}.${raw}`)
        .digest("hex");
      const r = await tenant.run({ userId }, () =>
        auth.handler(
          new Request(new URL("/api/auth/nuvion/webhook", req.url), {
            method: "POST",
            body: raw,
            headers: {
              "x-nuvion-event-id": id,
              "x-nuvion-event-timestamp": ts,
              "x-nuvion-event-signature": sig,
            },
          }),
        ),
      );
      return r.json();
    };
    if (process.env.DEMO_SIMULATE !== "1")
      return Response.json(
        {
          error:
            "Simulation is only available against the local mock (DEMO_SIMULATE=1). Pay the real checkout; Nuvion sends the real webhooks.",
        },
        { status: 403 },
      );
    if (action === "simulate-inflow") {
      return Response.json(
        await post("evt_in_" + randomUUID(), {
          event: "inflows.completed",
          data: {
            unique_reference: "x-" + p.reference,
            narration: p.reference,
            amount: Number(p.chargedMinor),
            currency: p.currency,
            entity_id: "",
          },
        }),
      );
    }
    const out = [];
    for (const l of (await a.findMany({
      model: "nuvionLeg",
      where: EQ("paymentId", paymentId),
    })) as Row[])
      if (l.state === "sent")
        out.push(
          await post("evt_out_" + randomUUID(), {
            event: "outflows.completed",
            data: { unique_reference: `${l.id}-a${Number(l.attempt)}` },
          }),
        );
    return Response.json({ completed: out.length });
  }

  return Response.json({ error: "unknown action" }, { status: 400 });
}
