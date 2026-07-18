import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/server";
import { PostgresOperationalRepository } from "@/lib/database/postgres-operational-repository";
import { PostgresWorkbookSyncRepository } from "@/lib/database/postgres-workbook-sync-repository";
import { prepareWorkbookSync, workbookId, workbookMaxBytes } from "@/lib/excel/workbook-mapping";
import type { AuditEvent } from "@/types/domain";

export const dynamic = "force-dynamic";

function errorResponse(error: unknown, status = 400): Response {
  const message = error instanceof Error ? error.message : "Não foi possível analisar a planilha.";
  return Response.json({ error: message }, { status });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const user = await requireRole("admin");
    const formData = await request.formData();
    const file = formData.get("workbook");
    if (!(file instanceof File) || file.size === 0 || file.size > workbookMaxBytes) {
      return errorResponse(new Error("Selecione um XLSX de até 4 MB."));
    }
    const source = Buffer.from(await file.arrayBuffer());
    const syncRepository = new PostgresWorkbookSyncRepository();
    const operationalRepository = new PostgresOperationalRepository();
    const [companies, proposals, baseline] = await Promise.all([
      operationalRepository.listCompanies(),
      operationalRepository.listProposals(),
      syncRepository.getLatestResultSnapshot(workbookId),
    ]);
    const approved = proposals.filter((proposal) => proposal.status === "approved");
    const requestedAt = new Date().toISOString();
    const preview = await prepareWorkbookSync({
      source,
      originalName: file.name,
      actorId: user.id,
      requestedAt,
      companies,
      approvedProposals: approved,
      baseline,
    });
    const audit: AuditEvent = {
      id: randomUUID(),
      action: "excel.sync.previewed",
      entityId: preview.batch.id,
      actorId: user.id,
      occurredAt: requestedAt,
      previousVersion: null,
      resultingVersion: 1,
      reason: `${preview.batch.approvedCount} proposta(s) aprovada(s), ${preview.batch.conflictCount} conflito(s), ${preview.batch.excelChangeCount} alteração(ões) originada(s) no Excel.`,
      origin: "excel",
    };
    const stored = await syncRepository.createPreview(preview, audit);
    revalidatePath("/admin/sincronizacao");
    revalidatePath("/admin/auditoria");
    return Response.json({ ...stored.preview, reused: stored.reused });
  } catch (error) {
    return errorResponse(error);
  }
}
