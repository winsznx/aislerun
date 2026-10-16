import pg from "pg";

export type Db = pg.Pool;
export type Tx = pg.PoolClient;

export function createPool(connectionString: string): Db {
  const pool = new pg.Pool({ connectionString, max: 10 });
  pool.on("error", () => undefined);
  return pool;
}

export async function withTx<T>(db: Db, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function appendEvent(tx: Tx | Db, inspectionId: string, type: string, details: Record<string, unknown>): Promise<void> {
  await tx.query(
    `INSERT INTO events (inspection_id, monotonic_sequence, type, details_json)
     SELECT $1, COALESCE(MAX(monotonic_sequence), 0) + 1, $2, $3 FROM events WHERE inspection_id = $1`,
    [inspectionId, type, JSON.stringify(details)],
  );
}
