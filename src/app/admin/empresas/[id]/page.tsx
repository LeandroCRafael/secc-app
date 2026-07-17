import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/server";
import { searchCvmCompanies, type CvmCompany } from "@/lib/cvm/client";
import { PostgresOperationalRepository } from "@/lib/database/postgres-operational-repository";
import { companyIdFromRoute, companyWorkspacePath } from "@/lib/navigation/admin-return";
import { collectCvmDfpAction } from "@/app/admin/cvm/actions";
import { ProposalForm } from "@/features/intake/proposal-form";
import { StatusBadge } from "@/components/ui/status-badge";
import { diagnosticPriority, financialBand, financialBandLabels, financialCoverageRate, nextDiagnosticAction, priorityLabels } from "@/features/diagnostics/dashboard-model";
import type { CompanyDiagnostic, Proposal } from "@/types/domain";

export const metadata = { title: "Estação de pesquisa" };
export const dynamic = "force-dynamic";

type Search = { cvmQ?: string; message?: string };

const unitLabels: Record<Proposal["unit"], string> = {
  BRL_millions: "R$ milhões", percent: "%", count: "contagem", text: "texto",
};

function percent(filled = 0, expected = 0): number {
  return expected > 0 ? Math.round((filled / expected) * 100) : 0;
}

function formatValue(proposal: Proposal): string {
  if (proposal.value === null) return proposal.availability;
  if (typeof proposal.value === "string") return proposal.value;
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(proposal.value);
}

function formatCnpj(cnpj?: string | null): string {
  if (!cnpj || cnpj.length !== 14) return "não vinculado";
  return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

function defaultDfpYear(company: CompanyDiagnostic): number {
  const lastClosedYear = new Date().getFullYear() - 1;
  return Math.max(2010, Math.min(lastClosedYear, company.collectionEndYear ?? company.eventYear ?? lastClosedYear));
}

export default async function CompanyResearchPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Search> }) {
  await requireRole("admin");
  const [{ id }, search] = await Promise.all([params, searchParams]);
  const companyId = companyIdFromRoute(id);
  const repository = new PostgresOperationalRepository();
  let company: CompanyDiagnostic | undefined;
  let proposals: Proposal[] = [];
  let audits = [] as Awaited<ReturnType<PostgresOperationalRepository["listAuditEvents"]>>;
  try {
    const [companies, allProposals, allAudits] = await Promise.all([
      repository.listCompanyDiagnostics(), repository.listProposals(), repository.listAuditEvents(),
    ]);
    company = companies.find((item) => item.id === companyId);
    proposals = allProposals.filter((item) => item.companyId === companyId);
    const proposalIds = new Set(proposals.map((item) => item.id));
    audits = allAudits.filter((event) => event.entityId === companyId || proposalIds.has(event.entityId));
  } catch {
    return <><header className="admin-title"><p className="eyebrow">Estação de pesquisa</p><h1>Banco operacional indisponível.</h1></header><p className="notice" role="alert">Não foi possível carregar o contexto da empresa.</p></>;
  }
  if (!company) notFound();

  let cvmResults: CvmCompany[] = [];
  let cvmError = "";
  if (search.cvmQ?.trim()) {
    try { cvmResults = await searchCvmCompanies(search.cvmQ); }
    catch (error) { cvmError = error instanceof Error ? error.message : "A CVM não respondeu."; }
  }

  const coverage = company.coverage;
  const priority = diagnosticPriority(company);
  const returnTo = companyWorkspacePath(company.id);
  const pending = proposals.filter((proposal) => ["submitted", "under_review", "conflicted"].includes(proposal.status)).length;

  return <>
    <Link className="back-link" href="/admin/empresas">← Voltar à visão mestre</Link>
    <header className="admin-title workspace-title">
      <div><p className="eyebrow">Estação de pesquisa · empresa</p><h1>{company.name}</h1><p className="lede">{company.sector} · {company.referenceCode ?? "sem código"} · {company.companyType ?? "tipo não informado"}</p></div>
      <div className="workspace-actions"><span className={`priority priority-${priority}`}>{priorityLabels[priority]}</span><strong>{nextDiagnosticAction(company)}</strong></div>
    </header>
    {search.message && <p className="notice" role="status">{search.message}</p>}

    <section className="workspace-summary" aria-label="Resumo operacional da empresa">
      <article><span>Cobertura financeira</span><strong>{Math.round(financialCoverageRate(company) * 100)}%</strong><small>{financialBandLabels[financialBand(company)]}</small></article>
      <article><span>Qualitativo</span><strong>{percent(coverage?.qualitativeFilled, coverage?.qualitativeExpected)}%</strong><small>{coverage?.qualitativeFilled ?? 0}/{coverage?.qualitativeExpected ?? 0} células</small></article>
      <article><span>Propostas</span><strong>{proposals.length}</strong><small>{pending} aguardando decisão</small></article>
      <article><span>Vínculo CVM</span><strong>{company.cvmCode ?? "—"}</strong><small>{formatCnpj(company.cvmCnpj)}</small></article>
    </section>

    <section className="workspace-grid">
      <article className="workspace-panel">
        <div className="panel-heading"><div><p className="eyebrow">Fonte oficial</p><h2>Pesquisar e coletar CVM</h2></div>{company.cvmCnpj && <span className="status available">Vinculada</span>}</div>
        <p>Pesquise a companhia, confirme a correspondência e colete um exercício da DFP. Cada métrica entra separadamente na revisão.</p>
        <form className="workspace-search" method="get"><label>Nome, CNPJ ou código CVM<input name="cvmQ" defaultValue={search.cvmQ ?? company.name} required /></label><button className="button" type="submit">Pesquisar CVM</button></form>
        {cvmError && <p className="error" role="alert">{cvmError}</p>}
        {search.cvmQ && cvmResults.length === 0 && !cvmError && <p className="notice">Nenhuma correspondência encontrada. Refine o nome ou informe o CNPJ.</p>}
        <div className="cvm-results">{cvmResults.map((result) => <div className="cvm-result" key={`${result.cnpj}-${result.cvmCode}`}><div><strong>{result.corporateName}</strong><small>{result.tradeName || "sem nome comercial"} · CVM {result.cvmCode} · {formatCnpj(result.cnpj)}</small><small>{result.sector || "setor não informado"} · {result.status}</small></div><form action={collectCvmDfpAction}><input name="companyId" type="hidden" value={company.id}/><input name="cnpj" type="hidden" value={result.cnpj}/><input name="cvmCode" type="hidden" value={result.cvmCode}/><input name="corporateName" type="hidden" value={result.corporateName}/><input name="returnTo" type="hidden" value={returnTo}/><label>Exercício<input name="year" type="number" min="2010" max={new Date().getFullYear()} defaultValue={defaultDfpYear(company)}/></label><button className="button" type="submit">Vincular e coletar</button></form></div>)}</div>
      </article>

      <article className="workspace-panel">
        <div className="panel-heading"><div><p className="eyebrow">Entrada controlada</p><h2>Registrar dado manual</h2></div><span className="status under_review">Vai para revisão</span></div>
        <ProposalForm companies={[company]} selectedCompanyId={company.id} defaultYear={defaultDfpYear(company)} returnTo={returnTo}/>
      </article>
    </section>

    <section className="section">
      <div className="panel-heading"><div><p className="eyebrow">Histórico</p><h2>Propostas da empresa</h2></div><div className="actions"><Link className="button secondary" href={`/admin/importacoes?companyId=${encodeURIComponent(company.id)}`}>Importar dados</Link><Link className="button secondary" href="/admin/revisoes">Abrir fila de revisão</Link></div></div>
      {proposals.length === 0 ? <p className="notice">Nenhuma proposta registrada. Use a CVM ou a entrada manual acima.</p> : <div className="table-wrap"><table><thead><tr><th>Criação</th><th>Exercício</th><th>Variável</th><th>Valor</th><th>Fonte</th><th>Status</th></tr></thead><tbody>{proposals.map((proposal) => <tr key={proposal.id}><td>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(proposal.createdAt))}</td><td>{proposal.year}</td><td><strong>{proposal.variable}</strong>{proposal.notes && <><br/><small className="muted">{proposal.notes}</small></>}</td><td>{formatValue(proposal)}<br/><small className="muted">{unitLabels[proposal.unit]}</small></td><td><a href={proposal.source.url} rel="noreferrer" target="_blank">{proposal.source.organization} ↗</a><br/><small className="muted">{proposal.source.referenceDate}</small></td><td><StatusBadge status={proposal.status}/></td></tr>)}</tbody></table></div>}
    </section>

    <section className="section workspace-audit"><div><p className="eyebrow">Rastreabilidade</p><h2>Eventos relacionados</h2></div>{audits.length === 0 ? <p className="muted">Nenhum evento específico registrado.</p> : <ol>{audits.slice(0, 8).map((event) => <li key={event.id}><span>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(event.occurredAt))}</span><strong>{event.action}</strong><p>{event.reason}</p></li>)}</ol>}</section>
  </>;
}
