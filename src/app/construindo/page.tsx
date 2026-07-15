const stages = [
  {
    number: "01",
    title: "Entrada controlada",
    status: "Em construção",
    text: "Pesquisa manual, formulários estruturados e uploads privados de CSV/XLSX entram como propostas — nunca como publicação automática.",
    items: ["Formulário manual ativo", "Política de upload validada", "Evidências documentais planejadas"],
  },
  {
    number: "02",
    title: "Qualidade e governança",
    status: "Base entregue",
    text: "Schemas, estados de ausência, fontes, revisão humana, controle de versão e auditoria preservam o contexto de cada dado.",
    items: ["Validação no servidor", "Auditoria append-only", "Fila de revisão em integração"],
  },
  {
    number: "03",
    title: "Base operacional",
    status: "Local ativa",
    text: "PostgreSQL organiza empresas, propostas, decisões e eventos. A planilha oficial permanece separada e será sincronizada por arquivo versionado.",
    items: ["PostgreSQL versionado", "Transações atômicas", "Excel pessoal sem acesso direto"],
  },
  {
    number: "04",
    title: "Saída pública",
    status: "Próxima etapa",
    text: "Somente registros aprovados, autorizados e sanitizados formarão snapshots públicos com fonte, período, cobertura e limitações visíveis.",
    items: ["Release imutável", "Manifesto e hashes", "Score permanece fora do MVP"],
  },
] as const;

export const metadata = { title: "Construindo a base" };

export default function BuildingPage() {
  return <main className="shell page"><p className="eyebrow">Evolução do produto</p><h1>Como a evidência se transforma em base confiável.</h1><p className="lede">Esta página mostra a arquitetura em construção. A prévia usa somente dados fictícios; nenhuma planilha oficial ou informação privada está publicada.</p><section className="section pipeline" aria-label="Pipeline de enriquecimento do banco de dados">{stages.map((stage) => <article className="pipeline-stage" key={stage.number}><div className="pipeline-number">{stage.number}</div><div><div className="split"><h2>{stage.title}</h2><span className="status">{stage.status}</span></div><p>{stage.text}</p><ul>{stage.items.map((item) => <li key={item}>{item}</li>)}</ul></div></article>)}</section><section className="section grid three"><article className="card"><p className="eyebrow">Regra central</p><h3>Coletar não é aprovar.</h3><p>Cada entrada nasce como proposta e precisa atravessar validação e revisão.</p></article><article className="card"><p className="eyebrow">Segurança</p><h3>Privado por padrão.</h3><p>Uploads, banco operacional e planilha mestre não fazem parte desta prévia pública.</p></article><article className="card"><p className="eyebrow">Transparência</p><h3>Limitações visíveis.</h3><p>Fonte, data, unidade, ausência e cobertura acompanharão cada indicador publicado.</p></article></section></main>;
}
