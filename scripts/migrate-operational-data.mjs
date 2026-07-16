import postgres from "postgres";

const sourceUrl = process.env.SOURCE_DATABASE_URL;
const targetUrl = process.env.TARGET_DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

if (!sourceUrl || !targetUrl) {
  throw new Error("Defina SOURCE_DATABASE_URL e TARGET_DATABASE_URL (ou DATABASE_URL_UNPOOLED/DATABASE_URL).");
}
if (sourceUrl === targetUrl) throw new Error("Origem e destino não podem ser o mesmo banco.");

const source = postgres(sourceUrl, { max: 1, connect_timeout: 10, onnotice: () => undefined });
const target = postgres(targetUrl, { max: 1, connect_timeout: 15, onnotice: () => undefined });
const tableNames = ["companies", "company_coverage", "sources", "proposals", "review_decisions", "audit_events"];

async function counts(sql) {
  const result = {};
  for (const table of tableNames) {
    const [row] = await sql.unsafe(`select count(*)::int as count from ${table}`);
    result[table] = row.count;
  }
  return result;
}

try {
  const [companies, coverage, sources, proposals, decisions, audits] = await Promise.all([
    source`select * from companies order by id`,
    source`select * from company_coverage order by company_id`,
    source`select * from sources order by id`,
    source`select * from proposals order by id`,
    source`select * from review_decisions order by id`,
    source`select * from audit_events order by occurred_at, id`,
  ]);
  const sourceCounts = await counts(source);
  const before = await counts(target);
  const occupied = Object.entries(before).filter(([, count]) => count > 0);
  if (occupied.length > 0) {
    throw new Error(`Destino não está vazio: ${occupied.map(([table, count]) => `${table}=${count}`).join(", ")}.`);
  }

  await target.begin(async (transaction) => {
    if (companies.length) await transaction`insert into companies ${transaction(companies)}`;
    if (coverage.length) await transaction`insert into company_coverage ${transaction(coverage)}`;
    if (sources.length) await transaction`insert into sources ${transaction(sources)}`;
    if (proposals.length) await transaction`insert into proposals ${transaction(proposals)}`;
    for (const decision of decisions) {
      await transaction`
        insert into review_decisions (
          id, proposal_id, decision, justification, decided_by, decided_at,
          previous_version, resulting_version
        ) overriding system value values (
          ${decision.id}, ${decision.proposal_id}, ${decision.decision}, ${decision.justification},
          ${decision.decided_by}, ${decision.decided_at}, ${decision.previous_version},
          ${decision.resulting_version}
        )
      `;
    }
    if (decisions.length) {
      await transaction`
        select setval(
          pg_get_serial_sequence('review_decisions', 'id'),
          (select max(id) from review_decisions),
          true
        )
      `;
    }
    if (audits.length) await transaction`insert into audit_events ${transaction(audits)}`;
  });

  const targetCounts = await counts(target);
  for (const table of tableNames) {
    if (targetCounts[table] !== sourceCounts[table]) {
      throw new Error(`Reconciliação falhou em ${table}: origem=${sourceCounts[table]}, destino=${targetCounts[table]}.`);
    }
  }
  console.log(JSON.stringify({ migrated: true, source: sourceCounts, target: targetCounts }));
} finally {
  await Promise.allSettled([source.end(), target.end()]);
}
