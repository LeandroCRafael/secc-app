"use client";

import { useActionState } from "react";
import { reviewProposalAction, type ReviewActionState } from "@/app/admin/revisoes/actions";

const initialState: ReviewActionState = { status: "idle", message: "" };

export function ReviewDecisionForm({ proposalId, version }: { proposalId: string; version: number }) {
  const [state, action, pending] = useActionState(reviewProposalAction, initialState);

  return <form className="form-grid" action={action}>
    <input type="hidden" name="proposalId" value={proposalId} />
    <input type="hidden" name="expectedVersion" value={version} />
    <label>Decisão<select name="decision" defaultValue="approved"><option value="approved">Aprovar</option><option value="changes_requested">Solicitar ajustes</option><option value="rejected">Rejeitar</option></select></label>
    <label className="full">Justificativa<textarea name="justification" required minLength={10} maxLength={500} /></label>
    {state.status !== "idle" && <p className={state.status === "error" ? "error full" : "notice full"} role={state.status === "error" ? "alert" : "status"}>{state.message}</p>}
    <div className="full"><button className="button" type="submit" disabled={pending}>{pending ? "Registrando…" : "Registrar decisão"}</button></div>
  </form>;
}
