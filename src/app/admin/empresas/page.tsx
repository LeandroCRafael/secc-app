import Link from "next/link";
import { requireRole } from "@/lib/auth/server";
import { loadDiagnosticData } from "@/lib/diagnostics/internal-snapshot";
import { DiagnosticTabs } from "@/features/diagnostics/diagnostic-tabs";
import { coverageRate, diagnosticPriority, financialBand, financialBandLabels, financialCoverageRate, financialExpectedCells, nextDiagnosticAction, priorityLabels } from "@/features/diagnostics/dashboard-model";
import type { CompanyDiagnostic } from "@/types/domain";

export const metadata = { title: "Visão mestre por empresa" };
export const dynamic = "force-dynamic";
type Search = { q?: string; tier?: string; coverage?: string; priority?: string };

function percent(filled = 0, expected = 0) { return Math.round(coverageRate(filled, expected) * 100); }
function matches(company: CompanyDiagnostic, filters: Search) {
  const query = filters.q?.trim().toLocaleLowerCase("pt-BR") ?? "";
  if (query && !`${company.name} ${company.sector} ${company.referenceCode ?? ""}`.toLocaleLowerCase("pt-BR").includes(query)) return false;
  if (filters.tier && filters.tier !== "all" && company.tier !== filters.tier) return false;
  if (filters.coverage && filters.coverage !== "all" && financialBand(company) !== filters.coverage) return false;
  if (filters.priority && filters.priority !== "all" && diagnosticPriority(company) !== filters.priority) return false;
  return true;
}

export default async function MasterCompaniesPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireRole("admin");
  const filters = await searchParams;
  let companies: CompanyDiagnostic[];
  try { companies = (await loadDiagnosticData()).companies; }
  catch { return <><header className="admin-title"><p className="eyebrow">Visão mestre</p><h1>Banco local indisponível.</h1></header><p className="notice" role="alert">Inicie o Docker para consultar o diagnóstico por empresa.</p></>; }
  const visible = companies.filter((company) => matches(company, filters));
  const critical = companies.filter((company) => diagnosticPriority(company) === "critical").length;

  return <>
    <DiagnosticTabs active="master" />
    <header className="admin-title"><p className="eyebrow">Espelho funcional da planilha</p><h1>Visão mestre por empresa.</h1><p className="lede">Cobertura, último período, prioridade e próxima ação seguem uma única regra, compartilhada com o dashboard.</p></header>
    <section className="master-summary" aria-label="Resumo da visão mestre"><div><span>Empresas no filtro</span><strong>{visible.length}</strong></div><div><span>Prioridade crítica na base</span><strong>{critical}</strong></div><div><span>Fonte</span><strong>Planilha mestre</strong></div></section>
    <section className="section master-section">
      <form className="filter-bar master-filters" method="get">
        <label>Buscar<input defaultValue={filters.q} name="q" placeholder="Empresa, setor ou ticker/CNPJ" /></label>
        <label>Tier<select defaultValue={filters.tier ?? "all"} name="tier"><option value="all">Todos</option><option value="tier_1">Tier 1</option><option value="tier_2">Tier 2</option><option value="unclassified">A buscar</option></select></label>
        <label>Cobertura<select defaultValue={filters.coverage ?? "all"} name="coverage"><option value="all">Todas</option>{Object.entries(financialBandLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Prioridade<select defaultValue={filters.priority ?? "all"} name="priority"><option value="all">Todas</option>{Object.entries(priorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <button className="button" type="submit">Aplicar</button><Link className="button secondary" href="/admin/empresas">Limpar</Link>
      </form>
      <div className="table-wrap master-table-wrap"><table className="master-table"><thead><tr><th>Empresa</th><th>Tier / tipo</th><th>Status Excel</th><th>Financeiro</th><th>Qualitativo</th><th>Mercado</th><th>Último ano</th><th>Prioridade</th><th>Próxima ação</th></tr></thead><tbody>{visible.map((company) => {
        const coverage = company.coverage; const band = financialBand(company); const priority = diagnosticPriority(company);
        const financialPercent = Math.round(financialCoverageRate(company) * 100); const financialExpected = financialExpectedCells(company); const qualitativePercent = percent(coverage?.qualitativeFilled, coverage?.qualitativeExpected); const marketPercent = percent(coverage?.marketFilled, coverage?.marketExpected);
        return <tr key={company.id}>
          <td><Link className="company-link" href={`/admin/empresas/${encodeURIComponent(company.id)}`}><strong>{company.name}</strong><span>Abrir estação →</span></Link><span className="muted">{company.sector} · {company.referenceCode ?? "sem código"}</span></td>
          <td>{company.tier === "tier_1" ? "T1" : company.tier === "tier_2" ? "T2" : "BUSCA"}<br/><span className="muted">{company.companyType ?? "—"}</span></td>
          <td><span className="workbook-status">{company.workbookStatus ?? "Não informado"}</span><br/><span className="muted">{company.collectionStartYear && company.collectionEndYear ? `${company.collectionStartYear}–${company.collectionEndYear}` : "sem janela"}</span></td>
          <td><span className={`status coverage-${band}`}>{financialBandLabels[band]} · {financialPercent}%</span><div className="progress"><span style={{ width: `${financialPercent}%` }} /></div><span className="muted">{coverage?.financialFilled ?? 0}/{financialExpected} células{(coverage?.financialExpected ?? 0) === 0 && financialExpected > 0 ? " · base nos anos pesquisados" : ""}</span></td>
          <td><strong>{qualitativePercent}%</strong><br/><span className="muted">{coverage?.qualitativeFilled ?? 0}/{coverage?.qualitativeExpected ?? 0} células</span></td>
          <td><strong>{marketPercent}%</strong><br/><span className="muted">{coverage?.marketFilled ?? 0}/{coverage?.marketExpected ?? 0} células</span></td>
          <td>{coverage?.lastDataYear ?? "—"}<br/><span className="muted">{coverage ? coverage.totalYears > 0 ? `${coverage.researchedYears}/${coverage.totalYears} anos` : coverage.researchedYears > 0 ? `${coverage.researchedYears} anos pesquisados · janela pendente` : "janela pendente" : "não calculado"}</span></td>
          <td><span className={`priority priority-${priority}`}>{priorityLabels[priority]}</span></td>
          <td><strong>{nextDiagnosticAction(company)}</strong><br/><Link href={`/admin/empresas/${encodeURIComponent(company.id)}`}>Pesquisar e incluir →</Link></td>
        </tr>;
      })}</tbody></table></div>
      {visible.length === 0 && <p className="notice">Nenhuma empresa corresponde aos filtros selecionados.</p>}
    </section>
  </>;
}
