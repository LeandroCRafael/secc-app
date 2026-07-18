import Link from "next/link";
import { publicShowcase } from "@/features/public/public-showcase";

export default function HomePage() {
  const { portfolio, companies, score, sources, release } = publicShowcase;

  return (
    <main className="shell public-home">
      <section className="hero public-hero">
        <div>
          <p className="eyebrow">Inteligência financeira aplicada à reestruturação</p>
          <h1>Sinais financeiros antes do evento, com fonte, método e limites visíveis.</h1>
          <p className="lede">
            O SECC organiza empresas brasileiras em estresse ou reestruturação, reconstrói sua trajetória
            financeira e transforma evidências dispersas em análise comparável e auditável.
          </p>
          <div className="actions">
            <Link className="button" href="/empresas">Explorar a amostra pública</Link>
            <Link className="button secondary" href="/metodologia">Conhecer a metodologia</Link>
          </div>
        </div>
        <aside className="public-hero-proof" aria-label="Resumo da base">
          <span className="status available">Snapshot público {release.version}</span>
          <strong>{portfolio.companies}</strong>
          <p>empresas catalogadas na planilha mestre</p>
          <dl>
            <div><dt>Coletadas para conferência</dt><dd>{portfolio.collectedForReview}</dd></div>
            <div><dt>Em andamento</dt><dd>{portfolio.inProgress}</dd></div>
            <div><dt>Dimensões do score</dt><dd>{score.dimensions.length}</dd></div>
          </dl>
        </aside>
      </section>

      <section className="public-kpis" aria-label="Indicadores da plataforma">
        <article><span>Universo catalogado</span><strong>{portfolio.companies}</strong><small>empresas em três frentes de pesquisa</small></article>
        <article><span>Tier acadêmico</span><strong>{portfolio.tier1}</strong><small>casos prioritários para análise aprofundada</small></article>
        <article><span>Registros empresa-ano</span><strong>900+</strong><small>linhas financeiras estruturadas</small></article>
        <article><span>Modelo experimental</span><strong>t-1</strong><small>somente informação anterior ao evento</small></article>
      </section>

      <section className="section public-heading">
        <div>
          <p className="eyebrow">O que existe dentro da plataforma</p>
          <h2>Da pesquisa bruta à leitura executiva.</h2>
        </div>
        <p>O ambiente protegido concentra a profundidade; esta vitrine mostra a lógica, uma amostra dos dados e a governança aplicada.</p>
      </section>
      <section className="grid three public-capabilities">
        <article className="card"><span>01</span><h3>Empresa 360</h3><p>Cadastro, evento, janela relativa, séries financeiras, indicadores, fontes e pendências em uma leitura única.</p></article>
        <article className="card"><span>02</span><h3>Comparação</h3><p>Trajetórias alinhadas em t-1, t0 e t+1, com unidade, cobertura e ausência tratadas explicitamente.</p></article>
        <article className="card"><span>03</span><h3>Score explicável</h3><p>Seis dimensões financeiras, contribuição por variável e bloqueio automático quando a cobertura é insuficiente.</p></article>
        <article className="card"><span>04</span><h3>Pesquisa conectada</h3><p>Busca cadastral e documental na CVM, além de catálogo de RI, tribunais, B3, Economatica e Banco Central.</p></article>
        <article className="card"><span>05</span><h3>Curadoria</h3><p>Entradas manuais e arquivos viram propostas; revisão, decisão e auditoria antecedem qualquer alteração aprovada.</p></article>
        <article className="card"><span>06</span><h3>Excel controlado</h3><p>Preview, diff, backup, idempotência e conflito protegem a planilha mestre durante a sincronização.</p></article>
      </section>

      <section className="section public-heading">
        <div><p className="eyebrow">Amostra real sanitizada</p><h2>Três casos para visualizar o método.</h2></div>
        <p>Os recortes abaixo usam o exercício t-1 e permanecem identificados como “em conferência”. A série completa está na Curadoria.</p>
      </section>
      <section className="grid three">
        {companies.map((company) => (
          <article className="card public-company-card" key={company.slug}>
            <div className="split"><span className="status under_review">Em conferência</span><small>{company.ticker}</small></div>
            <h3>{company.name}</h3>
            <p>{company.sector} · evento em {company.eventYear}</p>
            <div className="public-score"><strong>{company.score}</strong><span>/100<br />índice de sinais</span></div>
            <Link className="button secondary" href={`/empresas/${company.slug}`}>Ver recorte Empresa 360</Link>
          </article>
        ))}
      </section>

      <section className="section public-source-panel">
        <div><p className="eyebrow">Fontes e conexões</p><h2>O dado não aparece sem linhagem.</h2><p>Cada fonte tem um papel operacional distinto: conexão, sincronização ou pesquisa documental.</p></div>
        <div className="public-source-list">
          {sources.map((source) => <div key={source.name}><strong>{source.name}</strong><span>{source.role}</span><small>{source.status}</small></div>)}
        </div>
      </section>

      <section className="section notice public-disclaimer">
        <strong>Uso responsável.</strong> O SECC tem finalidade acadêmica e informacional. O índice exibido é heurístico e experimental: não estima probabilidade de default, não constitui rating e não recomenda crédito ou investimento.
      </section>
    </main>
  );
}
