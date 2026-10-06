// Creates (or resets the password of) an admin login.
// Usage: DATABASE_URL=... npx tsx scripts/create-admin.ts you@example.com "Your Name" "a-long-password"
import bcrypt from "bcryptjs";
import { Pool } from "pg";

async function main() {
  const [email, name, password] = process.argv.slice(2);
  if (!email || !name || !password || password.length < 12) {
    console.error('Usage: create-admin.ts <email> "<name>" "<password of 12+ characters>"');
    process.exit(1);
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const hash = await bcrypt.hash(password, 12);
  await pool.query(
    `insert into users (email, password_hash, name, role) values (lower($1), $2, $3, 'admin')
     on conflict (email) do update set password_hash = excluded.password_hash, name = excluded.name, role = 'admin'`,
    [email, hash, name],
  );
  console.log(`Admin ${email} is ready.`);
  await pool.end();
}

main();
