"use client";

import { useActionState } from "react";
import { generateUpdatedWorkbookAction, initialExcelSyncActionState } from "@/app/admin/sincronizacao/actions";

export function WorkbookSyncForm({ approvedCount }: { approvedCount: number }) {
  const [state, action, pending] = useActionState(generateUpdatedWorkbookAction, initialExcelSyncActionState);
  return <form className="card form-grid" action={action}>
    <label className="full">Versão atual da planilha
      <input name="workbook" type="file" accept=".xlsx" required />
    </label>
    <p className="full">O arquivo original será salvo em backup. O sistema adicionará somente propostas aprovadas à aba <span className="mono">SECC_App_Staging</span>, sem substituir o arquivo enviado.</p>
    {approvedCount === 0 && <p className="notice full">Aprove pelo menos uma proposta antes de gerar o lote.</p>}
    {state.status !== "idle" && <div className={state.status === "error" ? "error full" : "notice full"} role={state.status === "error" ? "alert" : "status"}>
      <strong>{state.status === "success" ? "Lote preparado." : "Geração bloqueada."}</strong> {state.message}
      {state.status === "success" && <p>Incluídas: {state.inserted ?? 0} · Já existentes: {state.skipped ?? 0}<br />Lote: <span className="mono">{state.batchId}</span></p>}
      {state.outputFile && <a className="button" href={`/admin/sincronizacao/arquivo/${encodeURIComponent(state.outputFile)}`}>Baixar planilha atualizada</a>}
    </div>}
    <div className="full"><button className="button" type="submit" disabled={pending || approvedCount === 0}>{pending ? "Validando e gerando…" : `Gerar planilha com ${approvedCount} aprovada(s)`}</button></div>
  </form>;
}
