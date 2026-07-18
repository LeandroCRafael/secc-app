import Link from "next/link";
import { publicShowcase } from "@/features/public/public-showcase";

export const metadata = { title: "Empresas" };

export default function CompaniesPage() {
  const { portfolio, companies } = publicShowcase;
  return (
    <main className="shell page">
      <p className="eyebrow">Portfólio e cobertura</p>
      <h1>{portfolio.companies} empresas em diferentes estágios de pesquisa.</h1>
      <p className="lede">A lista mestre combina casos prioritários do estudo acadêmico, empresas do universo de produção e uma fila de busca. A vitrine pública apresenta três recortes sanitizados; a base integral permanece protegida.</p>

      <section className="section public-kpis">
        <article><span>Tier 1</span><strong>{portfolio.tier1}</strong><small>casos do estudo acadêmico</small></article>
        <article><span>Tier 2</span><strong>{portfolio.tier2}</strong><small>universo ampliado</small></article>
        <article><span>A buscar</span><strong>{portfolio.toResearch}</strong><small>fila de identificação</small></article>
        <article><span>Coletadas</span><strong>{portfolio.collectedForReview}</strong><small>aguardando conferência</small></article>
      </section>

      <section className="section public-heading">
        <div><p className="eyebrow">Amostra navegável</p><h2>Casos reais, exposição limitada.</h2></div>
        <p>Nome, evento, indicadores t-1 e resultado experimental são exibidos. Evidências, séries completas e anotações de curadoria não são públicas.</p>
      </section>
      <section className="grid three">
        {companies.map((company) => (
          <article className="card public-company-card" key={company.slug}>
            <div className="split"><span className="status under_review">{company.collectionStatus}</span><small>{company.tier}</small></div>
            <h3>{company.name}</h3>
            <p>{company.entityType} · {company.sector}<br />Evento: {company.eventYear} · janela {company.collectionWindow}</p>
            <div className="public-card-facts"><span>Cobertura da coleta <strong>{company.completion}%</strong></span><span>Score t-1 <strong>{company.score}/100</strong></span></div>
            <Link className="button secondary" href={`/empresas/${company.slug}`}>Ver recorte Empresa 360</Link>
          </article>
        ))}
      </section>

      <section className="section card public-progress-card">
        <div><p className="eyebrow">Diagnóstico operacional</p><h2>A ausência também é informação.</h2></div>
        <div className="public-progress-row"><span>Coletadas para conferência</span><strong>{portfolio.collectedForReview}</strong></div>
        <div className="public-progress-row"><span>Em andamento</span><strong>{portfolio.inProgress}</strong></div>
        <div className="public-progress-row"><span>Bloqueadas por fonte, evento ou identificação</span><strong>{portfolio.blocked}</strong></div>
        <p className="muted">Bloqueada não significa empresa sem dados; significa que a coleta ainda não superou um impedimento documentado.</p>
      </section>
    </main>
  );
}
