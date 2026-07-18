import Link from "next/link";
import { requireRole } from "@/lib/auth/server";
import { PostgresWorkbookSyncRepository } from "@/lib/database/postgres-workbook-sync-repository";

export const metadata = { title: "Conflitos" };
export const dynamic = "force-dynamic";

export default async function ConflictsPage() {
  await requireRole("admin");
  let batches;
  try {
    batches = (await new PostgresWorkbookSyncRepository().listRecentBatches(30))
      .filter((batch) => batch.conflictCount > 0 || batch.unmappedCount > 0 || batch.status === "blocked");
  } catch {
    return <><header className="admin-title"><p className="eyebrow">Controle de concorrência</p><h1>Banco operacional indisponível.</h1></header><p className="notice" role="alert">Não foi possível consultar os conflitos de sincronização.</p></>;
  }

  const open = batches.filter((batch) => batch.status !== "applied");
  return <>
    <header className="admin-title"><p className="eyebrow">Excel · controle de concorrência</p><h1>Divergências nunca são sobrescritas silenciosamente.</h1><p className="lede">Conflitos exigem escolha entre o valor aprovado no app e o conteúdo recebido no Excel. Itens sem de-para bloqueiam o lote inteiro.</p></header>
    <section className="workspace-summary">
      <article><span>Lotes abertos</span><strong>{open.length}</strong><small>Com decisão ou correção pendente</small></article>
      <article><span>Conflitos de valor</span><strong>{open.reduce((sum, batch) => sum + batch.conflictCount, 0)}</strong><small>Exigem escolha explícita</small></article>
      <article><span>Sem de-para</span><strong>{open.reduce((sum, batch) => sum + batch.unmappedCount, 0)}</strong><small>Bloqueiam a aplicação</small></article>
      <article><span>Histórico</span><strong>{batches.length}</strong><small>Lotes recentes com divergência</small></article>
    </section>
    <section className="section">
      <div className="panel-heading"><div><p className="eyebrow">Ocorrências reais</p><h2>Lotes com divergência</h2></div><Link className="button" href="/admin/sincronizacao">Preparar nova sincronização</Link></div>
      {batches.length === 0 ? <p className="notice">Nenhum conflito real foi registrado. A primeira prévia da planilha estabelecerá a linha de base.</p> : <div className="table-wrap"><table><thead><tr><th>Data</th><th>Versões</th><th>Conflitos</th><th>Sem de-para</th><th>Status</th><th>Motivo</th></tr></thead><tbody>{batches.map((batch) => <tr key={batch.id}><td>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(batch.requestedAt))}</td><td>{batch.sourceWorkbookVersion} → {batch.resultWorkbookVersion}<br/><small className="mono">{batch.id.slice(0, 12)}…</small></td><td>{batch.conflictCount}</td><td>{batch.unmappedCount}</td><td><span className={`status ${batch.status === "applied" ? "approved" : "conflicted"}`}>{batch.status === "applied" ? "Resolvido" : "Pendente"}</span></td><td>{batch.failureReason ?? "Decisão por item na prévia."}</td></tr>)}</tbody></table></div>}
    </section>
  </>;
}
