type BarDatum = { label: string; value: number };
type TierDatum = { label: string; total: number; withFinancial: number };

function width(value: number, maximum: number) {
  return maximum > 0 ? `${Math.max(value > 0 ? 2 : 0, (value / maximum) * 100)}%` : "0%";
}

export function CoverageDistributionChart({ data }: { data: BarDatum[] }) {
  const maximum = Math.max(...data.map((item) => item.value), 1);
  return (
    <article className="dashboard-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Distribuição</p>
          <h3>Cobertura financeira</h3>
        </div>
        <span className="muted">Empresas</span>
      </div>
      <div
        className="horizontal-chart"
        role="img"
        aria-label="Distribuição de empresas por faixa de cobertura financeira"
      >
        {data.map((item) => (
          <div className="chart-row" key={item.label}>
            <span>{item.label}</span>
            <div className="chart-track">
              <span
                className={`chart-bar band-${item.label === "Sem dados" ? "empty" : "filled"}`}
                style={{ width: width(item.value, maximum) }}
              />
            </div>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>
    </article>
  );
}

export function TierCoverageChart({ data }: { data: TierDatum[] }) {
  const maximum = Math.max(...data.map((item) => item.total), 1);
  return (
    <article className="dashboard-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Prioridade</p>
          <h3>Cobertura por Tier</h3>
        </div>
        <div className="chart-legend">
          <span className="legend-total">Total</span>
          <span className="legend-filled">Com financeiro</span>
        </div>
      </div>
      <div
        className="tier-chart"
        role="img"
        aria-label="Total de empresas e empresas com dados financeiros por Tier"
      >
        {data.map((item) => (
          <div className="tier-column" key={item.label}>
            <div className="tier-bars">
              <span className="tier-bar total" style={{ height: width(item.total, maximum) }}>
                <i>{item.total}</i>
              </span>
              <span
                className="tier-bar filled"
                style={{ height: width(item.withFinancial, maximum) }}
              >
                <i>{item.withFinancial}</i>
              </span>
            </div>
            <strong>{item.label}</strong>
          </div>
        ))}
      </div>
    </article>
  );
}
