"use client";

import { useActionState } from "react";
import { submitProposalAction } from "@/app/admin/pesquisa/actions";
import { initialIntakeActionState } from "@/features/intake/action-state";
import type { Company } from "@/types/domain";

type ProposalFormProps = {
  companies: Company[];
  selectedCompanyId?: string;
  defaultYear?: number;
  returnTo?: string;
};

const variables = [
  "Receita Líquida", "CMV", "Lucro Bruto", "Despesas Operacionais", "EBIT",
  "Resultado Financeiro", "Lucro Líquido", "Caixa + Equivalentes", "Contas a Receber",
  "Estoques", "Ativo Circulante", "Imobilizado", "Ativo Total", "Fornecedores",
  "Empréstimos CP", "Passivo Circulante", "Empréstimos LP", "Passivo Total",
  "Patrimônio Líquido", "FCO", "Variação de Caixa",
];

export function ProposalForm({ companies, selectedCompanyId, defaultYear, returnTo }: ProposalFormProps) {
  const [state, action, pending] = useActionState(submitProposalAction, initialIntakeActionState);
  const selected = companies.find((company) => company.id === selectedCompanyId);
  return <form className="card form-grid" action={action}>
    {selected ? <><input name="companyId" type="hidden" value={selected.id}/><div className="full form-context"><span>Empresa selecionada</span><strong>{selected.name}</strong><small>{selected.sector} · {selected.referenceCode ?? "sem código de referência"}</small></div></> : <label>Empresa<select name="companyId" defaultValue="" required><option value="" disabled>Selecione</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label>}
    {returnTo && <input name="returnTo" type="hidden" value={returnTo}/>}
    <label>Ano<input name="year" type="number" min="1900" max="2200" defaultValue={defaultYear ?? 2020} required /></label>
    <label>Variável<input name="variable" list="secc-variables" defaultValue="Receita Líquida" required /><datalist id="secc-variables">{variables.map((variable) => <option key={variable} value={variable}/>)}</datalist></label>
    <label>Valor<input name="value" inputMode="decimal" /></label>
    <label>Unidade<select name="unit" defaultValue="BRL_millions"><option value="BRL">R$</option><option value="BRL_millions">R$ milhões</option><option value="percent">Percentual</option><option value="count">Contagem</option><option value="count_millions">Contagem em milhões</option><option value="text">Texto</option></select></label>
    <label>Disponibilidade<select name="availability" defaultValue="available"><option value="available">Disponível</option><option value="unavailable">N/D</option><option value="not_researched">Não pesquisado</option><option value="not_applicable">Não aplicável</option><option value="future_period">Período futuro</option></select></label>
    <label>Organização da fonte<input name="sourceOrganization" placeholder="CVM, companhia, B3, administrador judicial…" required /></label>
    <label>Data de referência<input name="referenceDate" type="date" required /></label>
    <label className="full">Título da fonte<input name="sourceTitle" required /></label>
    <label className="full">URL pública da fonte<input name="sourceUrl" type="url" required /></label>
    <label className="full">Observação<textarea name="notes" placeholder="Conta, página, critério de conversão ou limitação relevante." /></label>
    <p className="notice full">Esta inclusão cria uma proposta auditada. Ela não altera dados aprovados nem a planilha.</p>
    {state.status !== "idle" && <p className={state.status === "error" ? "error full" : "notice full"} role={state.status === "error" ? "alert" : "status"}>{state.message}</p>}
    <div className="full"><button className="button" type="submit" disabled={pending || companies.length === 0}>{pending ? "Gravando…" : "Validar e enviar para revisão"}</button></div>
  </form>;
}
