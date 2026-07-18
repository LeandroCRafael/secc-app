import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL não está configurada.");

const sql = postgres(databaseUrl, { max: 1, connect_timeout: 10 });
try {
  const [proposalCounts, syncCounts, latest] = await Promise.all([
    sql`select status, count(*)::int as count from proposals group by status order by status`,
    sql`
      select
        count(*)::int as batches,
        count(*) filter (where status = 'prepared')::int as prepared,
        count(*) filter (where status = 'blocked')::int as blocked,
        count(*) filter (where status = 'applied')::int as applied,
        coalesce(sum(conflict_count) filter (where status <> 'applied'), 0)::int as open_conflicts
      from workbook_sync_batches
    `,
    sql`
      select id, status, source_workbook_version, result_workbook_version, requested_at, applied_at
      from workbook_sync_batches order by requested_at desc limit 1
    `,
  ]);
  console.log(JSON.stringify({
    valid: true,
    proposals: Object.fromEntries(proposalCounts.map((row) => [row.status, row.count])),
    synchronization: syncCounts[0],
    latestBatch: latest[0] ?? null,
  }));
} finally {
  await sql.end();
}
