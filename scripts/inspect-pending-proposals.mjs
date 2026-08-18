#!/usr/bin/env node
/** Inspeção read-only da fila de revisão: perfil das propostas pendentes por status,
 *  data e origem, para isolar o lote do sync antes de qualquer aprovação em massa. */
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, { max: 1, connect_timeout: 10 });
try {
  const porStatus = await sql`select status, count(*)::int as n from proposals group by status order by n desc`;
  console.log("por status:", JSON.stringify(porStatus));
  const pendentes = await sql`
    select date(created_at) as dia, status, count(*)::int as n,
           min(created_at) as primeiro, max(created_at) as ultimo
    from proposals where status in ('submitted', 'under_review', 'conflicted')
    group by 1, 2 order by 1 desc`;
  console.log("pendentes por dia:", JSON.stringify(pendentes, null, 1));
  const amostra = await sql`
    select id, company_id, variable, year, value, unit, status, version, notes, created_at
    from proposals where status in ('submitted', 'under_review')
    order by created_at desc limit 3`;
  console.log("amostra:", JSON.stringify(amostra, null, 1));
  const fontes = await sql`
    select s.title, count(*)::int as n
    from proposals p join sources s on s.id = p.source_id
    where p.status in ('submitted', 'under_review')
    group by 1 order by n desc limit 5`;
  console.log("fontes:", JSON.stringify(fontes));
} finally {
  await sql.end();
}
