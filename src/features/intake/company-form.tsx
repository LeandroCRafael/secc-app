"use client";

import { useActionState } from "react";
import { createCompanyAction } from "@/app/admin/pesquisa/actions";
import { initialIntakeActionState } from "@/features/intake/action-state";

export function CompanyForm() {
  const [state, action, pending] = useActionState(createCompanyAction, initialIntakeActionState);

  return (
    <form className="card form-grid" action={action}>
      <label>Nome<input name="name" required /></label>
      <label>Identificador na URL<input name="slug" placeholder="empresa-exemplo" required /></label>
      <label>Setor<input name="sector" required /></label>
      <label>Tier<select name="tier" defaultValue="unclassified"><option value="unclassified">Não classificado</option><option value="tier_1">Tier 1</option><option value="tier_2">Tier 2</option></select></label>
      <label>Tipo do evento<select name="eventType" defaultValue="judicial_recovery"><option value="judicial_recovery">Recuperação judicial</option><option value="extrajudicial_recovery">Recuperação extrajudicial</option><option value="bankruptcy">Falência</option><option value="restructuring">Reestruturação</option></select></label>
      <label>Ano do evento<input name="eventYear" type="number" min="1900" max="2200" required /></label>
      {state.status !== "idle" && <p className={state.status === "error" ? "error full" : "notice full"} role={state.status === "error" ? "alert" : "status"}>{state.message}</p>}
      <div className="full"><button className="button secondary" type="submit" disabled={pending}>{pending ? "Gravando…" : "Cadastrar empresa privada"}</button></div>
    </form>
  );
}
