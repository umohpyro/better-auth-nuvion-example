import { auth } from "./auth";

/**
 * Deletes everything this demo holds about a visitor: the organizations they own with their payments, legs, fee rules,
 * bindings and saved counterparties; their memberships; their sealed Nuvion connection; their API keys, sessions,
 * sign-in account and the user row. Payments they made as a customer of someone else's organization stay, without their id.
 * Event ids (no personal data) are shared across users and stay.
 */
export async function deleteAccount(userId: string, email: string) {
  const db = (await auth.$context).adapter as any;
  const where = (field: string, value: unknown) => [{ field, value }];
  const del = (model: string, field: string, value: unknown) =>
    db.deleteMany({ model, where: where(field, value) });

  const memberships: { organizationId: string; role: string }[] =
    await db.findMany({ model: "member", where: where("userId", userId) });
  const owned = memberships
    .filter((m) => m.role.split(",").includes("owner"))
    .map((m) => m.organizationId);

  for (const orgId of owned) {
    const payments: { id: string }[] = await db.findMany({
      model: "nuvionPayment",
      where: where("organizationId", orgId),
    });
    for (const p of payments) await del("nuvionLeg", "paymentId", p.id);
    await del("nuvionPayment", "organizationId", orgId);
    await del("nuvionFeeRule", "organizationId", orgId);
    await del("nuvionBinding", "organizationId", orgId);
    await del("nuvionDestination", "fromOrganizationId", orgId);
    await del("nuvionDestination", "toOrganizationId", orgId);
    await del("invitation", "organizationId", orgId);
    await del("member", "organizationId", orgId);
    await del("organization", "id", orgId);
  }
  await db.updateMany({
    model: "nuvionPayment",
    where: where("userId", userId),
    update: { userId: null },
  }); // customer payments elsewhere keep no id
  await del("member", "userId", userId);
  await del("demoCredential", "userId", userId);
  await del("apikey", "referenceId", userId).catch(() =>
    del("apikey", "userId", userId),
  );
  await del("session", "userId", userId);
  await del("account", "userId", userId);
  await del("verification", "identifier", email);
  await del("user", "id", userId);
}
