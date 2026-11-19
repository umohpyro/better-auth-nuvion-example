// Creates and updates the database tables the app needs (SQLite by default, Postgres with DATABASE_URL).
// Runs the better-auth the app itself uses. The @better-auth/cli bundles an older copy that cannot add an indexed
// column to an existing Postgres table (it emitted an invalid ALTER TABLE ... ADD INDEX), which broke the 0.2 upgrade.
// It builds the same plugin list as lib/auth.ts; only the schema matters here, so the Nuvion options are placeholders.
// Usage: npm run migrate           shows the plan and asks
//        npm run migrate -- --yes  applies without asking
import { createInterface } from "node:readline/promises";
import { DatabaseSync } from "node:sqlite";
import { apiKey } from "@better-auth/api-key";
import { nuvion } from "@umohpyro/better-auth-nuvion";
import { betterAuth } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { organization } from "better-auth/plugins";
import pg from "pg";
import { demoCredentials } from "../lib/demo-plugin";

const database = process.env.DATABASE_URL
  ? new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 })
  : new DatabaseSync(process.env.DB_PATH ?? "./dev.db");

const auth = betterAuth({
  database,
  baseURL: "http://localhost:3000",
  secret: "migration-only-secret-not-used-for-anything-0123456789",
  emailAndPassword: { enabled: true },
  plugins: [organization(), apiKey(), demoCredentials, nuvion({ apiKey: "migration-only", webhookSecret: "migration-only" })],
});

const { toBeCreated, toBeAdded, runMigrations } = await getMigrations(auth.options);

if (!toBeCreated.length && !toBeAdded.length) {
  console.log("Nothing to migrate: the database already matches the schema.");
  process.exit(0);
}
for (const t of toBeCreated) console.log(`create table ${t.table}: ${Object.keys(t.fields).join(", ")}`);
for (const t of toBeAdded) console.log(`add to ${t.table}: ${Object.keys(t.fields).join(", ")}`);

if (!process.argv.includes("--yes")) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question("Apply these changes? (y/N) ")).trim().toLowerCase();
  rl.close();
  if (answer !== "y" && answer !== "yes") {
    console.log("Cancelled, nothing changed.");
    process.exit(1);
  }
}
await runMigrations();
console.log("Migration complete.");
process.exit(0);
