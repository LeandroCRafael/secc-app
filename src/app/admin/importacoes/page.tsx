import Link from "next/link";
import { requireRole } from "@/lib/auth/server";
import { PostgresImportRepository } from "@/lib/database/postgres-import-repository";
import { PostgresOperationalRepository } from "@/lib/database/postgres-operational-repository";
import { companyWorkspacePath } from "@/lib/navigation/admin-return";
import { uploadPolicy } from "@/lib/parsers/upload-policy";
import { confirmStructuredImportAction, previewStructuredImportAction } from "./actions";

export const metadata = { title: "Importações" };
export const dynamic = "force-dynamic";

type Search = { companyId?: string; batchId?: string; message?: string };

function bytes(value: number): string {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value / 1024) + " KB";
}

function valueLabel(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  return typeof value === "number" ? new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(value) : String(value);
}

export default async function ImportsPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireRole("admin");
  const search = await searchParams;
  const operational = new PostgresOperationalRepository();
  const imports = new PostgresImportRepository();
  let companies;
  let recent;
  let selected = null;
  try {
    [companies, recent, selected] = await Promise.all([
      operational.listCompanies(), imports.listRecentBatches(),
      search.batchId ? imports.getBatch(search.batchId) : Promise.resolve(null),
    ]);
  } catch {
    return <><header className="admin-title"><p className="eyebrow">Importação estruturada</p><h1>Banco operacional indisponível.</h1></header><p className="notice" role="alert">Não foi possível carregar os lotes de importação.</p></>;
  }
  const selectedCompany = companies.find((company) => company.id === search.companyId);

  return <>
    {selectedCompany && <Link className="back-link" href={companyWorkspacePath(selectedCompany.id)}>← Voltar à estação da empresa</Link>}
    <header className="admin-title"><p className="eyebrow">Incremento 3 · ingestão estruturada</p><h1>Validar, conferir e só então enviar à revisão.</h1><p className="lede">CSV e XLSX são normalizados no servidor. O arquivo bruto não é publicado nem atualiza a planilha; somente linhas válidas e confirmadas criam propostas auditadas.</p></header>
    {search.message && <p className="notice" role="status">{search.message}</p>}

    <section className="workspace-grid import-layout">
      <article className="workspace-panel">
        <div className="panel-heading"><div><p className="eyebrow">1 · Arquivo</p><h2>Criar prévia</h2></div><Link className="button secondary" href="/admin/importacoes/modelo">Baixar modelo CSV</Link></div>
        <form className="form-grid" action={previewStructuredImportAction}>
          <label className="full">Empresa<select name="companyId" defaultValue={selectedCompany?.id ?? ""} required><option value="" disabled>Selecione a empresa</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label>
          <label className="full">Arquivo CSV ou XLSX<input type="file" name="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required /></label>
          <p className="notice full">Limite de {uploadPolicy.maxBytes / 1024 / 1024} MB e 1.000 linhas. A primeira linha deve conter o cabeçalho do modelo. Fórmulas XLSX precisam ter resultado calculado.</p>
          <div className="full"><button className="button" type="submit">Validar e gerar prévia</button></div>
        </form>
      </article>

      <article className="workspace-panel import-contract">
        <p className="eyebrow">Contrato mínimo</p><h2>Colunas aceitas</h2>
        <dl><div><dt>Obrigatórias</dt><dd>ano, variavel, valor, unidade, organizacao_fonte, titulo_fonte, url_fonte, data_referencia</dd></div><div><dt>Opcionais</dt><dd>disponibilidade, observacao</dd></div><div><dt>Unidades</dt><dd>BRL_millions, percent, count ou text</dd></div><div><dt>Ausências</dt><dd>available, unavailable, not_researched, not_applicable, future_period ou withheld</dd></div></dl>
      </article>
    </section>

    {selected && <section className="section import-preview">
      <div className="panel-heading"><div><p className="eyebrow">2 · Prévia do lote</p><h2>{selected.batch.originalName}</h2><p>{selected.batch.companyName} · {bytes(selected.batch.sizeBytes)} · SHA-256 {selected.batch.sha256.slice(0, 12)}…</p></div><span className={`status ${selected.batch.status === "imported" ? "approved" : "under_review"}`}>{selected.batch.status === "imported" ? "Confirmado" : "Aguardando confirmação"}</span></div>
      <div className="workspace-summary import-summary"><article><span>Linhas</span><strong>{selected.batch.rowCount}</strong></article><article><span>Válidas</span><strong>{selected.batch.validCount}</strong></article><article><span>Com erro</span><strong>{selected.batch.errorCount}</strong></article><article><span>Status</span><strong>{selected.batch.status === "imported" ? "Enviado" : "Prévia"}</strong></article></div>
      <div className="table-wrap"><table><thead><tr><th>Linha</th><th>Validação</th><th>Ano</th><th>Variável</th><th>Valor</th><th>Unidade</th><th>Fonte</th></tr></thead><tbody>{selected.rows.map((row) => <tr key={row.rowNumber}><td>{row.rowNumber}</td><td>{row.errors.length === 0 ? <span className="status available">Válida</span> : <span className="status rejected">{row.errors.join(" · ")}</span>}</td><td>{row.proposal?.year ?? valueLabel(row.raw.ano ?? row.raw.year)}</td><td>{row.proposal?.variable ?? valueLabel(row.raw.variavel ?? row.raw.variable)}</td><td>{row.proposal ? valueLabel(row.proposal.value) : valueLabel(row.raw.valor ?? row.raw.value)}</td><td>{row.proposal?.unit ?? valueLabel(row.raw.unidade ?? row.raw.unit)}</td><td>{row.proposal?.source.organization ?? valueLabel(row.raw.organizacao_fonte ?? row.raw.source_organization)}</td></tr>)}</tbody></table></div>
      {selected.batch.status === "previewed" && <form className="import-confirm" action={confirmStructuredImportAction}><input type="hidden" name="batchId" value={selected.batch.id}/><p>Somente as {selected.batch.validCount} linhas válidas serão enviadas à fila. As {selected.batch.errorCount} linhas com erro permanecerão no lote para correção e nova importação.</p><button className="button" type="submit" disabled={selected.batch.validCount === 0}>Confirmar e enviar à revisão</button></form>}
      {selected.batch.status === "imported" && <div className="actions"><Link className="button" href="/admin/revisoes">Abrir fila de revisão</Link><Link className="button secondary" href={companyWorkspacePath(selected.batch.companyId)}>Voltar à empresa</Link></div>}
    </section>}

    <section className="section"><div className="panel-heading"><div><p className="eyebrow">Rastreabilidade</p><h2>Lotes recentes</h2></div></div>{recent.length === 0 ? <p className="notice">Nenhum arquivo estruturado foi processado.</p> : <div className="table-wrap"><table><thead><tr><th>Data</th><th>Empresa</th><th>Arquivo</th><th>Qualidade</th><th>Status</th><th></th></tr></thead><tbody>{recent.map((batch) => <tr key={batch.id}><td>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(batch.createdAt))}</td><td>{batch.companyName}</td><td>{batch.originalName}<br/><small className="muted">{batch.sha256.slice(0, 10)}…</small></td><td>{batch.validCount} válidas · {batch.errorCount} erros</td><td><span className={`status ${batch.status === "imported" ? "approved" : "under_review"}`}>{batch.status === "imported" ? "Enviado" : "Prévia"}</span></td><td><Link href={`/admin/importacoes?companyId=${encodeURIComponent(batch.companyId)}&batchId=${encodeURIComponent(batch.id)}`}>Abrir →</Link></td></tr>)}</tbody></table></div>}</section>
  </>;
}
