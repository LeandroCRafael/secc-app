import publicManifest from "../../../data/public/manifest.json";
import { publicShowcase } from "@/features/public/public-showcase";

export const metadata = { title: "Dados" };

export default function DataPage() {
  const { portfolio, sources, limitations, release } = publicShowcase;
  return (
    <main className="shell page">
      <p className="eyebrow">Dados, cobertura e proveniência</p>
      <h1>Um snapshot público pequeno diante de uma base protegida maior.</h1>
      <p className="lede">A vitrine consome um arquivo sanitizado e versionado. Planilha mestre, evidências, arquivos enviados, propostas e trilha de auditoria não são entregues ao navegador.</p>

      <section className="section public-kpis">
        <article><span>Release pública</span><strong className="public-small-metric">{release.version}</strong><small>referência {release.referenceDate}</small></article>
        <article><span>Empresas catalogadas</span><strong>{portfolio.companies}</strong><small>contagem reconciliada</small></article>
        <article><span>Casos publicados</span><strong>{publicManifest.counts.publishedCompanyCases}</strong><small>amostra sanitizada</small></article>
        <article><span>Baseline</span><strong className="public-small-metric">{release.baselineVersion}</strong><small>mapeamento {release.mappingVersion}</small></article>
      </section>

      <section className="section public-heading"><div><p className="eyebrow">Mapa de fontes</p><h2>Cada conexão tem finalidade e limite.</h2></div><p>“Conectado” é reservado ao que já opera no aplicativo. As demais origens permanecem identificadas como sincronização ou pesquisa.</p></section>
      <div className="table-wrap"><table><thead><tr><th>Fonte</th><th>Papel na base</th><th>Estado operacional</th></tr></thead><tbody>{sources.map((source) => <tr key={source.name}><td><strong>{source.name}</strong></td><td>{source.role}</td><td><span className="status">{source.status}</span></td></tr>)}</tbody></table></div>

      <section className="section public-lineage">
        <div><p className="eyebrow">Linhagem</p><h2>Da fonte à publicação.</h2></div>
        <ol><li><strong>Coleta</strong><span>CVM, planilha, fontes de mercado e pesquisa documental.</span></li><li><strong>Proposta</strong><span>O dado novo entra sem sobrescrever a base aprovada.</span></li><li><strong>Revisão</strong><span>Curador e revisor avaliam valor, período, unidade e evidência.</span></li><li><strong>Sincronização</strong><span>Excel recebe somente lotes controlados, com backup, diff e conflito.</span></li><li><strong>Snapshot</strong><span>O público recebe apenas o recorte sanitizado e versionado.</span></li></ol>
      </section>

      <section className="section grid two"><article className="card"><h3>O que fica público</h3><p>Contagens, casos selecionados, indicadores derivados, metodologia, fontes institucionais, data de referência e limitações.</p></article><article className="card"><h3>O que permanece protegido</h3><p>Arquivos brutos, caminhos locais, credenciais, evidências privadas, observações de trabalho, séries integrais e ações de escrita.</p></article></section>
      <section className="section notice"><strong>Limitações declaradas.</strong><ul>{limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul></section>
    </main>
  );
}
