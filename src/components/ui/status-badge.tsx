import type { AvailabilityState, WorkflowStatus } from "@/types/domain";

const labels: Record<AvailabilityState | WorkflowStatus, string> = {
  available: "Confirmado", not_researched: "Não pesquisado", unavailable: "N/D",
  not_applicable: "Não aplicável", future_period: "Período futuro", withheld: "Retido",
  under_review: "Em revisão", conflicted: "Em conflito", rejected: "Rejeitado",
  draft: "Rascunho", submitted: "Enviado", approved: "Aprovado",
  synchronized: "Sincronizado", published: "Publicado"
};

export function StatusBadge({ status }: { status: AvailabilityState | WorkflowStatus }) {
  return <span className={`status ${status}`}>{labels[status]}</span>;
}
