#!/usr/bin/env node
/**
 * Aprovação em lote das propostas importadas por UM lote de sincronização Excel→app.
 * Espelha exatamente a transação de decideProposal do repositório operacional:
 * trava de versão (select ... for update), update com version+1, insert em
 * review_decisions e em audit_events — tudo numa única transação atômica.
 *
 * Uso:
 *   node --env-file=.env.local scripts/approve-sync-batch.mjs --created-at <ISO> --justificativa "..." [--commit]
 * Sem --commit roda em dry-run (só conta e mostra amostra).
 */
import { randomUUID } from "node:crypto";
import postgres from "postgres";

function arg(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const createdAt = arg("--created-at");
const justificativa = arg("--justificativa");
const commit = process.argv.includes("--commit");
if (!createdAt || !justificativa) {
  console.error("Informe --created-at <ISO do lote> e --justificativa \"...\".");
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, { max: 1, connect_timeout: 10 });
const ACTOR = "demo-admin"; // mesma identidade de sessão usada pelo app (adaptador local)

try {
  const alvo = await sql`
    select id, version, variable, year, company_id
    from proposals
    where status = 'under_review' and created_at = ${createdAt}
    order by id`;
  console.log(`Lote ${createdAt}: ${alvo.length} propostas under_review.`);
  if (alvo.length === 0) process.exit(0);
  console.log("amostra:", alvo.slice(0, 3).map((p) => `${p.variable} ${p.year}`).join(" | "));

  if (!commit) {
    console.log("(dry-run; rode com --commit para aprovar)");
    process.exit(0);
  }

  const agora = new Date().toISOString();
  await sql.begin(async (tx) => {
    for (const proposta of alvo) {
      const rows = await tx`select version from proposals where id = ${proposta.id} for update`;
      if (!rows[0] || rows[0].version !== proposta.version) {
        throw new Error(`Conflito de versão em ${proposta.id}; nada foi gravado.`);
      }
      const nova = proposta.version + 1;
      await tx`
        update proposals set status = 'approved', version = ${nova}, updated_at = ${agora}
        where id = ${proposta.id}`;
      await tx`
        insert into review_decisions (
          proposal_id, decision, justification, decided_by, decided_at,
          previous_version, resulting_version
        ) values (${proposta.id}, 'approved', ${justificativa}, ${ACTOR}, ${agora}, ${proposta.version}, ${nova})`;
      await tx`
        insert into audit_events (
          id, action, entity_id, actor_id, occurred_at, previous_version,
          resulting_version, reason, origin
        ) values (${randomUUID()}, 'proposal.approved', ${proposta.id}, ${ACTOR}, ${agora}, ${proposta.version}, ${nova}, ${justificativa}, 'manual')`;
    }
  });
  console.log(`Aprovadas ${alvo.length} propostas em transação única, com decisão e auditoria por item.`);
} finally {
  await sql.end();
}
