import "server-only";
import postgres, { type Sql } from "postgres";

let databaseClient: Sql | undefined;

export interface DatabaseHealth {
  database: string;
  user: string;
  version: string;
}

export function getDatabase(): Sql {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL não está configurada para o ambiente local.");
  }

  databaseClient ??= postgres(databaseUrl, {
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
    onnotice: () => undefined,
  });

  return databaseClient;
}

export async function checkDatabaseHealth(): Promise<DatabaseHealth> {
  const sql = getDatabase();
  const rows = await sql<
    { database: string; user_name: string; version: string }[]
  >`
    select
      current_database() as database,
      current_user as user_name,
      current_setting('server_version') as version
  `;
  const row = rows[0];

  if (!row) {
    throw new Error("O PostgreSQL não retornou o diagnóstico esperado.");
  }

  return { database: row.database, user: row.user_name, version: row.version };
}
