import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const dir = join(dirname(fileURLToPath(import.meta.url)), "migrations");

export async function migrate(databaseUrl: string): Promise<string[]> {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query("SELECT pg_advisory_lock(4242)");
    const exists = await client.query("SELECT to_regclass('schema_migrations') AS t");
    const applied = new Set<string>(
      exists.rows[0].t ? (await client.query("SELECT name FROM schema_migrations")).rows.map((r) => r.name as string) : [],
    );
    const ran: string[] = [];
    for (const file of (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort()) {
      if (applied.has(file)) continue;
      await client.query("BEGIN");
      await client.query(await readFile(join(dir, file), "utf8"));
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
      await client.query("COMMIT");
      ran.push(file);
    }
    return ran;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    await client.query("SELECT pg_advisory_unlock(4242)").catch(() => undefined);
    await client.end();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  const ran = await migrate(url);
  console.log(ran.length ? `applied ${ran.join(", ")}` : "schema up to date");
}
