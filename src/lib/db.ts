import { Pool, types, type QueryResultRow } from "pg";

// Keep DATE columns (dates of birth) as "YYYY-MM-DD" strings so time zones never shift them.
types.setTypeParser(1082, (v) => v);

const globalForPool = globalThis as unknown as { pgPool?: Pool };

export const pool =
  globalForPool.pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
  });
if (process.env.NODE_ENV !== "production") globalForPool.pgPool = pool;

export async function query<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []) {
  const { rows } = await pool.query<T>(text, params);
  return rows;
}

export async function one<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []) {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}
