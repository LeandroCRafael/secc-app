import Link from "next/link";
import { DiagnosticTabs } from "@/features/diagnostics/diagnostic-tabs";
import type { CompanyScore, ScorePortfolio } from "./score-model";

const statusLabels = { eligible: "Calculado", insufficient_data: "Cobertura insuficiente", baseline_pending: "Baseline pendente", event_pending: "Evento pendente" } as const;
const bandLabels = { limited: "Sinal limitado", attention: "Atenção", elevated: "Pressão elevada", very_elevated: "Pressão muito elevada" } as const;

function formatObserved(item: CompanyScore["contributions"][number]): string {
  const value = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(item.observed);
  return item.observedUnit === "percent" ? `${value}%` : `${value}x`;
}

export function ScoreView({ model }: { model: ScorePortfolio }) {
  return <>
    <DiagnosticTabs active="score" />
    <header className="admin-title score-title"><p className="eyebrow">Incremento 7 · laboratório metodológico</p><h1>Score experimental, explicável e bloqueado quando a evidência não basta.</h1><p className="lede">A versão {model.methodology.version} resume sinais financeiros observados em t-1. Pesos, células-fonte e ausências ficam visíveis; o resultado não é PD, rating ou recomendação.</p></header>

    <section className="score-summary" aria-label="Resumo do laboratório de score">
      <article><span>Baseline</span><strong>{model.baseline?.workbookVersion ?? "—"}</strong><small>{model.baseline ? `dados v${model.baseline.dataVersion}` : "sincronização pendente"}</small></article>
      <article><span>Elegíveis</span><strong>{model.eligibleCount}</strong><small>de {model.companies.length} empresas piloto</small></article>
      <article><span>Cobertura média</span><strong>{model.averageCoverage}%</strong><small>mínimo de {model.methodology.minimumCoverage}%</small></article>
      <article><span>Versão</span><strong className="score-version">v0.1</strong><small>{model.methodology.referenceDate}</small></article>
    </section>

    <section className="score-warning"><div><p className="eyebrow">Uso restrito</p><h2>Índice de sinais, não decisão de crédito.</h2></div><ul>{model.methodology.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul></section>

    <section className="section score-section">
      <div className="panel-heading"><div><p className="eyebrow">Coorte piloto</p><h2>Resultado por empresa</h2></div><span className="muted">Ordem alfabética · sem ranking</span></div>
      <div className="table-wrap"><table className="score-table"><thead><tr><th>Empresa</th><th>Janela</th><th>Cobertura</th><th>Score</th><th>Faixa experimental</th><th>Situação</th></tr></thead><tbody>{model.companies.map((company) => <tr key={company.companyId}><td><Link className="company-link" href={`/admin/empresas/${encodeURIComponent(company.companyId)}`}><strong>{company.name}</strong><span>Empresa 360 →</span></Link><small>{company.sector}</small></td><td><strong>{company.analysisYear ?? "—"}</strong><br/><small>t-1 do evento {company.eventYear ?? "—"}</small></td><td><strong>{company.coverage}%</strong><br/><small>{company.availableDimensions}/6 dimensões</small></td><td><strong className="score-number">{company.score ?? "—"}</strong><br/><small>escala 0–100</small></td><td>{company.band ? <span className={`status score-band-${company.band}`}>{bandLabels[company.band]}</span> : "—"}</td><td><span className={`status score-status-${company.status}`}>{statusLabels[company.status]}</span>{company.pendingChanges > 0 && <><br/><small>{company.pendingChanges} mudança(s) fora do cálculo</small></>}</td></tr>)}</tbody></table></div>
    </section>

    <section className="section score-section">
      <div className="panel-heading"><div><p className="eyebrow">Explicabilidade</p><h2>Contribuições e células-fonte</h2></div><span className="muted">Clique para auditar</span></div>
      <div className="score-explanations">{model.companies.map((company) => <details key={company.companyId}><summary><span><strong>{company.name}</strong><small>{company.status === "eligible" ? `score ${company.score} · ${company.coverage}% coberto` : `${company.coverage}% coberto · cálculo bloqueado`}</small></span><span>{company.contributions.reduce((sum, item) => sum + item.points, 0)} pts observados</span></summary><div className="table-wrap"><table><thead><tr><th>Dimensão</th><th>Observado</th><th>Pontos</th><th>Leitura da régua</th><th>Origem</th></tr></thead><tbody>{company.contributions.map((item) => <tr key={item.key}><td><strong>{item.label}</strong></td><td>{formatObserved(item)}</td><td>{item.points}/{item.maxPoints}</td><td>{item.interpretation}</td><td><span className="mono score-sources">{item.sources.join(" · ")}</span></td></tr>)}</tbody></table></div>{company.missingDimensions.length > 0 && <p className="notice">Faltam: {company.missingDimensions.join(", ")}.</p>}</details>)}</div>
    </section>

    <section className="score-method"><div><p className="eyebrow">Contrato metodológico</p><h2>{model.methodology.objective}</h2></div><dl><div><dt>Janela</dt><dd>{model.methodology.analysisWindow}</dd></div><div><dt>Elegibilidade</dt><dd>mínimo de {model.methodology.minimumCoverage}% e quatro dimensões</dd></div><div><dt>Tratamento de ausentes</dt><dd>normalização apenas pelo peso observado; abaixo do mínimo, não calcula</dd></div><div><dt>Próxima validação</dt><dd>definir variável-alvo, amostra de treino e teste temporal</dd></div></dl></section>
  </>;
}
