import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL não está configurada. Execute primeiro o setup local.");
}

const migrationsDirectory = path.resolve("db", "migrations");
const migrationNames = (await readdir(migrationsDirectory))
  .filter((name) => /^\d{4}[-_][a-z0-9-]+\.sql$/i.test(name))
  .sort();
const sql = postgres(databaseUrl, { max: 1, connect_timeout: 10, onnotice: () => undefined });
const connection = await sql.reserve();

try {
  await connection`select pg_advisory_lock(hashtext('secc_schema_migrations'))`;
  await connection`
    create table if not exists schema_migrations (
      name text primary key,
      checksum_sha256 text not null,
      applied_at timestamptz not null default now()
    )
  `;

  for (const name of migrationNames) {
    const migrationSql = await readFile(path.join(migrationsDirectory, name), "utf8");
    const checksum = createHash("sha256").update(migrationSql.replace(/\r\n/g, "\n")).digest("hex");
    const platformChecksum = createHash("sha256").update(migrationSql).digest("hex");
    const [existing] = await connection`
      select checksum_sha256 from schema_migrations where name = ${name}
    `;

    if (existing) {
      if (![checksum, platformChecksum].includes(existing.checksum_sha256)) {
        throw new Error(`Migration já aplicada foi alterada: ${name}`);
      }
      console.log(`${name}: já aplicada`);
      continue;
    }

    await connection.unsafe("begin");
    try {
      await connection.unsafe(migrationSql);
      await connection`
        insert into schema_migrations (name, checksum_sha256)
        values (${name}, ${checksum})
      `;
      await connection.unsafe("commit");
    } catch (error) {
      await connection.unsafe("rollback");
      throw error;
    }
    console.log(`${name}: aplicada`);
  }
} finally {
  try {
    await connection`select pg_advisory_unlock(hashtext('secc_schema_migrations'))`;
  } finally {
    connection.release();
    await sql.end();
  }
}
