import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/server";
import { PostgresOperationalRepository } from "@/lib/database/postgres-operational-repository";
import { PostgresWorkbookSyncRepository } from "@/lib/database/postgres-workbook-sync-repository";
import { applyWorkbookSync } from "@/lib/excel/workbook-apply";
import { workbookMaxBytes } from "@/lib/excel/workbook-mapping";
import type { WorkbookSyncResolution } from "@/lib/excel/sync-contracts";

export const dynamic = "force-dynamic";

const resolutionSchema = z.record(z.string(), z.enum(["use_app", "keep_excel"]));

function errorResponse(error: unknown, status = 409): Response {
  const message = error instanceof Error ? error.message : "Não foi possível aplicar o lote.";
  return Response.json({ error: message }, { status });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const user = await requireRole("admin");
    const formData = await request.formData();
    const file = formData.get("workbook");
    const batchId = String(formData.get("batchId") ?? "").trim();
    const backupConfirmed = formData.get("backupConfirmed") === "true";
    if (!backupConfirmed) return errorResponse(new Error("Confirme o download do backup antes de aplicar o lote."), 400);
    if (!(file instanceof File) || file.size === 0 || file.size > workbookMaxBytes || !batchId) {
      return errorResponse(new Error("Arquivo ou lote inválido."), 400);
    }
    const resolutions = resolutionSchema.parse(JSON.parse(String(formData.get("resolutions") ?? "{}"))) as Record<string, WorkbookSyncResolution>;
    const repository = new PostgresWorkbookSyncRepository();
    const preview = await repository.getBatch(batchId);
    if (!preview) return errorResponse(new Error("Lote não encontrado."), 404);
    const source = Buffer.from(await file.arrayBuffer());
    const companies = await new PostgresOperationalRepository().listCompanies();
    const appliedAt = preview.batch.appliedAt ?? new Date().toISOString();
    const application = await applyWorkbookSync({
      source,
      batch: preview.batch,
      items: preview.items,
      resolutions,
      companies,
      actorId: user.id,
      appliedAt,
    });
    const result = await repository.applyBatch({
      batchId,
      application,
      resolutions,
      actorId: user.id,
      appliedAt,
    });
    revalidatePath("/admin/sincronizacao");
    revalidatePath("/admin/revisoes");
    revalidatePath("/admin/auditoria");
    revalidatePath("/admin/banco");
    return new Response(new Uint8Array(application.workbook), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${preview.batch.outputFileName ?? "secc-atualizado.xlsx"}"`,
        "Cache-Control": "private, no-store",
        "X-SECC-Batch-Id": batchId,
        "X-SECC-Result-Sha256": application.resultSha256,
        "X-SECC-Imported-Excel": String(result.importedExcelProposals),
        "X-SECC-Replayed": String(result.alreadyApplied),
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
