// Creates the tables and loads pharmacies and the medication price list.
// Usage: DATABASE_URL=... npx tsx scripts/setup-db.ts
import { readFileSync } from "node:fs";
import { Pool } from "pg";

type Med = { name: string; cat: string; unit: string; offers: Record<string, number>; flags: string[]; note?: string; src?: string };

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const client = await pool.connect();
  try {
    await client.query(readFileSync("db/schema.sql", "utf8"));
    await client.query("begin");
    const pharmacies = JSON.parse(readFileSync("data/pharmacies.json", "utf8"));
    for (const p of pharmacies) {
      await client.query(
        `insert into pharmacies (id, name, location, price_list) values ($1,$2,$3,$4)
         on conflict (id) do update set name = excluded.name, location = excluded.location, price_list = excluded.price_list`,
        [p.id, p.name, p.location, p.price_list],
      );
    }
    const meds: Med[] = JSON.parse(readFileSync("data/medications.json", "utf8"));
    for (const m of meds) {
      const { rows } = await client.query(
        `insert into medications (name, category, unit, flags, note, source) values ($1,$2,$3,$4,$5,$6)
         on conflict (name, unit) do update set category = excluded.category, flags = excluded.flags, note = excluded.note, source = excluded.source, active = true
         returning id`,
        [m.name, m.cat, m.unit, m.flags, m.note || null, m.src || null],
      );
      const id = rows[0].id;
      await client.query("delete from medication_prices where medication_id = $1", [id]);
      for (const [pharmacy, price] of Object.entries(m.offers)) {
        await client.query("insert into medication_prices (medication_id, pharmacy_id, price) values ($1,$2,$3)", [id, pharmacy, price]);
      }
    }
    await client.query("commit");
    console.log(`Loaded ${pharmacies.length} pharmacies and ${meds.length} medications.`);
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
