"use client";

import { useActionState } from "react";
import { refreshWorkbookDiagnosticAction, type WorkbookRefreshState } from "@/app/admin/actions";

const initialState: WorkbookRefreshState = { status: "idle", message: "" };

export function WorkbookRefreshForm() {
  const [state, action, pending] = useActionState(refreshWorkbookDiagnosticAction, initialState);
  return (
    <form action={action} className="actions">
      <button className="button" disabled={pending} type="submit">
        {pending ? "Lendo planilha…" : "Atualizar diagnóstico da planilha"}
      </button>
      {state.message && <p className={state.status === "error" ? "error" : "form-message"} role="status">{state.message}</p>}
    </form>
  );
}
