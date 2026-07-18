import { publicShowcase } from "@/features/public/public-showcase";

const rules = [
  ["Margem EBIT", "20", "20 pontos se negativa; 10 se positiva e inferior a 5%."],
  ["Margem líquida", "15", "15 pontos se negativa; 7,5 se positiva e inferior a 3%."],
  ["Liquidez corrente", "15", "15 pontos abaixo de 1,0x; 7,5 entre 1,0x e 1,2x."],
  ["Dívida líquida / ativos", "20", "20 pontos acima de 60%; 14 entre 40% e 60%; 7 entre 20% e 40%."],
  ["Patrimônio líquido / ativos", "15", "15 pontos se negativo; 8 se positivo e inferior a 15%."],
  ["FCO / receita", "15", "15 pontos se negativo; 8 se positivo e inferior a 5%."],
] as const;

export const metadata = { title: "Metodologia" };

export default function MethodologyPage() {
  const { score, release } = publicShowcase;
  return (
    <main className="shell page">
      <p className="eyebrow">Metodologia pública · versão {score.version}</p>
      <h1>Um score explicável começa por uma janela sem vazamento.</h1>
      <p className="lede">O modelo experimental resume sinais contábeis observáveis no exercício anterior ao evento. Pesos, cortes, cobertura e limitações são públicos para que o resultado possa ser reproduzido e criticado.</p>

      <section className="section public-method-steps">
        <article><span>01</span><div><h3>Definir o evento</h3><p>O ano de recuperação ou reestruturação organiza a trajetória relativa da empresa.</p></div></article>
        <article><span>02</span><div><h3>Congelar a informação em t-1</h3><p>Dados posteriores ao evento são excluídos do score para reduzir vazamento de informação.</p></div></article>
        <article><span>03</span><div><h3>Calcular seis dimensões</h3><p>Rentabilidade, liquidez, alavancagem, solvência patrimonial e geração operacional de caixa.</p></div></article>
        <article><span>04</span><div><h3>Testar cobertura</h3><p>O resultado só aparece com pelo menos {score.minimumCoverage}% do peso e {score.minimumDimensions} dimensões disponíveis.</p></div></article>
      </section>

      <section className="section public-heading"><div><p className="eyebrow">Régua experimental</p><h2>Pesos e cortes documentados.</h2></div><p>Mais pontos representam maior intensidade dos sinais predefinidos. Não representam maior probabilidade estimada de default.</p></section>
      <div className="table-wrap"><table><thead><tr><th>Dimensão</th><th>Peso máximo</th><th>Regra de pontuação</th></tr></thead><tbody>{rules.map(([name, weight, rule]) => <tr key={name}><td><strong>{name}</strong></td><td>{weight}</td><td>{rule}</td></tr>)}</tbody></table></div>

      <section className="section grid four public-bands">
        <article className="card"><span>0–24</span><h3>Sinais limitados</h3></article>
        <article className="card"><span>25–49</span><h3>Atenção</h3></article>
        <article className="card"><span>50–74</span><h3>Sinais elevados</h3></article>
        <article className="card"><span>75–100</span><h3>Sinais muito elevados</h3></article>
      </section>

      <section className="section public-method-boundary">
        <div><p className="eyebrow">O que o score faz</p><h2>Padroniza uma primeira leitura.</h2><ul><li>expõe contribuição por dimensão;</li><li>preserva o ano e as fontes utilizadas;</li><li>bloqueia resultados com cobertura insuficiente;</li><li>permite comparar regras iguais em casos diferentes.</li></ul></div>
        <div><p className="eyebrow">O que o score não faz</p><h2>Não autoriza decisão de crédito.</h2><ul><li>não estima probabilidade de default;</li><li>não foi calibrado ou validado fora da amostra;</li><li>não incorpora ainda governança, mercado e contexto jurídico;</li><li>não constitui rating ou recomendação.</li></ul></div>
      </section>

      <section className="section notice">Versão de referência: {release.referenceDate}. Próximo gate metodológico: definir variável-alvo, amostra de validação, tratamento de ausentes, estabilidade temporal e critérios de recalibração.</section>
    </main>
  );
}
