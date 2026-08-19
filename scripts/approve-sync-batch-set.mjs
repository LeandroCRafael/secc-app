#!/usr/bin/env node
/**
 * Versão SET-BASED da aprovação em lote (para lotes grandes de sincronização).
 * Mesma semântica de decideProposal — status→approved, version+1, uma linha em
 * review_decisions e uma em audit_events POR proposta — mas em três comandos de
 * conjunto dentro de UMA transação (FOR UPDATE trava as linhas; versões não mudam
 * dentro da própria transação). Segundos em vez de horas para 10k+ itens.
 *
 * Uso: node --env-file=.env.local scripts/approve-sync-batch-set.mjs --created-at <ISO> --justificativa "..." [--commit]
 */
import postgres from "postgres";

function arg(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const createdAt = arg("--created-at");
const justificativa = arg("--justificativa");
const commit = process.argv.includes("--commit");
if (!createdAt || !justificativa) {
  console.error("Informe --created-at <ISO> e --justificativa \"...\"."); process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, { max: 1, connect_timeout: 10 });
const ACTOR = "demo-admin";
const agora = new Date().toISOString();

try {
  if (!commit) {
    const alvo = await sql`select count(*)::int as n from proposals where status = 'under_review' and created_at = ${createdAt}`;
    console.log(`dry-run: ${alvo[0].n} propostas seriam aprovadas. (--commit para gravar)`);
    process.exit(0);
  }
  await sql.begin(async (tx) => {
    const alvo = await tx`
      select id, version from proposals
      where status = 'under_review' and created_at = ${createdAt}
      for update`;
    if (alvo.length === 0) throw new Error("nenhuma proposta no lote");
    const ids = alvo.map((p) => p.id);
    const versoes = alvo.map((p) => p.version);
    await tx`
      update proposals set status = 'approved', version = version + 1, updated_at = ${agora}
      where id = any(${ids})`;
    await tx`
      insert into review_decisions (proposal_id, decision, justification, decided_by, decided_at, previous_version, resulting_version)
      select u.id, 'approved', ${justificativa}, ${ACTOR}, ${agora}, u.v, u.v + 1
      from unnest(${ids}::text[], ${versoes}::int[]) as u(id, v)`;
    await tx`
      insert into audit_events (id, action, entity_id, actor_id, occurred_at, previous_version, resulting_version, reason, origin)
      select gen_random_uuid()::text, 'proposal.approved', u.id, ${ACTOR}, ${agora}, u.v, u.v + 1, ${justificativa}, 'manual'
      from unnest(${ids}::text[], ${versoes}::int[]) as u(id, v)`;
    console.log(`Aprovadas ${alvo.length} propostas (transação única, decisão + auditoria por item).`);
  });
} finally {
  await sql.end();
}
