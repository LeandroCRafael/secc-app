"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/server";
import { PostgresOperationalRepository } from "@/lib/database/postgres-operational-repository";
import { companyInputSchema } from "@/lib/validation/company";
import { proposalInputSchema } from "@/lib/validation/proposal";
import type { IntakeActionState } from "@/features/intake/action-state";
import type { AuditEvent, Company, Proposal } from "@/types/domain";

function field(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.includes("já existe")) return error.message;
  if (typeof error === "object" && error !== null && "code" in error && error.code === "23503") {
    return "A empresa selecionada não existe mais. Atualize a página e tente novamente.";
  }
  return "Não foi possível gravar no banco local. Revise os campos e tente novamente.";
}

export async function createCompanyAction(
  _previousState: IntakeActionState,
  formData: FormData,
): Promise<IntakeActionState> {
  const user = await requireRole("admin");
  const parsed = companyInputSchema.safeParse({
    slug: field(formData, "slug"),
    name: field(formData, "name"),
    tier: field(formData, "tier"),
    sector: field(formData, "sector"),
    eventType: field(formData, "eventType"),
    eventYear: Number(field(formData, "eventYear")),
  });

  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Revise os campos da empresa." };
  }

  const now = new Date().toISOString();
  const company: Company = {
    id: randomUUID(),
    ...parsed.data,
    publicationStatus: "private",
  };
  const audit: AuditEvent = {
    id: randomUUID(),
    action: "company.created",
    entityId: company.id,
    actorId: user.id,
    occurredAt: now,
    previousVersion: null,
    resultingVersion: 1,
    reason: "Cadastro manual de empresa pelo administrador.",
    origin: "manual",
  };

  try {
    await new PostgresOperationalRepository().createCompany(company, audit);
    revalidatePath("/admin/pesquisa");
    revalidatePath("/admin/banco");
    return { status: "success", message: "Empresa cadastrada como privada e registrada na auditoria." };
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }
}

export async function submitProposalAction(
  _previousState: IntakeActionState,
  formData: FormData,
): Promise<IntakeActionState> {
  const user = await requireRole("admin");
  const availability = field(formData, "availability");
  const unit = field(formData, "unit");
  const rawValue = field(formData, "value");
  const value =
    availability !== "available" || rawValue === ""
      ? null
      : unit === "text"
        ? rawValue
        : Number(rawValue);
  const parsed = proposalInputSchema.safeParse({
    companyId: field(formData, "companyId"),
    year: Number(field(formData, "year")),
    variable: field(formData, "variable"),
    value,
    unit,
    availability,
    sourceOrganization: field(formData, "sourceOrganization"),
    sourceTitle: field(formData, "sourceTitle"),
    sourceUrl: field(formData, "sourceUrl"),
    referenceDate: field(formData, "referenceDate"),
    notes: field(formData, "notes") || undefined,
  });

  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Revise os campos da proposta." };
  }

  const now = new Date();
  const proposalId = randomUUID();
  const proposal: Proposal = {
    id: proposalId,
    companyId: parsed.data.companyId,
    year: parsed.data.year,
    variable: parsed.data.variable,
    value: parsed.data.value,
    unit: parsed.data.unit,
    availability: parsed.data.availability,
    source: {
      id: randomUUID(),
      organization: parsed.data.sourceOrganization,
      title: parsed.data.sourceTitle,
      url: parsed.data.sourceUrl,
      referenceDate: parsed.data.referenceDate,
      collectedAt: now.toISOString().slice(0, 10),
    },
    status: "under_review",
    createdBy: user.id,
    createdAt: now.toISOString(),
    version: 1,
    notes: parsed.data.notes,
    publishAuthorized: false,
  };
  const audit: AuditEvent = {
    id: randomUUID(),
    action: "proposal.submitted",
    entityId: proposalId,
    actorId: user.id,
    occurredAt: now.toISOString(),
    previousVersion: null,
    resultingVersion: 1,
    reason: "Entrada manual enviada para revisão.",
    origin: "manual",
  };

  try {
    await new PostgresOperationalRepository().submitProposal(proposal, audit);
    revalidatePath("/admin/pesquisa");
    revalidatePath("/admin/banco");
    revalidatePath("/admin/revisoes");
    return { status: "success", message: "Proposta gravada, auditada e enviada para revisão." };
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }
}
