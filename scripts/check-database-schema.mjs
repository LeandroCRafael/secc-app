import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL não está configurada. Execute primeiro o setup local.");
}

const expectedTables = ["audit_events", "companies", "company_coverage", "proposals", "review_decisions", "sources"];
const sql = postgres(databaseUrl, { max: 1, connect_timeout: 10 });

try {
  const tables = await sql`
    select table_name
    from information_schema.tables
    where table_schema = 'public' and table_name = any(${expectedTables})
    order by table_name
  `;
  const found = tables.map(({ table_name: tableName }) => tableName);
  const missing = expectedTables.filter((tableName) => !found.includes(tableName));

  if (missing.length > 0) {
    throw new Error(`Schema incompleto. Tabelas ausentes: ${missing.join(", ")}`);
  }

  const [auditTrigger] = await sql`
    select trigger_name
    from information_schema.triggers
    where event_object_schema = 'public'
      and event_object_table = 'audit_events'
      and trigger_name = 'audit_events_append_only'
    limit 1
  `;

  if (!auditTrigger) {
    throw new Error("Controle append-only da auditoria não foi encontrado.");
  }

  const [migration] = await sql`
    select name, checksum_sha256 from schema_migrations order by applied_at desc limit 1
  `;

  console.log(
    JSON.stringify({
      valid: true,
      tables: found.length,
      auditAppendOnly: true,
      latestMigration: migration.name,
    }),
  );
} finally {
  await sql.end();
}
