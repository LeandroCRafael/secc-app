import Link from "next/link";
import { notFound } from "next/navigation";
import { formatMillions, formatMultiple, formatPercent, getPublicCompany, publicShowcase } from "@/features/public/public-showcase";

export function generateStaticParams() {
  return publicShowcase.companies.map(({ slug }) => ({ slug }));
}

export default async function CompanyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const company = getPublicCompany(slug);
  if (!company) notFound();

  const metrics = [
    ["Receita líquida", formatMillions(company.metrics.revenue), "R$ milhões"],
    ["Margem EBIT", formatPercent(company.metrics.ebitMargin), "EBIT / receita"],
    ["Margem líquida", formatPercent(company.metrics.netMargin), "lucro líquido / receita"],
    ["Liquidez corrente", formatMultiple(company.metrics.currentRatio), "ativo circulante / passivo circulante"],
    ["Dívida líquida / ativos", formatPercent(company.metrics.netDebtAssets), "endividamento líquido relativo"],
    ["Patrimônio líquido / ativos", formatPercent(company.metrics.equityAssets), "capital próprio relativo"],
    ["FCO / receita", formatPercent(company.metrics.operatingCashMargin), "conversão operacional de caixa"],
  ] as const;

  return (
    <main className="shell page">
      <div className="public-company-hero">
        <div>
          <p className="eyebrow">Empresa 360 · recorte público</p>
          <h1>{company.name}</h1>
          <p className="lede">{company.ticker} · {company.sector} · evento de referência em {company.eventYear}. O recorte usa somente o exercício anterior ao evento.</p>
          <span className="status under_review">{company.collectionStatus}</span>
        </div>
        <div className="public-score-panel"><span>Índice de sinais t-1</span><strong>{company.score}</strong><small>{company.scoreBand}<br />cobertura {company.scoreCoverage}%</small></div>
      </div>

      <section className="section public-kpis">
        <article><span>Ano analisado</span><strong>{company.analysisYear}</strong><small>posição t-1</small></article>
        <article><span>Ano do evento</span><strong>{company.eventYear}</strong><small>marco de alinhamento</small></article>
        <article><span>Janela coletada</span><strong className="public-small-metric">{company.collectionWindow}</strong><small>trajetória completa na Curadoria</small></article>
        <article><span>Cobertura cadastral</span><strong>{company.completion}%</strong><small>estado atual da planilha</small></article>
      </section>

      <section className="section public-heading">
        <div><p className="eyebrow">Indicadores selecionados</p><h2>Leitura financeira no instante anterior ao evento.</h2></div>
        <p>Os índices são calculados sobre os valores estruturados na planilha. Ausência não é convertida em zero.</p>
      </section>
      <div className="table-wrap">
        <table className="public-metrics-table"><thead><tr><th>Indicador</th><th>Valor em {company.analysisYear}</th><th>Leitura</th></tr></thead><tbody>
          {metrics.map(([label, value, note]) => <tr key={label}><td><strong>{label}</strong></td><td>{value}</td><td>{note}</td></tr>)}
        </tbody></table>
      </div>

      <section className="section grid two">
        <article className="card"><p className="eyebrow">Como o score lê o caso</p><h3>O resultado resume intensidade, não probabilidade.</h3><p>O índice combina seis sinais em uma régua de 0 a 100. Quanto maior, maior a intensidade dos sinais contábeis definidos na metodologia experimental. O resultado não estima default.</p><Link className="text-link" href="/metodologia">Ver pesos, cortes e limitações →</Link></article>
        <article className="card"><p className="eyebrow">Fonte e escopo</p><h3>Recorte verificável, exposição controlada.</h3><p>{company.sourceSummary}</p><p className="muted">{company.publicNote}</p><a className="text-link" href={company.sourceUrl} rel="noreferrer" target="_blank">Consultar fonte institucional →</a></article>
      </section>

      <section className="section notice">Este caso ainda está em conferência. A publicação demonstra o método e não substitui a revisão documental, a leitura das notas explicativas ou a análise profissional.</section>
    </main>
  );
}
