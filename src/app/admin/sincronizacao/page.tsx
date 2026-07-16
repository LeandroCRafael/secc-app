import Link from "next/link";
import { WorkbookSyncForm } from "@/features/sync/workbook-sync-form";
import { requireRole } from "@/lib/auth/server";
import { PostgresOperationalRepository } from "@/lib/database/postgres-operational-repository";

export const dynamic = "force-dynamic";

export default async function SyncPage() {
  await requireRole("admin");
  let approvedCount = 0;
  try {
    const proposals = await new PostgresOperationalRepository().listProposals();
    approvedCount = proposals.filter((proposal) => proposal.status === "approved").length;
  } catch {
    return <><header className="admin-title"><p className="eyebrow">Excel · intercâmbio local</p><h1>Banco operacional indisponível.</h1></header><p className="notice" role="alert">Inicie o PostgreSQL local para consultar propostas aprovadas.</p></>;
  }

  return <>
    <header className="admin-title">
      <p className="eyebrow">Excel · ferramenta operacional</p>
      <h1>Gere uma versão atualizada, sem sobrescrever a origem.</h1>
      <p className="lede">O fluxo agora lê um XLSX real, cria backup, evita duplicidade por proposta e devolve uma nova versão para conferência.</p>
    </header>
    <section className="grid three">
      <article className="card"><p>Propostas aprovadas</p><div className="metric">{approvedCount}</div><Link href="/admin/revisoes">Abrir revisões →</Link></article>
      <article className="card"><p>Destino controlado</p><h3>SECC_App_Staging</h3><p>Uma aba tabular, rastreável e pronta para de-para com a planilha oficial.</p></article>
      <article className="card"><p>Proteção aplicada</p><h3>Backup + cópia</h3><p>O arquivo enviado não é alterado nem substituído automaticamente.</p></article>
    </section>
    <section className="section">
      <WorkbookSyncForm approvedCount={approvedCount} />
      <p className="notice">Limite atual: XLSX sem macros, até 25 MB. A geração preserva células, fórmulas e estilos suportados pelo ExcelJS; gráficos, vínculos externos e recursos avançados ainda exigem validação na planilha oficial.</p>
    </section>
  </>;
}
