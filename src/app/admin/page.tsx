import Link from "next/link";
import { requireRole } from "@/lib/auth/server";
import { PostgresOperationalRepository } from "@/lib/database/postgres-operational-repository";
import { WorkbookRefreshForm } from "@/features/diagnostics/workbook-refresh-form";
import type { CompanyDiagnostic } from "@/types/domain";

export const metadata = { title: "Diagnóstico da coleta" };
export const dynamic = "force-dynamic";

type Search = { q?: string; coverage?: string; tier?: string; cvm?: string };
type CoverageStatus = "complete" | "partial" | "empty" | "unmapped";

function coverageStatus(company: CompanyDiagnostic): CoverageStatus {
  const coverage = company.coverage;
  if (!coverage || coverage.financialExpected === 0) return "unmapped";
  if (coverage.financialFilled === 0) return "empty";
  if (coverage.financialFilled >= coverage.financialExpected) return "complete";
  return "partial";
}

function percent(company: CompanyDiagnostic): number {
  const coverage = company.coverage;
  if (!coverage || coverage.financialExpected === 0) return 0;
  return Math.min(100, Math.round(coverage.financialFilled / coverage.financialExpected * 100));
}

const labels: Record<CoverageStatus, string> = {
  complete: "Completa", partial: "Parcial", empty: "Sem dados", unmapped: "Sem janela",
};

export default async function AdminPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireRole("admin");
  const filters = await searchParams;
  let companies: CompanyDiagnostic[];
  let proposals;
  try {
    const repository = new PostgresOperationalRepository();
    [companies, proposals] = await Promise.all([repository.listCompanyDiagnostics(), repository.listProposals()]);
  } catch {
    return <><header className="admin-title"><p className="eyebrow">Diagnóstico operacional</p><h1>Banco local indisponível.</h1></header><p className="notice" role="alert">Inicie o Docker e execute as migrações antes de atualizar a planilha.</p></>;
  }

  const counts = companies.reduce((result, company) => {
    result[coverageStatus(company)] += 1;
    if ((company.coverage?.financialFilled ?? 0) > 0) result.withData += 1;
    else result.withoutData += 1;
    if (company.cvmCnpj) result.cvm += 1;
    return result;
  }, { complete: 0, partial: 0, empty: 0, unmapped: 0, withData: 0, withoutData: 0, cvm: 0 });
  const query = filters.q?.trim().toLocaleLowerCase("pt-BR") ?? "";
  const visible = companies.filter((company) => {
    if (query && !`${company.name} ${company.sector} ${company.referenceCode ?? ""}`.toLocaleLowerCase("pt-BR").includes(query)) return false;
    if (filters.coverage === "empty" && (company.coverage?.financialFilled ?? 0) > 0) return false;
    if (filters.coverage && !["all", "empty"].includes(filters.coverage) && coverageStatus(company) !== filters.coverage) return false;
    if (filters.tier && filters.tier !== "all" && company.tier !== filters.tier) return false;
    if (filters.cvm === "linked" && !company.cvmCnpj) return false;
    if (filters.cvm === "unlinked" && company.cvmCnpj) return false;
    return true;
  });
  const pending = proposals.filter((proposal) => ["submitted", "under_review", "conflicted"].includes(proposal.status)).length;
  const latest = companies.find((company) => company.coverageUpdatedAt)?.coverageUpdatedAt;

  return <>
    <header className="admin-title">
      <p className="eyebrow">Diagnóstico operacional · planilha mestre</p>
      <h1>Cobertura por empresa, pronta para ação.</h1>
      <p className="lede">A plataforma lê a planilha real, mede o preenchimento nas abas operacionais e identifica onde pesquisar na CVM. Nenhum valor é publicado ou aprovado automaticamente.</p>
      <WorkbookRefreshForm />
      {latest && <p className="muted">Último cálculo: {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(latest))}</p>}
    </header>

    <section className="grid three" aria-label="Resumo da cobertura">
      <article className="card"><p>Empresas na referência</p><div className="metric">{companies.length}</div></article>
      <article className="card"><p>Com algum dado financeiro</p><div className="metric">{counts.withData}</div></article>
      <article className="card"><p>Sem dado financeiro</p><div className="metric">{counts.withoutData}</div></article>
      <article className="card"><p>Sem janela definida</p><div className="metric">{counts.unmapped}</div></article>
      <article className="card"><p>Cobertura completa</p><div className="metric">{counts.complete}</div></article>
      <article className="card"><p>Vinculadas à CVM</p><div className="metric">{counts.cvm}</div><Link href="/admin/cvm">Pesquisar CVM →</Link></article>
      <article className="card"><p>Propostas em revisão</p><div className="metric">{pending}</div><Link href="/admin/revisoes">Abrir fila →</Link></article>
    </section>

    <section className="section">
      <div className="split"><div><p className="eyebrow">Carteira</p><h2>{visible.length} empresa(s) no filtro</h2></div><p className="muted">Cobertura = campos financeiros preenchidos ÷ campos esperados na janela.</p></div>
      <form className="filter-bar" method="get">
        <label>Buscar<input defaultValue={filters.q} name="q" placeholder="Empresa, setor ou ticker/CNPJ" /></label>
        <label>Cobertura<select defaultValue={filters.coverage ?? "all"} name="coverage"><option value="all">Todas</option><option value="empty">Sem dados</option><option value="partial">Parcial</option><option value="complete">Completa</option><option value="unmapped">Sem janela</option></select></label>
        <label>Tier<select defaultValue={filters.tier ?? "all"} name="tier"><option value="all">Todos</option><option value="tier_1">Tier 1</option><option value="tier_2">Tier 2</option><option value="unclassified">A buscar</option></select></label>
        <label>Vínculo CVM<select defaultValue={filters.cvm ?? "all"} name="cvm"><option value="all">Todos</option><option value="linked">Vinculadas</option><option value="unlinked">Não vinculadas</option></select></label>
        <button className="button" type="submit">Aplicar</button>
      </form>
      <div className="table-wrap">
        <table><thead><tr><th>Empresa</th><th>Tier / tipo</th><th>Janela</th><th>Financeiro</th><th>Anos com dados</th><th>CVM</th><th>Próxima ação</th></tr></thead>
        <tbody>{visible.map((company) => {
          const status = coverageStatus(company);
          const coverage = company.coverage;
          return <tr key={company.id}>
            <td><strong>{company.name}</strong><br/><span className="muted">{company.sector}</span></td>
            <td>{company.tier.replace("tier_", "T")}<br/><span className="muted">{company.companyType ?? "—"}</span></td>
            <td>{company.collectionStartYear && company.collectionEndYear ? `${company.collectionStartYear}–${company.collectionEndYear}` : "—"}</td>
            <td><span className={`status coverage-${status}`}>{labels[status]} · {percent(company)}%</span><div className="progress" aria-label={`${percent(company)}%`}><span style={{ width: `${percent(company)}%` }} /></div></td>
            <td>{coverage ? `${coverage.researchedYears}/${coverage.totalYears}` : "—"}{coverage?.lastDataYear && <><br/><span className="muted">até {coverage.lastDataYear}</span></>}</td>
            <td>{company.cvmCnpj ? <><span className="status available">Vinculada</span><br/><span className="mono">{company.cvmCode}</span></> : <span className="status not_researched">Pendente</span>}</td>
            <td><Link href={`/admin/cvm?companyId=${encodeURIComponent(company.id)}&q=${encodeURIComponent(company.name)}`}>{company.cvmCnpj ? "Coletar DFP" : "Pesquisar CVM"} →</Link></td>
          </tr>;
        })}</tbody></table>
      </div>
    </section>
  </>;
}
