import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { deleteAccount } from "@/lib/delete-account";
import { nuvionAs } from "@/lib/nuvion-api";
import { deleteCreds, loadCreds } from "@/lib/tenant";

/**
 * Delete my account and everything the demo holds about me. The body must be {"confirm":"DELETE"}.
 * The webhooks this app created in the visitor's own Nuvion test account are removed first, best effort.
 */
export async function DELETE(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session)
    return Response.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  if (body?.confirm !== "DELETE")
    return Response.json(
      { error: 'Send {"confirm":"DELETE"} to confirm.' },
      { status: 400 },
    );

  const userId = session.user.id;
  const c = await loadCreds(userId);
  if (c) {
    for (const id of [c.creds.webhookId, c.creds.monitorId]) {
      if (id)
        await nuvionAs(c.creds.apiKey, "DELETE", `/entity-webhooks/${id}`, {
          entity_id: c.creds.entityId,
        }).catch(() => {});
    }
    await deleteCreds(userId);
  }
  await deleteAccount(userId, session.user.email);
  return Response.json({ ok: true });
}
