import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL não está configurada. Execute primeiro o setup local.");
}

const sql = postgres(databaseUrl, { max: 1, connect_timeout: 10 });

try {
  const [health] = await sql`
    select
      current_database() as database,
      current_user as user_name,
      current_setting('server_version') as version
  `;

  console.log(
    JSON.stringify({
      connected: true,
      database: health.database,
      user: health.user_name,
      version: health.version,
    }),
  );
} finally {
  await sql.end();
}
