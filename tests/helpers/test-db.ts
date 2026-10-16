import pg from "pg";
import { migrate } from "../../db/migrate.js";
import { seedFixtureTargets } from "../../apps/api/src/targets-seed.js";
import { createPool, type Db } from "../../packages/shared/src/db.js";

export const FIXTURE_ORIGIN = "https://aislerun-fixtures.vercel.app";
export const ADMIN_URL = process.env.TEST_ADMIN_DATABASE_URL ?? process.env.DATABASE_URL;

export interface TestDb {
  db: Db;
  url: string;
  drop: () => Promise<void>;
}

// Creates a throwaway database on the real local Postgres, migrated and seeded like production.
export async function createTestDb(prefix: string): Promise<TestDb> {
  if (!ADMIN_URL) throw new Error("DATABASE_URL or TEST_ADMIN_DATABASE_URL is required for integration tests");
  const name = `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${name}`);
  await admin.end();
  const url = new URL(ADMIN_URL);
  url.pathname = `/${name}`;
  await migrate(url.toString());
  const db = createPool(url.toString());
  await seedFixtureTargets(db, FIXTURE_ORIGIN);
  return {
    db,
    url: url.toString(),
    drop: async () => {
      await db.end();
      const c = new pg.Client({ connectionString: ADMIN_URL });
      await c.connect();
      await c.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
      await c.end();
    },
  };
}
