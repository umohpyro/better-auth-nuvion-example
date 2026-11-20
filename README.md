# better-auth-nuvion example

A Next.js app that shows the `better-auth-nuvion` plugin: **one payment, a share for every parent**. A customer pays a merchant through Nuvion hosted checkout, and the plugin moves each parent's share with book transfers, keeps a ledger, and can retry or refund.

The plugin (`@umohpyro/better-auth-nuvion`, one package) is installed from npm like any other dependency. No symlinks, workspaces or `transpilePackages`.

**Live demo:** https://better-auth-nuvion-example.umoh.name.ng (runs against Nuvion's test environment, no real money; see the [privacy notice](https://better-auth-nuvion-example.umoh.name.ng/privacy) and [terms](https://better-auth-nuvion-example.umoh.name.ng/terms), and delete your data any time from Settings). **Plugin docs:** https://docs.better-auth-nuvion.umoh.name.ng. Security reports: see [SECURITY.md](SECURITY.md).

## Try it (about 5 minutes)

You need a Nuvion account in the **test environment** with an approved entity and one account. Everything runs in your own tenant with your own key.

1. **Sign up** on the app.
2. **Settings, step 1: connect your sandbox.** Create a sandbox secret API key in the [Nuvion sandbox dashboard](https://app.nuvion.dev/dashboard/settings) (use the **Owner** role: it can list entities, create webhooks and move funds). Paste it, press *Look up*, pick your entity and the account that receives payments, then *Save*.
3. **Settings, step 2: create your webhook.** Press *Create my webhook*. The app registers a webhook in your sandbox that points at your personal URL (`/api/nuvion/webhook/<token>`) and stores its signing secret on the server. Without a webhook, payments stay `pending`. Nuvion only delivers to **https** URLs, so use the hosted app (or a tunnel) rather than plain `localhost`.
4. **Settings, step 3 (optional): watch deliveries in Hookbox.** Open [Hookbox](https://hook.umoh.name.ng), create an inbox, paste its capture URL into the app, and every event Nuvion sends is also shown there with headers, body, timing and a signature check.
5. **Organizations.** Create one to three organizations (a lone Merchant, Platform and Merchant, or Platform, Reseller and Merchant), set the parents if you have more than one (for example Merchant under Reseller under Platform; depth is capped at 3 and cycles are rejected), and press *Give each organization its own account*. That creates one dedicated GBP account per organization in your sandbox (named `better-auth-nuvion: <name>`, reused if it already exists) and binds it. Each organization needs a **different** account, because a book transfer needs another account to land in. Then set a **fee rule** on the reseller and the merchant (what its parent takes from its payments: basis points, flat, min, cap, and who pays it). *Prepare transfers* is optional: the plugin creates the Nuvion counterparties it needs itself the first time a transfer needs one.
6. **Payments.** Create a checkout for the Merchant, open it, and pay with the sandbox bank (any bank works). Nuvion sends `inflows.completed` to your webhook, the plugin moves each share with a **real sandbox book transfer** from the Merchant's account to its parents' accounts, and Nuvion confirms each with `outflows.completed`. The shares appear under *Your payments*, refreshing by itself. Use *Retry failed legs* and *Refund* to try recovery.

## What is real

Everything is real activity in your own Nuvion test tenant: the funding session and checkout, the signed webhooks, the counterparties and payment details the plugin creates, and the book transfers between your accounts (sandbox money, nothing real). Refunds reverse the shares back to the merchant's account; they do not pay the customer back (Nuvion documents no refund API for funding-session inflows). Nuvion does not charge for book transfers, so each leg costs exactly its amount.

## Your key and your webhooks

- The key is **encrypted (AES-256-GCM) on the server** before it is stored and is never sent back to the browser. It is used only for your requests and your webhook events, only against the Nuvion sandbox host.
- It is stored server-side, not in a cookie, because splits and retries are triggered by Nuvion's webhooks when no browser is open.
- *Disconnect* deletes the key and the webhooks the app created for you.
- How a delivery flows: Nuvion → `/api/nuvion/webhook/<token>` (verifies your webhook secret, HMAC-SHA256 over `{timestamp}.{raw body}`) → the plugin's own webhook handler, re-signed with an internal secret.

## Run it yourself

```bash
npm install
cp .env.example .env.local     # set BETTER_AUTH_SECRET at least
npm run migrate -- --yes   # creates ./dev.db (SQLite), or uses DATABASE_URL for Postgres
npm run build && npm start     # app on :3000
```

Using pnpm, yarn or bun? Swap `npm install` for `pnpm install`, `yarn` or `bun install`, and `npm run <script>` for `pnpm <script>`, `yarn <script>` or `bun run <script>`.

| Variable | Purpose |
|---|---|
| `BETTER_AUTH_SECRET` | Required in production. Signs sessions and encrypts stored keys. |
| `BETTER_AUTH_URL` | The public URL of the app. |
| `DATABASE_URL` | Postgres connection string. If unset, a local SQLite file (`dev.db`) is used. |
| `NUVION_BASE_URL` | Defaults to `https://api.nuvion.dev`. |
| `TRUSTED_ORIGINS` | Comma-separated origins allowed to call the app. Defaults to the live demo's two addresses, so set your own. |
| `NUVION_API_KEY`, `NUVION_WEBHOOK_SECRET` | **Operator mode** (local development and scripts): one shared key and webhook secret from the environment. Per-visitor keys still take priority. Leave unset on a public deployment. |
| `DEMO_SIMULATE=1` | Local mock only: adds "Simulate inflow" and "Simulate transfers completed" buttons. Never set it on a public deployment. |

### Local development against the mock

`npm run mock` starts a tiny fake Nuvion on :4010 (funding sessions, transfers, accounts, counterparties and payment details). With `NUVION_BASE_URL=http://localhost:4010`, `NUVION_API_KEY` and `NUVION_WEBHOOK_SECRET` set, the scripts work without a Nuvion account:

- `node scripts/e2e.mjs`: signup, organizations, rejected cycles, fee rules, a payment, a bad-signature 401, a signed `inflows.completed`, the counterparties the plugin creates, the resulting transfers, `outflows.completed` for each leg and the payment settling (`FAIL=422` or `FAIL=500` makes transfers fail, then retries).
- `node scripts/settle.mjs`: `outflows.completed` events plus a replay (deduplicated).

## Deploying (what the live demo uses)

```bash
vercel link --project better-auth-nuvion-example
vercel integration add neon --name better-auth-nuvion-example-db      # sets DATABASE_URL
npm run migrate -- --yes   # with DATABASE_URL exported (without --yes it shows the plan and asks)
# set BETTER_AUTH_SECRET (sensitive), BETTER_AUTH_URL, NUVION_BASE_URL on Vercel; no Nuvion key
vercel deploy --prod
```

## Layout

| Path | What |
|---|---|
| `lib/auth.ts` | `betterAuth` with `organization()`, `apiKey()`, the plugin, and a tiny credentials table plugin |
| `lib/nuvion-fetch.ts` | The `fetch` handed to the plugin: per-visitor key and host pin |
| `app/api/nuvion/webhook/[token]` | Per-visitor webhook receiver and verifier |
| `app/api/settings` | Connect, create webhook, Hookbox monitor, disconnect |
| `app/api/demo` | Demo-only helpers (read the visitor's data; local-mock webhook simulation) |

Never commit keys: `.env*` is git-ignored (except `.env.example`).
