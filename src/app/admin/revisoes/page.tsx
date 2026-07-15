import { requireRole } from "@/lib/auth/server";
import { PostgresOperationalRepository } from "@/lib/database/postgres-operational-repository";
import { ReviewDecisionForm } from "@/features/review/review-decision-form";
import { StatusBadge } from "@/components/ui/status-badge";
export const metadata = { title: "Revisões" };
export const dynamic = "force-dynamic";

export default async function ReviewsPage() {
  await requireRole("admin");
  const repository = new PostgresOperationalRepository();
  let proposals;
  let companies;
  try {
    [proposals, companies] = await Promise.all([repository.listProposals(), repository.listCompanies()]);
  } catch {
    return <><header className="admin-title"><p className="eyebrow">Fila de revisão</p><h1>Banco operacional indisponível.</h1></header><p className="notice" role="alert">Inicie o PostgreSQL local antes de revisar propostas.</p></>;
  }
  const companyNames = new Map(companies.map((company) => [company.id, company.name]));
  const pending = proposals.filter((proposal) => ["submitted", "under_review", "conflicted"].includes(proposal.status));

  return <><header className="admin-title"><p className="eyebrow">Fila de revisão · PostgreSQL</p><h1>Decidir altera a versão, não publica.</h1><p className="lede">Toda decisão exige justificativa, valida a versão aberta e grava auditoria na mesma transação.</p></header>{pending.length === 0 ? <p className="notice">Nenhuma proposta aguarda revisão.</p> : <section className="grid">{pending.map((proposal) => <article className="card" key={proposal.id}><div className="split"><div><p className="eyebrow">{companyNames.get(proposal.companyId) ?? "Empresa não localizada"}</p><h3>{proposal.variable}</h3><p>{proposal.year} · {proposal.value ?? "—"} · {proposal.unit}<br/>Fonte: <a href={proposal.source.url} rel="noreferrer">{proposal.source.title}</a><br/>Versão {proposal.version}</p></div><StatusBadge status={proposal.status} /></div>{proposal.notes && <p className="notice">{proposal.notes}</p>}<ReviewDecisionForm proposalId={proposal.id} version={proposal.version} /></article>)}</section>}</>;
}
