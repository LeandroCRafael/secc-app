import Link from "next/link";
import { WorkbookSyncForm } from "@/features/sync/workbook-sync-form";
import { requireRole } from "@/lib/auth/server";
import { PostgresOperationalRepository } from "@/lib/database/postgres-operational-repository";
import { PostgresWorkbookSyncRepository } from "@/lib/database/postgres-workbook-sync-repository";

export const metadata = { title: "Sincronização Excel" };
export const dynamic = "force-dynamic";

const statusLabel = { prepared: "Prévia", blocked: "Bloqueado", applied: "Aplicado", failed: "Falhou" } as const;

export default async function SyncPage() {
  await requireRole("admin");
  let approvedCount = 0;
  let recent: Awaited<ReturnType<PostgresWorkbookSyncRepository["listRecentBatches"]>> = [];
  try {
    const [proposals, batches] = await Promise.all([
      new PostgresOperationalRepository().listProposals(),
      new PostgresWorkbookSyncRepository().listRecentBatches(8),
    ]);
    approvedCount = proposals.filter((proposal) => proposal.status === "approved").length;
    recent = batches;
  } catch {
    return <><header className="admin-title"><p className="eyebrow">Incremento 4 · Excel controlado</p><h1>Banco operacional indisponível.</h1></header><p className="notice" role="alert">Não foi possível carregar propostas e lotes de sincronização.</p></>;
  }

  const lastApplied = recent.find((batch) => batch.status === "applied");
  const pendingConflicts = recent.filter((batch) => batch.status === "prepared").reduce((sum, batch) => sum + batch.conflictCount, 0);

  return <>
    <header className="admin-title">
      <p className="eyebrow">Incremento 4 · sincronização bidirecional</p>
      <h1>Atualize a planilha mestre com controle de versão e conflito.</h1>
      <p className="lede">A aplicação compara o XLSX real com propostas aprovadas, mostra o diff por célula, exige backup e devolve uma nova versão completa. Mudanças feitas diretamente no Excel retornam ao fluxo de revisão.</p>
    </header>

    <section className="workspace-summary">
      <article><span>Prontas para o Excel</span><strong>{approvedCount}</strong><small>Propostas aprovadas e ainda não sincronizadas</small></article>
      <article><span>Conflitos pendentes</span><strong>{pendingConflicts}</strong><small>Nos lotes abertos</small></article>
      <article><span>Última versão</span><strong>{lastApplied?.resultWorkbookVersion ?? "—"}</strong><small>{lastApplied?.appliedAt ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(lastApplied.appliedAt)) : "Ainda não há lote aplicado"}</small></article>
      <article><span>Modo de operação</span><strong className="sync-mode">XLSX</strong><small>Intercâmbio de arquivo versionado</small></article>
    </section>

    <section className="section"><WorkbookSyncForm approvedCount={approvedCount} /></section>

    <section className="section">
      <div className="panel-heading"><div><p className="eyebrow">Rastreabilidade</p><h2>Lotes recentes</h2></div><Link href="/admin/auditoria">Abrir auditoria →</Link></div>
      {recent.length === 0 ? <p className="notice">Nenhuma sincronização foi preparada. O primeiro envio estabelecerá a linha de base controlada.</p> : <div className="table-wrap"><table><thead><tr><th>Data</th><th>Versão</th><th>Aprovadas</th><th>Conflitos</th><th>Excel → app</th><th>Status</th><th>Integridade</th></tr></thead><tbody>{recent.map((batch) => <tr key={batch.id}><td>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(batch.requestedAt))}</td><td><strong>{batch.sourceWorkbookVersion} → {batch.resultWorkbookVersion}</strong><br/><small className="mono">{batch.id.slice(0, 12)}…</small></td><td>{batch.approvedCount}<br/><small>{batch.readyCount} diretas · {batch.unchangedCount} conciliadas</small></td><td>{batch.conflictCount}{batch.unmappedCount > 0 && <><br/><small>{batch.unmappedCount} sem de-para</small></>}</td><td>{batch.excelChangeCount}</td><td><span className={`status ${batch.status === "applied" ? "approved" : batch.status === "blocked" || batch.status === "failed" ? "rejected" : "under_review"}`}>{statusLabel[batch.status]}</span></td><td><span className="mono">{(batch.resultSha256 ?? batch.sourceSha256).slice(0, 12)}…</span></td></tr>)}</tbody></table></div>}
    </section>

    <p className="notice">Escopo validado: abas financeiras, qualitativas e mercado da planilha mestre. Fórmulas, estilos e o dashboard permanecem no arquivo; qualquer fórmula encontrada em célula de entrada é protegida contra sobrescrita automática.</p>
  </>;
}
