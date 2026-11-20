import { betterAuth } from "better-auth";
import { organization } from "better-auth/plugins";
import { apiKey } from "@better-auth/api-key";
import { nuvion } from "@umohpyro/better-auth-nuvion";
import { db } from "./db";
import { demoCredentials } from "./demo-plugin";
import { nuvionFetch } from "./nuvion-fetch";
import { BASE_URL, pluginSecret } from "./tenant";

export const auth = betterAuth({
  database: db,
  // Origins that may call this app, comma-separated in TRUSTED_ORIGINS. The default is the live demo's own two addresses; set yours.
  trustedOrigins: (
    process.env.TRUSTED_ORIGINS ??
    "https://better-auth-nuvion-example.vercel.app,https://better-auth-nuvion-example.umoh.name.ng"
  )
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
  emailAndPassword: { enabled: true },
  plugins: [
    organization(),
    apiKey(),
    demoCredentials,
    nuvion({
      apiKey: process.env.NUVION_API_KEY || "per-visitor", // placeholder: nuvionFetch sets each visitor's own key
      webhookSecret: pluginSecret(),
      webhookToleranceMs: 5 * 60_000,
      baseUrl: BASE_URL,
      fetch: nuvionFetch,
    }),
  ],
});
