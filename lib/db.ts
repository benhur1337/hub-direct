import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const shared = globalThis as typeof globalThis & { hubPool?: Pool };

export function database() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString)
    throw new Error("Set DATABASE_URL to the Neon connection string.");
  shared.hubPool ??= new Pool({ connectionString, allowExitOnIdle: true });
  return drizzle(shared.hubPool);
}
