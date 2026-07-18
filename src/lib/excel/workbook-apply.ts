import { createHash } from "node:crypto";
import type ExcelJS from "exceljs";
import type { Company } from "@/types/domain";
import type { WorkbookSyncApplication, WorkbookSyncBatch, WorkbookSyncItem, WorkbookSyncResolution } from "./sync-contracts";
import { extractCells, loadWorkbook, workbookMappingVersion } from "./workbook-mapping";
import { patchWorkbookArchive } from "./workbook-archive";

export async function applyWorkbookSync(input: {
  source: Buffer;
  batch: WorkbookSyncBatch;
  items: WorkbookSyncItem[];
  resolutions: Record<string, WorkbookSyncResolution>;
  companies: Company[];
  actorId: string;
  appliedAt: string;
}): Promise<WorkbookSyncApplication> {
  const sourceSha256 = createHash("sha256").update(input.source).digest("hex");
  if (sourceSha256 !== input.batch.sourceSha256) {
    throw new Error("A planilha mudou após a prévia. Refaça a análise antes de aplicar o lote.");
  }
  if (input.batch.status === "blocked") {
    throw new Error(input.batch.failureReason ?? "O lote está bloqueado.");
  }

  const workbook = await loadWorkbook(input.source);
  const appItems = input.items.filter((item) => item.direction === "app_to_excel");
  const excelChangeItems = input.items.filter((item) => item.direction === "excel_to_app" && item.status === "ready");
  const appliedProposalIds: string[] = [];
  const keptExcelProposalIds: string[] = [];
  const updates: Array<{ sheetName: string; cellAddress: string; value: WorkbookSyncItem["proposedValue"] }> = [];

  for (const item of appItems) {
    if (item.status === "unmapped" || !item.proposalId) throw new Error(item.message);
    const resolution = item.resolution ?? (item.status === "conflict" ? input.resolutions[item.proposalId] : null);
    if (item.status === "conflict" && !resolution) {
      throw new Error(`Resolva o conflito da proposta ${item.proposalId} antes de aplicar.`);
    }
    if (resolution === "keep_excel") {
      keptExcelProposalIds.push(item.proposalId);
      continue;
    }
    if (item.status === "ready" || item.status === "conflict" || item.status === "applied") {
      if (!item.sheetName || !item.cellAddress) throw new Error("Item sem célula de destino.");
      const sheet = workbook.getWorksheet(item.sheetName);
      if (!sheet) throw new Error(`A aba ${item.sheetName} não foi localizada na aplicação.`);
      sheet.getCell(item.cellAddress).value = item.proposedValue as ExcelJS.CellValue;
      updates.push({ sheetName: item.sheetName, cellAddress: item.cellAddress, value: item.proposedValue });
    }
    appliedProposalIds.push(item.proposalId);
  }

  const resultCells = extractCells(workbook, input.companies);
  const dataVersion = Number(input.batch.resultWorkbookVersion.match(/d(\d+)$/)?.[1] ?? 0);
  const output = await patchWorkbookArchive({
    source: input.source,
    updates,
    metadata: {
      batchId: input.batch.id,
      appliedAt: input.appliedAt,
      sourceSha256: input.batch.sourceSha256,
      sourceWorkbookVersion: input.batch.sourceWorkbookVersion,
      resultWorkbookVersion: input.batch.resultWorkbookVersion,
      dataVersion,
      mappingVersion: workbookMappingVersion,
      appliedCount: appliedProposalIds.length,
      keptCount: keptExcelProposalIds.length,
      excelChangeCount: excelChangeItems.length + keptExcelProposalIds.length,
    },
  });
  const resultSha256 = createHash("sha256").update(output).digest("hex");

  return {
    workbook: output,
    resultSha256,
    resultSnapshot: {
      id: `snapshot-result-${resultSha256.slice(0, 32)}`,
      workbookId: input.batch.workbookId,
      originalName: input.batch.outputFileName ?? "secc-atualizado.xlsx",
      sizeBytes: output.byteLength,
      sha256: resultSha256,
      workbookVersion: input.batch.resultWorkbookVersion,
      dataVersion,
      mappingVersion: input.batch.mappingVersion,
      kind: "result",
      syncBatchId: input.batch.id,
      createdBy: input.actorId,
      createdAt: input.appliedAt,
      cells: resultCells,
    },
    appliedProposalIds,
    keptExcelProposalIds,
    excelChangeItems,
  };
}
