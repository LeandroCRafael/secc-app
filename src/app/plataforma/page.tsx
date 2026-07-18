import Link from "next/link";

const capabilities = [
  { number: "01", title: "Pesquisar e conectar", status: "Operacional", text: "Busca companhias na CVM, vincula CNPJ e código CVM e prepara a coleta de demonstrações padronizadas.", items: ["Pesquisa cadastral CVM", "Vínculo controlado", "Coleta DFP como proposta"] },
  { number: "02", title: "Receber dados", status: "Operacional", text: "Formulários e arquivos estruturados entram em área protegida, com validação de formato e conteúdo.", items: ["Entrada manual", "Upload CSV/XLSX", "Preview antes da importação"] },
  { number: "03", title: "Revisar e aprovar", status: "Operacional", text: "Toda alteração passa por uma fila de revisão com decisão, justificativa e trilha de auditoria.", items: ["Propostas versionadas", "Papéis protegidos", "Conflitos explícitos"] },
  { number: "04", title: "Atualizar a planilha", status: "Operacional", text: "A sincronização produz diff, verifica a versão de origem, cria backup e aplica lotes idempotentes.", items: ["De-para versionado", "Backup obrigatório", "Resultado por célula"] },
  { number: "05", title: "Analisar", status: "Em evolução", text: "Empresa 360, comparação e score experimental traduzem dados aprovados em leitura executiva explicável.", items: ["Trajetória relativa", "Indicadores derivados", "Score por contribuição"] },
] as const;

export const metadata = { title: "Plataforma" };

export default function PlatformPage() {
  return (
    <main className="shell page">
      <p className="eyebrow">Plataforma operacional</p>
      <h1>Pesquisar, revisar, analisar e devolver ao Excel.</h1>
      <p className="lede">O SECC não é apenas uma camada de visualização. A plataforma organiza o ciclo completo do dado, preservando a planilha mestre como referência e separando trabalho interno de publicação.</p>

      <section className="section pipeline" aria-label="Fluxo operacional da plataforma">
        {capabilities.map((stage) => <article className="pipeline-stage" key={stage.number}><div className="pipeline-number">{stage.number}</div><div><div className="split"><h2>{stage.title}</h2><span className="status available">{stage.status}</span></div><p>{stage.text}</p><ul>{stage.items.map((item) => <li key={item}>{item}</li>)}</ul></div></article>)}
      </section>

      <section className="section public-method-boundary">
        <div><p className="eyebrow">Sem senha</p><h2>Demonstração e transparência.</h2><ul><li>resumo do portfólio e cobertura;</li><li>amostra sanitizada de empresas;</li><li>comparação t-1;</li><li>metodologia e limitações do score;</li><li>fontes e data do snapshot.</li></ul></div>
        <div><p className="eyebrow">Curadoria protegida</p><h2>Profundidade e operação.</h2><ul><li>diagnóstico completo por empresa;</li><li>séries, evidências e observações;</li><li>pesquisa CVM e importação de arquivos;</li><li>revisão, aprovação e auditoria;</li><li>sincronização controlada com Excel.</li></ul></div>
      </section>

      <section className="section card"><div className="split"><div><p className="eyebrow">Acesso interno</p><h2>O trabalho aprofundado começa na Curadoria.</h2><p>As ações de escrita exigem autenticação e ficam vinculadas ao usuário responsável.</p></div><Link className="button" href="/admin">Entrar na Curadoria</Link></div></section>
    </main>
  );
}
