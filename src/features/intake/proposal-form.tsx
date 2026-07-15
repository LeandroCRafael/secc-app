"use client";

import { useActionState } from "react";
import { submitProposalAction } from "@/app/admin/pesquisa/actions";
import { initialIntakeActionState } from "@/features/intake/action-state";
import type { Company } from "@/types/domain";

export function ProposalForm({ companies }: { companies: Company[] }) {
  const [state, action, pending] = useActionState(submitProposalAction, initialIntakeActionState);
  return <form className="card form-grid" action={action}>
    <label>Empresa<select name="companyId" defaultValue="" required><option value="" disabled>Selecione</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label>
    <label>Ano<input name="year" type="number" min="1900" max="2200" defaultValue="2020" required /></label>
    <label>Variável<input name="variable" defaultValue="Receita líquida" required /></label>
    <label>Valor<input name="value" inputMode="decimal" /></label>
    <label>Unidade<select name="unit" defaultValue="BRL_millions"><option value="BRL_millions">R$ milhões</option><option value="percent">Percentual</option><option value="count">Contagem</option><option value="text">Texto</option></select></label>
    <label>Disponibilidade<select name="availability" defaultValue="available"><option value="available">Disponível</option><option value="unavailable">N/D</option><option value="not_researched">Não pesquisado</option><option value="not_applicable">Não aplicável</option><option value="future_period">Período futuro</option></select></label>
    <label>Organização da fonte<input name="sourceOrganization" required /></label>
    <label>Data de referência<input name="referenceDate" type="date" required /></label>
    <label className="full">Título da fonte<input name="sourceTitle" required /></label>
    <label className="full">URL pública da fonte<input name="sourceUrl" type="url" required /></label>
    <label className="full">Observação<textarea name="notes" /></label>
    {state.status !== "idle" && <p className={state.status === "error" ? "error full" : "notice full"} role={state.status === "error" ? "alert" : "status"}>{state.message}</p>}
    <div className="full"><button className="button" type="submit" disabled={pending || companies.length === 0}>{pending ? "Gravando…" : "Validar e enviar para revisão"}</button></div>
  </form>;
}
