import type { BetterAuthPlugin } from "better-auth";

/**
 * The example's own tiny Better Auth plugin: one table that holds each visitor's Nuvion connection, sealed (AES-GCM) so the
 * database never contains a plain API key. It exists because splits and retries run from Nuvion webhooks, when there is no
 * browser session to carry a key. `token` is the visitor's private webhook URL segment.
 */
export const demoCredentials = {
  id: "demo-credentials",
  schema: {
    demoCredential: {
      fields: {
        userId: { type: "string", required: true, unique: true },
        token: { type: "string", required: true, unique: true },
        sealed: { type: "string", required: true },
      },
    },
  },
} satisfies BetterAuthPlugin;
