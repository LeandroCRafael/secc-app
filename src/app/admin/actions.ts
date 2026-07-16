"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/server";
import { PostgresOperationalRepository } from "@/lib/database/postgres-operational-repository";
import { readMasterWorkbook } from "@/lib/workbook/master-file";
import { parseMasterWorkbook } from "@/lib/workbook/master-workbook";
import type { AuditEvent } from "@/types/domain";

export type WorkbookRefreshState = { status: "idle" | "success" | "error"; message: string };

export async function refreshWorkbookDiagnosticAction(
  _previous: WorkbookRefreshState,
): Promise<WorkbookRefreshState> {
  void _previous;
  const user = await requireRole("admin");
  try {
    const master = await readMasterWorkbook();
    const now = new Date().toISOString();
    const snapshot = await parseMasterWorkbook(master.buffer, master.name, now);
    const audit: AuditEvent = {
      id: randomUUID(), action: "workbook.coverage_refreshed", entityId: snapshot.hash,
      actorId: user.id, occurredAt: now, previousVersion: null, resultingVersion: 1,
      reason: `Diagnóstico recalculado a partir de ${master.name}; ${snapshot.companies.length} empresas.`,
      origin: "excel",
    };
    await new PostgresOperationalRepository().synchronizeWorkbook(snapshot, audit);
    revalidatePath("/admin");
    revalidatePath("/admin/cvm");
    revalidatePath("/admin/banco");
    return { status: "success", message: `${snapshot.companies.length} empresas atualizadas. A planilha permaneceu inalterada.` };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Erro não identificado.";
    return { status: "error", message: `Não foi possível atualizar o diagnóstico: ${detail}` };
  }
}
