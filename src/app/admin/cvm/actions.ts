"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/server";
import { collectCvmDfp } from "@/lib/cvm/client";
import { PostgresOperationalRepository } from "@/lib/database/postgres-operational-repository";
import { pathWithMessage, safeCompanyReturnPath } from "@/lib/navigation/admin-return";
import type { AuditEvent, Proposal } from "@/types/domain";

function value(formData: FormData, key: string): string { return String(formData.get(key) ?? "").trim(); }
function destination(companyId: string, message: string): string { return `/admin/cvm?companyId=${encodeURIComponent(companyId)}&message=${encodeURIComponent(message)}`; }
function resultDestination(formData: FormData, companyId: string, message: string): string {
  const requested = value(formData, "returnTo");
  return requested ? pathWithMessage(safeCompanyReturnPath(requested, companyId), message) : destination(companyId, message);
}

export async function collectCvmDfpAction(formData: FormData): Promise<never> {
  const user = await requireRole("admin");
  const companyId = value(formData, "companyId");
  const cnpj = value(formData, "cnpj").replace(/\D/g, "");
  const cvmCode = value(formData, "cvmCode");
  const corporateName = value(formData, "corporateName");
  const year = Number(value(formData, "year"));
  if (!companyId || cnpj.length !== 14 || !cvmCode || !Number.isInteger(year) || year < 2010 || year > new Date().getFullYear()) {
    redirect(destination(companyId, "Parâmetros inválidos para a coleta CVM."));
  }
  let outcome: string;
  try {
    const repository = new PostgresOperationalRepository();
    const result = await collectCvmDfp(cnpj, year);
    const now = new Date();
    const linkAudit: AuditEvent = {
      id: randomUUID(), action: "company.cvm_linked", entityId: companyId,
      actorId: user.id, occurredAt: now.toISOString(), previousVersion: null, resultingVersion: 1,
      reason: `Vínculo confirmado com ${corporateName} (CVM ${cvmCode}).`, origin: "system",
    };
    await repository.linkCvmCompany(companyId, cnpj, cvmCode, linkAudit);
    const sourceId = `cvm:dfp:${year}:${cnpj}`;
    const proposals: Proposal[] = result.metrics.map((metric) => ({
      id: randomUUID(), companyId, year, variable: metric.variable, value: metric.value,
      unit: "BRL_millions", availability: "available",
      source: {
        id: sourceId, organization: "Comissão de Valores Mobiliários (CVM)",
        title: `DFP ${year} — ${corporateName}`, url: result.sourceUrl,
        referenceDate: `${year}-12-31`, collectedAt: now.toISOString().slice(0, 10),
      },
      status: "under_review", createdBy: user.id, createdAt: now.toISOString(), version: 1,
      notes: `${metric.statement}; conta ${metric.accountCode}; base ${metric.basis}. Valor convertido para R$ milhões.`,
      publishAuthorized: false, externalKey: `cvm:dfp:${year}:${cnpj}:${metric.variable}`,
    }));
    if (proposals.length === 0) throw new Error("Nenhuma conta financeira mapeada foi encontrada.");
    const batchAudit: AuditEvent = {
      id: randomUUID(), action: "cvm.dfp_collected", entityId: sourceId,
      actorId: user.id, occurredAt: now.toISOString(), previousVersion: null, resultingVersion: 1,
      reason: `${proposals.length} métricas CVM processadas para revisão; lote idempotente.`, origin: "system",
    };
    const inserted = await repository.submitProposals(proposals, batchAudit);
    revalidatePath("/admin"); revalidatePath("/admin/empresas"); revalidatePath("/admin/cvm"); revalidatePath("/admin/revisoes"); revalidatePath("/admin/auditoria"); revalidatePath("/admin/banco");
    revalidatePath(safeCompanyReturnPath(value(formData, "returnTo"), companyId));
    outcome = inserted === 0
      ? `DFP ${year} já está protegida por uma decisão posterior; nenhuma proposta foi alterada.`
      : `${inserted} propostas da DFP ${year} criadas ou atualizadas na revisão.`;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha não identificada.";
    outcome = `Coleta não concluída: ${message}`;
  }
  redirect(resultDestination(formData, companyId, outcome));
}
