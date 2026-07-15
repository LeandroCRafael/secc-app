import { requireRole } from "@/lib/auth/server";
import { PostgresOperationalRepository } from "@/lib/database/postgres-operational-repository";
import { CompanyForm } from "@/features/intake/company-form";
import { ProposalForm } from "@/features/intake/proposal-form";
export const metadata = { title: "Pesquisa" };
export const dynamic = "force-dynamic";

export default async function ResearchPage() {
  await requireRole("admin");
  let companies;
  try {
    companies = await new PostgresOperationalRepository().listCompanies();
  } catch {
    return <><header className="admin-title"><p className="eyebrow">Entrada manual · PostgreSQL</p><h1>Banco operacional indisponível.</h1></header><p className="notice" role="alert">Inicie o Docker Desktop e confirme a conexão em Banco local antes de cadastrar registros.</p></>;
  }

  return <><header className="admin-title"><p className="eyebrow">Entrada manual · PostgreSQL</p><h1>Salvar cria proposta, não altera o aprovado.</h1><p className="lede">Fonte, período, unidade e estado são validados no servidor antes da fila de revisão.</p></header><section className="grid" style={{gap: 24}}><details className="card" open={companies.length === 0}><summary><strong>Cadastrar empresa</strong></summary><p>Todo novo cadastro nasce privado e gera um evento de auditoria.</p><CompanyForm /></details>{companies.length === 0 && <p className="notice">Cadastre uma empresa antes de enviar a primeira proposta.</p>}<ProposalForm companies={companies} /></section></>;
}
