"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/server";
import { PostgresImportRepository } from "@/lib/database/postgres-import-repository";
import { PostgresOperationalRepository } from "@/lib/database/postgres-operational-repository";
import { companyWorkspacePath } from "@/lib/navigation/admin-return";
import { parseStructuredImport } from "@/lib/parsers/structured-import";
import { validateUpload } from "@/lib/parsers/upload-policy";
import type { StructuredImportBatch } from "@/lib/imports/contracts";
import type { AuditEvent } from "@/types/domain";

function value(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function destination(input: { companyId?: string; batchId?: string; message?: string }): string {
  const params = new URLSearchParams();
  if (input.companyId) params.set("companyId", input.companyId);
  if (input.batchId) params.set("batchId", input.batchId);
  if (input.message) params.set("message", input.message);
  const query = params.toString();
  return `/admin/importacoes${query ? `?${query}` : ""}`;
}

export async function previewStructuredImportAction(formData: FormData): Promise<never> {
  const user = await requireRole("admin");
  const companyId = value(formData, "companyId");
  const file = formData.get("file");
  if (!companyId || !(file instanceof File) || file.size === 0) {
    redirect(destination({ companyId, message: "Selecione a empresa e um arquivo CSV ou XLSX." }));
  }

  let target = destination({ companyId });
  try {
    const company = (await new PostgresOperationalRepository().listCompanies()).find((item) => item.id === companyId);
    if (!company) throw new Error("A empresa selecionada não existe mais.");
    const bytes = Buffer.from(await file.arrayBuffer());
    const validation = validateUpload({ name: file.name, type: file.type, size: file.size, bytes });
    if (!validation.ok) throw new Error(validation.reason);
    const now = new Date().toISOString();
    const preview = await parseStructuredImport({
      bytes,
      kind: validation.kind,
      companyId,
      actorId: user.id,
      originalName: file.name,
      createdAt: now,
    });
    const batchId = randomUUID();
    const batch: StructuredImportBatch = {
      id: batchId,
      companyId,
      originalName: file.name,
      mime: file.type,
      sizeBytes: file.size,
      sha256: preview.sha256,
      rowCount: preview.rows.length,
      validCount: preview.validCount,
      errorCount: preview.errorCount,
      status: "previewed",
      createdBy: user.id,
      createdAt: now,
      importedAt: null,
    };
    const audit: AuditEvent = {
      id: randomUUID(),
      action: "import.previewed",
      entityId: batchId,
      actorId: user.id,
      occurredAt: now,
      previousVersion: null,
      resultingVersion: 1,
      reason: `${preview.rows.length} linha(s) analisadas; ${preview.validCount} válidas e ${preview.errorCount} com erro.`,
      origin: "upload",
    };
    await new PostgresImportRepository().createPreview(batch, preview.rows, audit);
    revalidatePath("/admin/importacoes");
    revalidatePath("/admin/auditoria");
    target = destination({ companyId, batchId, message: "Prévia criada. Confira as linhas antes de enviar à revisão." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível validar o arquivo.";
    target = destination({ companyId, message });
  }
  redirect(target);
}

export async function confirmStructuredImportAction(formData: FormData): Promise<never> {
  const user = await requireRole("admin");
  const batchId = value(formData, "batchId");
  if (!batchId) redirect(destination({ message: "Lote de importação inválido." }));
  const repository = new PostgresImportRepository();
  const preview = await repository.getBatch(batchId);
  if (!preview) redirect(destination({ message: "Lote de importação não encontrado." }));
  const now = new Date().toISOString();
  const audit: AuditEvent = {
    id: randomUUID(),
    action: "import.submitted",
    entityId: batchId,
    actorId: user.id,
    occurredAt: now,
    previousVersion: 1,
    resultingVersion: 2,
    reason: `${preview.batch.validCount} linha(s) válidas confirmadas para revisão.`,
    origin: "upload",
  };
  let message: string;
  try {
    const result = await repository.confirmBatch(batchId, now, audit);
    message = result.alreadyImported
      ? "Este lote já havia sido confirmado; nenhuma proposta foi duplicada."
      : `${result.inserted} proposta(s) enviadas à revisão; ${result.skipped} duplicata(s) ignoradas.`;
    revalidatePath("/admin/importacoes");
    revalidatePath("/admin/revisoes");
    revalidatePath("/admin/empresas");
    revalidatePath(companyWorkspacePath(result.companyId));
    revalidatePath("/admin/auditoria");
    revalidatePath("/admin/banco");
  } catch (error) {
    message = error instanceof Error ? error.message : "Não foi possível confirmar a importação.";
  }
  redirect(destination({ companyId: preview.batch.companyId, batchId, message }));
}
