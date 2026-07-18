import Link from "next/link";
import { DiagnosticTabs } from "@/features/diagnostics/diagnostic-tabs";
import type { CompanyDiagnostic } from "@/types/domain";
import {
  comparisonMetrics,
  comparisonPeriods,
  formatComparisonValue,
  relativePeriodLabel,
  type ComparisonCompany,
  type ComparisonModel,
  type ComparisonReadiness,
} from "./comparison-model";

const readinessLabels: Record<ComparisonReadiness, string> = {
  controlled: "Comparável",
  partial: "Série parcial",
  baseline_pending: "Linha de base pendente",
  event_pending: "Evento pendente",
};

const indicatorRows = [
  { key: "ebitMargin", label: "Margem EBIT", unit: "percent" },
  { key: "netMargin", label: "Margem líquida", unit: "percent" },
  { key: "currentRatio", label: "Liquidez corrente", unit: "multiple" },
  { key: "grossDebt", label: "Dívida financeira", unit: "BRL_millions" },
  { key: "netDebt", label: "Dívida financeira líquida", unit: "BRL_millions" },
] as const;

function indicatorValue(company: ComparisonCompany, key: (typeof indicatorRows)[number]["key"]): string {
  const indicator = company.indicators[key];
  if (!indicator) return "—";
  if (indicator.unit === "multiple") return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(indicator.value)}x`;
  return formatComparisonValue(indicator.value, indicator.unit);
}

function tierLabel(tier: string): string {
  if (tier === "tier_1") return "T1";
  if (tier === "tier_2") return "T2";
  return "BUSCA";
}

export function ComparisonView({
  model,
  pilotCompanies,
  selectedIds,
}: {
  model: ComparisonModel;
  pilotCompanies: CompanyDiagnostic[];
  selectedIds: string[];
}) {
  return <>
    <DiagnosticTabs active="comparison" />
    <header className="admin-title dashboard-title comparator-title">
      <div>
        <p className="eyebrow">Incremento 6 · comparador executivo</p>
        <h1>Empresas lado a lado, sem esconder as ressalvas.</h1>
        <p className="lede">Compare cobertura, indicadores e trajetória em torno do evento. A ferramenta não produz ranking, score ou recomendação de crédito.</p>
      </div>
      <div className="dashboard-actions">
        <span className={`status ${model.baseline ? "available" : "under_review"}`}>{model.baseline ? model.baseline.workbookVersion : "Linha de base pendente"}</span>
        <p className="muted">Até quatro empresas por análise</p>
      </div>
    </header>

    <form className="comparator-selector" method="get">
      <div className="panel-heading"><div><p className="eyebrow">Recorte</p><h2>Selecione empresas e métrica</h2></div><button className="button" type="submit">Atualizar comparação</button></div>
      <fieldset className="comparator-company-options">
        <legend>Coorte piloto</legend>
        {pilotCompanies.map((company) => <label key={company.id} className={selectedIds.includes(company.id) ? "selected" : undefined}>
          <input defaultChecked={selectedIds.includes(company.id)} name="empresa" type="checkbox" value={company.id}/>
          <span><strong>{company.name}</strong><small>{company.sector} · {company.eventYear ?? "evento pendente"}</small></span>
        </label>)}
      </fieldset>
      <label className="comparator-metric">Métrica da trajetória<select defaultValue={model.metric.variable} name="metrica">{comparisonMetrics.map((metric) => <option key={metric.variable} value={metric.variable}>{metric.label}</option>)}</select></label>
      <p className="muted">Se mais de quatro empresas forem marcadas, o comparador preservará as quatro primeiras da coorte.</p>
    </form>

    <section className="comparator-summary" aria-label="Resumo da comparação">
      <article><span>Empresas selecionadas</span><strong>{model.companies.length}</strong><small>coorte piloto controlada</small></article>
      <article><span>Comparáveis na métrica</span><strong>{model.comparableCompanies}</strong><small>ao menos dois períodos válidos</small></article>
      <article><span>Séries controladas</span><strong>{model.controlledCompanies}</strong><small>três ou mais períodos</small></article>
      <article><span>Mudanças pendentes</span><strong>{model.pendingChanges}</strong><small>não entram nos cálculos</small></article>
    </section>

    {model.limitations.length > 0 && <section className="comparator-limitations" aria-labelledby="comparison-limitations"><div><p className="eyebrow">Leitura responsável</p><h2 id="comparison-limitations">Limitações ativas</h2></div><ul>{model.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul></section>}

    <section className="section comparator-section">
      <div className="panel-heading"><div><p className="eyebrow">Prontidão</p><h2>Cobertura e qualidade por empresa</h2></div><span className="muted">Antes de comparar valores</span></div>
      <div className="table-wrap"><table className="comparator-quality-table"><thead><tr><th>Empresa</th><th>Evento</th><th>Financeiro</th><th>Qualitativo</th><th>Mercado</th><th>Períodos válidos</th><th>Situação</th></tr></thead><tbody>{model.companies.map((company) => <tr key={company.id}>
        <td><Link className="company-link" href={`/admin/empresas/${encodeURIComponent(company.id)}`}><strong>{company.name}</strong><span>Abrir Empresa 360 →</span></Link><small>{tierLabel(company.tier)} · {company.referenceCode ?? company.companyType ?? "sem referência"}</small></td>
        <td><strong>{company.eventYear ?? "—"}</strong><br/><small>{company.sector}</small></td>
        <td><CoverageBar value={company.financialCoverage}/></td><td><CoverageBar value={company.qualitativeCoverage}/></td><td><CoverageBar value={company.marketCoverage}/></td>
        <td><strong>{company.comparablePeriods}/5</strong><br/><small>{model.metric.label}</small></td>
        <td><span className={`status comparator-${company.readiness}`}>{readinessLabels[company.readiness]}</span>{company.suspiciousPendingCount > 0 && <><br/><small className="error">{company.suspiciousPendingCount} escala(s) a validar</small></>}</td>
      </tr>)}</tbody></table></div>
    </section>

    <section className="section comparator-section">
      <div className="panel-heading"><div><p className="eyebrow">Trajetória relativa</p><h2>{model.metric.label}: t-2 a t+2</h2></div><span className="muted">{model.metric.unit === "BRL_millions" ? "R$ milhões" : model.metric.unit}</span></div>
      <div className="table-wrap"><table className="comparator-trajectory"><thead><tr><th>Empresa</th>{comparisonPeriods.map((period) => <th key={period}>{relativePeriodLabel(period)}</th>)}</tr></thead><tbody>{model.companies.map((company) => <tr key={company.id}><th><strong>{company.name}</strong><small>{model.metric.indexable ? "valor · índice t-1=100" : "valor controlado"}</small></th>{company.cells.map((cell) => <td key={cell.relativePeriod}><ComparisonCellView cell={cell} unit={model.metric.unit} indexable={model.metric.indexable}/></td>)}</tr>)}</tbody></table></div>
      {model.comparableCompanies === 0 && <p className="notice comparator-empty">A matriz está pronta, mas será preenchida somente após a primeira sincronização controlada da planilha. Cobertura e pendências acima já refletem a base operacional atual.</p>}
    </section>

    <section className="section comparator-section">
      <div className="panel-heading"><div><p className="eyebrow">Último período controlado</p><h2>Indicadores derivados lado a lado</h2></div><span className="muted">Sem propostas em revisão</span></div>
      <div className="table-wrap"><table className="comparator-indicators"><thead><tr><th>Indicador</th>{model.companies.map((company) => <th key={company.id}>{company.name}</th>)}</tr></thead><tbody>{indicatorRows.map((indicator) => <tr key={indicator.key}><th>{indicator.label}<small>{indicator.unit === "BRL_millions" ? "R$ milhões" : indicator.unit === "multiple" ? "vezes" : "%"}</small></th>{model.companies.map((company) => <td key={company.id}>{indicatorValue(company, indicator.key)}{company.indicators[indicator.key] && <small>{company.indicators[indicator.key]!.year}</small>}</td>)}</tr>)}</tbody></table></div>
    </section>

    <section className="comparator-method"><div><p className="eyebrow">Pavimento analítico</p><h2>O mesmo dado sustenta Empresa 360 e comparação.</h2></div><ol><li><strong>Mesma linha de base</strong><span>Evita números divergentes entre telas.</span></li><li><strong>Mesmo catálogo</strong><span>Variáveis e unidades preservam o de-para do Excel.</span></li><li><strong>Mesmo controle</strong><span>Pendências permanecem visíveis, mas fora dos cálculos.</span></li></ol></section>
  </>;
}

function CoverageBar({ value }: { value: number }) {
  return <div className="comparator-coverage"><strong>{value}%</strong><span><i style={{ width: `${value}%` }}/></span></div>;
}

function ComparisonCellView({ cell, unit, indexable }: { cell: ComparisonCompany["cells"][number]; unit: ComparisonModel["metric"]["unit"]; indexable: boolean }) {
  const point = cell.point;
  const available = point?.availability === "available" && typeof point.value === "number" && !point.suspiciousScale;
  if (!available) return <><strong>—</strong><small>{cell.calendarYear ?? "evento pendente"}</small></>;
  return <><strong>{formatComparisonValue(point.value as number, unit)}</strong><small>{cell.calendarYear}{indexable && cell.indexedValue !== null ? ` · índice ${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(cell.indexedValue)}` : ""}</small></>;
}
