import Link from "next/link";
import { StatusBadge } from "@/components/ui/status-badge";
import { coverageRate, financialCoverageRate } from "@/features/diagnostics/dashboard-model";
import {
  company360MetricGroups,
  eventRelativeLabel,
  type Company360Indicator,
  type Company360Model,
  type Company360Point
} from "./company-360-model";

const workflowLabels = {
  draft: "Rascunho",
  submitted: "Enviada",
  under_review: "Em revisão",
  approved: "Aprovada · aguarda Excel",
  rejected: "Rejeitada",
  synchronized: "Sincronizada",
  published: "Publicada",
  conflicted: "Conflito"
} as const;

const unitLabels = {
  BRL: "R$",
  BRL_millions: "R$ milhões",
  percent: "%",
  count: "contagem",
  count_millions: "milhões",
  text: "texto"
} as const;

function percent(filled = 0, expected = 0): number {
  return Math.round(coverageRate(filled, expected) * 100);
}

function formatPoint(point: Company360Point | undefined): string {
  if (!point || point.availability !== "available") return "—";
  if (point.suspiciousScale) return "Escala a validar";
  if (typeof point.value === "string") return point.value;
  if (typeof point.value !== "number") return "—";
  if (point.unit === "percent")
    return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(point.value)}%`;
  if (point.unit === "BRL")
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 2
    }).format(point.value);
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(point.value);
}

function formatIndicator(indicator: Company360Indicator): string {
  if (indicator.unit === "percent")
    return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(indicator.value)}%`;
  if (indicator.unit === "multiple")
    return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(indicator.value)}x`;
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(indicator.value);
}

function latestByVariable(points: Company360Point[]): Company360Point[] {
  const latest = new Map<string, Company360Point>();
  for (const point of points) {
    const current = latest.get(point.variable);
    if (!current || point.year > current.year) latest.set(point.variable, point);
  }
  return [...latest.values()].sort((left, right) =>
    left.variable.localeCompare(right.variable, "pt-BR")
  );
}

export function Company360View({ model }: { model: Company360Model }) {
  const { company, baseline } = model;
  const coverage = company.coverage;
  const financialPercent = Math.round(financialCoverageRate(company) * 100);
  const qualitativePercent = percent(coverage?.qualitativeFilled, coverage?.qualitativeExpected);
  const marketPercent = percent(coverage?.marketFilled, coverage?.marketExpected);
  const latestQualitative = latestByVariable(model.qualitativePoints);
  const latestMarket = latestByVariable(model.marketPoints);

  return (
    <>
      <section className="company360-hero" aria-labelledby="company360-heading">
        <div>
          <div className="company360-kicker">
            <span className="eyebrow">Empresa 360 · incremento 5</span>
            {model.isPilot && <span className="status available">Coorte piloto</span>}
          </div>
          <h2 id="company360-heading">Diagnóstico financeiro e qualidade da evidência.</h2>
          <p>{model.executiveSummary}</p>
        </div>
        <div className="company360-actions">
          <Link className="button" href="#pesquisa-e-entrada">
            Pesquisar e atualizar
          </Link>
          <Link className="button secondary" href="/admin/sincronizacao">
            Sincronizar Excel
          </Link>
        </div>
      </section>

      {!baseline && (
        <p className="company360-baseline-warning" role="status">
          <strong>Linha de base pendente.</strong> Envie a planilha atual em Sincronização Excel e
          aplique o primeiro lote. Até lá, cobertura e propostas são exibidas, mas séries e
          indicadores permanecem bloqueados.
        </p>
      )}
      {baseline && (
        <div className="company360-baseline">
          <span>
            <strong>{baseline.workbookVersion}</strong> · dados v{baseline.dataVersion}
          </span>
          <span>De-para {baseline.mappingVersion}</span>
          <span>
            Integridade <span className="mono">{baseline.sha256.slice(0, 12)}…</span>
          </span>
          <span>
            {new Intl.DateTimeFormat("pt-BR", {
              dateStyle: "short",
              timeStyle: "short",
              timeZone: "America/Sao_Paulo"
            }).format(new Date(baseline.createdAt))}
          </span>
        </div>
      )}

      <section className="company360-summary" aria-label="Resumo da Empresa 360">
        <article>
          <span>Cobertura financeira</span>
          <strong>{financialPercent}%</strong>
          <small>
            {coverage?.financialFilled ?? 0}/{coverage?.financialExpected ?? 0} células na planilha
          </small>
        </article>
        <article>
          <span>Cobertura qualitativa</span>
          <strong>{qualitativePercent}%</strong>
          <small>
            {coverage?.qualitativeFilled ?? 0}/{coverage?.qualitativeExpected ?? 0} células
          </small>
        </article>
        <article>
          <span>Mercado</span>
          <strong>{marketPercent}%</strong>
          <small>
            {company.companyType?.toLocaleLowerCase("pt-BR").includes("listada")
              ? "companhia listada"
              : "quando aplicável"}
          </small>
        </article>
        <article>
          <span>Último período controlado</span>
          <strong>{model.latestTrustedYear ?? "—"}</strong>
          <small>
            {company.eventYear
              ? `evento de referência em ${company.eventYear}`
              : "evento ainda não confirmado"}
          </small>
        </article>
      </section>

      <section className="section company360-section">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Indicadores derivados</p>
            <h2>Leitura do último período controlado</h2>
          </div>
          <span className="muted">Somente valores sincronizados</span>
        </div>
        {model.indicators.length === 0 ? (
          <p className="notice">
            Os indicadores serão calculados depois que a linha de base estiver aplicada e contiver
            as contas necessárias. Propostas em revisão não entram no cálculo.
          </p>
        ) : (
          <div className="company360-indicators">
            {model.indicators.map((indicator) => (
              <article key={indicator.key}>
                <span>{indicator.label}</span>
                <strong>{formatIndicator(indicator)}</strong>
                <small>
                  {indicator.year} ·{" "}
                  {indicator.unit === "BRL_millions"
                    ? "R$ milhões"
                    : indicator.unit === "multiple"
                      ? "vezes"
                      : "%"}
                </small>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="section company360-section">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Trajetória</p>
            <h2>Financeiro em torno do evento</h2>
          </div>
          <span className="muted">Unidades e lacunas preservadas</span>
        </div>
        {model.years.length === 0 ? (
          <div className="company360-empty">
            <strong>Série financeira ainda não liberada.</strong>
            <p>
              A cobertura existente foi calculada da planilha, mas os valores detalhados ainda não
              possuem snapshot controlado no banco. A primeira sincronização desbloqueia esta
              matriz.
            </p>
            <Link href="/admin/sincronizacao">Estabelecer linha de base →</Link>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="company360-matrix">
              <thead>
                <tr>
                  <th>Indicador</th>
                  {model.years.map((year) => (
                    <th key={year}>{eventRelativeLabel(year, company.eventYear)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {company360MetricGroups.map((group) => (
                  <FragmentGroup
                    key={group.key}
                    label={group.label}
                    variables={group.variables}
                    model={model}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="company360-two-column">
        <article className="company360-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Sinais qualitativos</p>
              <h2>Auditoria e alertas</h2>
            </div>
          </div>
          {latestQualitative.length === 0 ? (
            <p className="muted">Nenhum sinal qualitativo disponível na linha de base.</p>
          ) : (
            <dl className="company360-facts">
              {latestQualitative.map((point) => (
                <div key={point.variable}>
                  <dt>{point.variable}</dt>
                  <dd>
                    {formatPoint(point)} <small>{point.year}</small>
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </article>
        <article className="company360-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Mercado</p>
              <h2>Companhias listadas</h2>
            </div>
          </div>
          {latestMarket.length === 0 ? (
            <p className="muted">
              Nenhuma informação de mercado disponível ou aplicável na linha de base.
            </p>
          ) : (
            <dl className="company360-facts">
              {latestMarket.map((point) => (
                <div key={point.variable}>
                  <dt>{point.variable}</dt>
                  <dd>
                    {formatPoint(point)}{" "}
                    <small>
                      {unitLabels[point.unit]} · {point.year}
                    </small>
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </article>
      </section>

      <section className="section company360-section">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Mudanças em fluxo</p>
            <h2>Do dado pesquisado até o Excel</h2>
          </div>
          <div className="company360-flow-counts">
            <span>{model.statusCounts.under_review} em revisão</span>
            <span>{model.statusCounts.approved} aprovadas</span>
            <span>{model.statusCounts.synchronized} sincronizadas</span>
          </div>
        </div>
        {model.suspiciousPendingCount > 0 && (
          <p className="company360-scale-alert" role="alert">
            <strong>{model.suspiciousPendingCount} proposta(s) com escala incompatível.</strong>{" "}
            Permanecem fora dos indicadores e precisam ser recolhidas ou corrigidas antes da
            aprovação.
          </p>
        )}
        {model.pendingPoints.length === 0 ? (
          <p className="notice">Nenhuma alteração pendente para esta empresa.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Período</th>
                  <th>Variável</th>
                  <th>Valor proposto</th>
                  <th>Fonte</th>
                  <th>Etapa</th>
                </tr>
              </thead>
              <tbody>
                {model.pendingPoints.map((point) => (
                  <tr key={point.id}>
                    <td>{eventRelativeLabel(point.year, company.eventYear)}</td>
                    <td>
                      <strong>{point.variable}</strong>
                      {point.suspiciousScale && (
                        <>
                          <br />
                          <span className="error">Escala a validar</span>
                        </>
                      )}
                    </td>
                    <td>
                      {formatPoint(point)}
                      <br />
                      <small className="muted">{unitLabels[point.unit]}</small>
                    </td>
                    <td>
                      <a href={point.sourceUrl} rel="noreferrer" target="_blank">
                        {point.sourceOrganization} ↗
                      </a>
                      <br />
                      <small className="muted">{point.referenceDate}</small>
                    </td>
                    <td>
                      <StatusBadge status={point.workflowStatus} />
                      <br />
                      <small className="muted">{workflowLabels[point.workflowStatus]}</small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="company360-lineage">
        <div>
          <p className="eyebrow">Rastreabilidade</p>
          <h2>Como ler esta página</h2>
        </div>
        <ol>
          <li>
            <strong>Planilha sincronizada</strong>
            <span>Forma a série controlada e sustenta indicadores.</span>
          </li>
          <li>
            <strong>Proposta aprovada</strong>
            <span>Aparece como mudança aguardando a próxima versão do Excel.</span>
          </li>
          <li>
            <strong>Em revisão ou conflito</strong>
            <span>É visível, mas não altera diagnóstico nem cálculo.</span>
          </li>
        </ol>
      </section>
    </>
  );
}

function FragmentGroup({
  label,
  variables,
  model
}: {
  label: string;
  variables: readonly string[];
  model: Company360Model;
}) {
  return (
    <>
      <tr className="company360-group">
        <th colSpan={model.years.length + 1}>{label}</th>
      </tr>
      {variables.map((variable) => {
        const series = model.financialSeries.find((item) => item.variable === variable);
        return (
          <tr key={variable}>
            <th>
              {variable}
              <small>{series ? unitLabels[series.unit] : "R$ milhões"}</small>
            </th>
            {model.years.map((year) => {
              const point = series?.points.find((item) => item.year === year);
              return (
                <td
                  key={year}
                  className={point?.availability !== "available" ? "company360-gap" : undefined}
                >
                  {formatPoint(point)}
                  {point?.cellReference && (
                    <span className="company360-cell mono">
                      {point.cellReference.split("!").at(-1)}
                    </span>
                  )}
                </td>
              );
            })}
          </tr>
        );
      })}
    </>
  );
}
