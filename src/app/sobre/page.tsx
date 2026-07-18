export const metadata = { title: "Sobre" };

export default function AboutPage() {
  return (
    <main className="shell page">
      <p className="eyebrow">Sobre o SECC</p>
      <h1>Evidência financeira organizada para compreender trajetórias de estresse.</h1>
      <p className="lede">O SECC é uma plataforma de pesquisa aplicada sobre empresas brasileiras em recuperação, reestruturação ou situação de estresse. Seu diferencial está em aproximar dado, fonte, contexto temporal, qualidade e método.</p>

      <section className="section grid three">
        <article className="card"><p className="eyebrow">Problema</p><h3>A evidência existe, mas chega fragmentada.</h3><p>Demonstrações, processos, fatos relevantes e séries de mercado usam formatos e calendários diferentes.</p></article>
        <article className="card"><p className="eyebrow">Resposta</p><h3>Uma base orientada ao evento.</h3><p>As trajetórias são alinhadas em t-1, t0 e t+1, com unidade, fonte, cobertura e ausência documentadas.</p></article>
        <article className="card"><p className="eyebrow">Disciplina</p><h3>Governança antes da publicação.</h3><p>Coleta, revisão, aprovação, sincronização e release são eventos diferentes e auditáveis.</p></article>
      </section>

      <section className="section public-method-boundary"><div><p className="eyebrow">Finalidade</p><h2>Acadêmica e informacional.</h2><p>O projeto busca apoiar pesquisa, análise comparativa e desenvolvimento metodológico. Não concede crédito nem substitui julgamento profissional.</p></div><div><p className="eyebrow">Compromisso</p><h2>Conclusões proporcionais à evidência.</h2><p>Dados faltantes, fontes divergentes, hipóteses, limitações e estágios de revisão devem permanecer visíveis em toda leitura.</p></div></section>
      <section className="section notice">Os indicadores e o score experimental não constituem rating, recomendação de investimento ou decisão de crédito.</section>
    </main>
  );
}
