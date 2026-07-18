import Link from "next/link";
import { formatPercent, publicShowcase } from "@/features/public/public-showcase";

export const metadata = { title: "Comparar" };

export default function ComparePage() {
  const { companies } = publicShowcase;
  return (
    <main className="shell page">
      <p className="eyebrow">Comparação t-1</p>
      <h1>Três trajetórias alinhadas pelo momento do evento.</h1>
      <p className="lede">Calendários diferentes se tornam comparáveis quando cada empresa é posicionada em relação ao seu próprio evento. Nesta amostra, a leitura pública está limitada ao exercício t-1.</p>

      <section className="section table-wrap">
        <table className="public-comparison-table">
          <thead><tr><th>Empresa</th><th>Ano t-1</th><th>Receita</th><th>Margem EBIT</th><th>Liquidez</th><th>PL / ativos</th><th>Score</th></tr></thead>
          <tbody>{companies.map((company) => <tr key={company.slug}>
            <td><Link className="text-link" href={`/empresas/${company.slug}`}>{company.name}</Link><small>{company.sector}</small></td>
            <td>{company.analysisYear}</td>
            <td>R$ {new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(company.metrics.revenue)} mi</td>
            <td>{formatPercent(company.metrics.ebitMargin)}</td>
            <td>{company.metrics.currentRatio.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}x</td>
            <td>{formatPercent(company.metrics.equityAssets)}</td>
            <td><strong>{company.score}/100</strong><small>{company.scoreBand}</small></td>
          </tr>)}</tbody>
        </table>
      </section>

      <section className="section grid three">
        <article className="card"><p className="eyebrow">Alinhamento</p><h3>O evento define o relógio.</h3><p>t-1 é o último exercício anterior ao evento; t0 é o ano do evento; t+1 inicia a leitura posterior.</p></article>
        <article className="card"><p className="eyebrow">Comparabilidade</p><h3>Unidade e conceito vêm antes do gráfico.</h3><p>Valores financeiros usam R$ milhões. Razões são derivadas de uma mesma definição por empresa e período.</p></article>
        <article className="card"><p className="eyebrow">Limite</p><h3>Score não ordena qualidade de crédito.</h3><p>A régua resume sinais definidos pelo modelo experimental e não substitui contexto qualitativo ou validação estatística.</p></article>
      </section>
      <section className="section notice">A comparação pública usa casos em conferência e serve para demonstrar o método. Séries completas, notas de fonte e pendências ficam na Curadoria.</section>
    </main>
  );
}
