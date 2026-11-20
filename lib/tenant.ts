import { AsyncLocalStorage } from "node:async_hooks";
import { createHmac, randomBytes } from "node:crypto";
import { open, seal } from "./seal";

/** Whose Nuvion connection the plugin should use for the call in progress. Set by the route handlers. */
export const tenant = new AsyncLocalStorage<{ userId: string }>();

export type Creds = {
  apiKey: string;
  entityId: string;
  accountId: string;
  webhookSecret?: string;
  webhookId?: string;
  monitorId?: string;
};

export const BASE_URL = process.env.NUVION_BASE_URL ?? "https://api.nuvion.dev";
/** Operator mode (local dev with the mock, or one shared key): a key from the environment instead of per-visitor keys. */
export const operatorKey = () => process.env.NUVION_API_KEY || undefined;

function secret(): string {
  const s = process.env.BETTER_AUTH_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production")
    throw new Error("BETTER_AUTH_SECRET is not set");
  return "local-dev-only-secret";
}

/**
 * The secret the plugin itself verifies webhooks with. Visitors' real deliveries are verified against their own signing
 * secret by /api/nuvion/webhook/[token] first, then forwarded signed with this one; nobody outside the server knows it.
 */
export const pluginSecret = () =>
  process.env.NUVION_WEBHOOK_SECRET ||
  createHmac("sha256", secret())
    .update("nuvion-internal-webhook")
    .digest("hex");

const adapter = async () =>
  (await (await import("./auth")).auth.$context).adapter as any;

export async function loadCreds(
  userId: string,
): Promise<{ token: string; creds: Creds } | null> {
  const row = await (
    await adapter()
  ).findOne({
    model: "demoCredential",
    where: [{ field: "userId", value: userId }],
  });
  if (!row) return null;
  const creds = await open<Creds>(secret(), row.sealed);
  return creds ? { token: row.token, creds } : null;
}

export async function findByToken(
  token: string,
): Promise<{ userId: string; creds: Creds } | null> {
  const row = await (
    await adapter()
  ).findOne({
    model: "demoCredential",
    where: [{ field: "token", value: token }],
  });
  if (!row) return null;
  const creds = await open<Creds>(secret(), row.sealed);
  return creds ? { userId: row.userId, creds } : null;
}

export async function saveCreds(userId: string, creds: Creds) {
  const a = await adapter();
  const sealed = await seal(secret(), creds);
  const where = [{ field: "userId", value: userId }];
  if (await a.findOne({ model: "demoCredential", where }))
    await a.update({ model: "demoCredential", where, update: { sealed } });
  else
    await a.create({
      model: "demoCredential",
      data: { userId, token: randomBytes(18).toString("hex"), sealed },
    });
}

export async function deleteCreds(userId: string) {
  await (
    await adapter()
  ).delete({
    model: "demoCredential",
    where: [{ field: "userId", value: userId }],
  });
}
