import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/ui/status-badge";
import { demoCompanies, demoProposals } from "@/features/demo/data";

export function generateStaticParams() { return demoCompanies.map(({ slug }) => ({ slug })); }
export default async function CompanyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const company = demoCompanies.find((item) => item.slug === slug); if (!company) notFound();
  const points = demoProposals.filter((item) => item.companyId === company.id && item.status === "approved" && item.publishAuthorized);
  return <main className="shell page"><p className="eyebrow">Empresa 360 · demonstração</p><h1>{company.name}</h1><p className="lede">{company.sector}. Evento fictício de referência: {company.eventYear}. Nenhuma informação desta página representa empresa real.</p><section className="section"><div className="grid three"><div className="card"><p>Tier de pesquisa</p><div className="metric">{company.tier.replace("_", " ")}</div></div><div className="card"><p>Ano do evento</p><div className="metric">{company.eventYear}</div></div><div className="card"><p>Release</p><div className="metric">Demo</div></div></div><div className="table-wrap"><table><thead><tr><th>Variável</th><th>Período</th><th>Valor</th><th>Estado</th><th>Fonte</th></tr></thead><tbody>{points.length ? points.map((point) => <tr key={point.id}><td>{point.variable}</td><td>{point.year}</td><td>{point.availability === "available" ? `${point.value} ${point.unit}` : "—"}</td><td><StatusBadge status={point.availability}/></td><td><a href={point.source.url} rel="noreferrer">{point.source.title}</a></td></tr>) : <tr><td colSpan={5}>Nenhum registro aprovado e autorizado para publicação nesta prévia.</td></tr>}</tbody></table></div></section></main>;
}
