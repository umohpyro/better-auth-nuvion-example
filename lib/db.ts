import { Pool } from "pg";

// Postgres when DATABASE_URL is set (hosted), otherwise a local SQLite file via node:sqlite (local dev).
export const db = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, max: 3 })
  : new (await import("node:sqlite")).DatabaseSync(process.env.DB_PATH ?? "./dev.db");
