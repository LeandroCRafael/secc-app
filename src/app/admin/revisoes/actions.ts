"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/server";
import { PostgresOperationalRepository } from "@/lib/database/postgres-operational-repository";
import { reviewDecisionInputSchema } from "@/lib/validation/review";
import type { AuditEvent, ReviewDecision } from "@/types/domain";

export interface ReviewActionState {
  status: "idle" | "success" | "error";
  message: string;
}

function field(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

export async function reviewProposalAction(
  _previousState: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  const user = await requireRole("admin");
  const parsed = reviewDecisionInputSchema.safeParse({
    proposalId: field(formData, "proposalId"),
    expectedVersion: Number(field(formData, "expectedVersion")),
    decision: field(formData, "decision"),
    justification: field(formData, "justification"),
  });

  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Revise a decisão." };
  }

  const now = new Date().toISOString();
  const decision: ReviewDecision = {
    ...parsed.data,
    decidedBy: user.id,
    decidedAt: now,
  };
  const audit: AuditEvent = {
    id: randomUUID(),
    action: `proposal.${parsed.data.decision}`,
    entityId: parsed.data.proposalId,
    actorId: user.id,
    occurredAt: now,
    previousVersion: parsed.data.expectedVersion,
    resultingVersion: parsed.data.expectedVersion + 1,
    reason: parsed.data.justification,
    origin: "manual",
  };

  try {
    await new PostgresOperationalRepository().decideProposal(decision, audit);
    revalidatePath("/admin/revisoes");
    revalidatePath("/admin/empresas");
    revalidatePath("/admin/empresas/[id]", "page");
    revalidatePath("/admin/auditoria");
    revalidatePath("/admin/banco");
    return { status: "success", message: "Decisão gravada com nova versão e evento de auditoria." };
  } catch (error) {
    if (error instanceof Error && error.message.includes("versão")) {
      return { status: "error", message: "A proposta mudou desde a abertura da página. Atualize antes de decidir." };
    }
    if (error instanceof Error && error.message.includes("não encontrada")) {
      return { status: "error", message: error.message };
    }
    return { status: "error", message: "Não foi possível registrar a decisão no banco operacional." };
  }
}
