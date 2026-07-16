"use server";

import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { requireRole } from "@/lib/auth/server";
import { PostgresOperationalRepository } from "@/lib/database/postgres-operational-repository";
import { localExcelPaths } from "@/lib/excel/local-files";
import { buildSynchronizedWorkbook } from "@/lib/excel/workbook-sync";

const maxWorkbookBytes = 25 * 1024 * 1024;

export interface ExcelSyncActionState {
  status: "idle" | "success" | "error";
  message: string;
  outputFile?: string;
  batchId?: string;
  inserted?: number;
  skipped?: number;
}

export const initialExcelSyncActionState: ExcelSyncActionState = { status: "idle", message: "" };

function safeTimestamp(date: Date): string {
  return date.toISOString().replace(/[:.]/g, "-");
}

export async function generateUpdatedWorkbookAction(
  _previousState: ExcelSyncActionState,
  formData: FormData,
): Promise<ExcelSyncActionState> {
  await requireRole("admin");
  const file = formData.get("workbook");
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "Selecione a versão atual da planilha em formato XLSX." };
  }
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return { status: "error", message: "O intercâmbio local aceita somente arquivos .xlsx sem macros." };
  }
  if (file.size > maxWorkbookBytes) {
    return { status: "error", message: "A planilha excede o limite local de 25 MB." };
  }

  const source = Buffer.from(await file.arrayBuffer());
  if (source[0] !== 0x50 || source[1] !== 0x4b) {
    return { status: "error", message: "A assinatura do arquivo não corresponde a um XLSX válido." };
  }

  try {
    const repository = new PostgresOperationalRepository();
    const [proposals, companies] = await Promise.all([repository.listProposals(), repository.listCompanies()]);
    const approved = proposals.filter((proposal) => proposal.status === "approved");
    if (approved.length === 0) {
      return { status: "error", message: "Não há propostas aprovadas disponíveis para gerar o lote." };
    }

    const now = new Date();
    const generatedAt = now.toISOString();
    const stamp = safeTimestamp(now);
    const batchId = randomUUID();
    const sourceSha256 = createHash("sha256").update(source).digest("hex");
    const result = await buildSynchronizedWorkbook({
      source, proposals: approved, companies, batchId, generatedAt, sourceSha256,
    });

    await Promise.all([
      mkdir(localExcelPaths.backups, { recursive: true }),
      mkdir(localExcelPaths.outputs, { recursive: true }),
    ]);
    const backupName = `backup-${stamp}-${sourceSha256.slice(0, 10)}.xlsx`;
    const outputFile = `secc-atualizado-${stamp}-${batchId.slice(0, 8)}.xlsx`;
    await writeFile(path.join(/* turbopackIgnore: true */ localExcelPaths.backups, backupName), source, { flag: "wx" });
    await writeFile(path.join(/* turbopackIgnore: true */ localExcelPaths.outputs, outputFile), result.workbook, { flag: "wx" });

    return {
      status: "success",
      message: result.insertedProposalIds.length > 0
        ? `Arquivo gerado com backup da origem e aba ${result.sheetName}. Revise o resultado antes de substituir a planilha oficial.`
        : "Nenhuma linha nova foi incluída: todas as propostas aprovadas já constavam da aba de staging.",
      outputFile, batchId,
      inserted: result.insertedProposalIds.length,
      skipped: result.skippedProposalIds.length,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha desconhecida.";
    return { status: "error", message: `Não foi possível gerar a planilha: ${message}` };
  }
}
