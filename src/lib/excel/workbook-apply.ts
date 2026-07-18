import { createHash } from "node:crypto";
import type ExcelJS from "exceljs";
import type { Company } from "@/types/domain";
import type { WorkbookSyncApplication, WorkbookSyncBatch, WorkbookSyncItem, WorkbookSyncResolution } from "./sync-contracts";
import { extractCells, loadWorkbook, metadataSheet, workbookMappingVersion } from "./workbook-mapping";

const metadataHeaders = [
  "batch_id",
  "aplicado_em",
  "sha256_origem",
  "source_workbook_version",
  "result_workbook_version",
  "data_version",
  "mapping_version",
  "propostas_sincronizadas",
  "conflitos_mantidos_excel",
  "alteracoes_excel_importadas",
] as const;

function writeMetadata(
  workbook: ExcelJS.Workbook,
  batch: WorkbookSyncBatch,
  appliedAt: string,
  appliedCount: number,
  keptCount: number,
  excelChangeCount: number,
): void {
  let sheet = workbook.getWorksheet(metadataSheet);
  if (!sheet) {
    sheet = workbook.addWorksheet(metadataSheet, { state: "veryHidden" });
    sheet.addRow([...metadataHeaders]);
    sheet.getRow(1).font = { bold: true };
  } else {
    const actual = metadataHeaders.map((_, index) => String(sheet!.getCell(1, index + 1).value ?? ""));
    if (actual.some((value, index) => value !== metadataHeaders[index])) {
      throw new Error(`A aba técnica ${metadataSheet} existe com contrato incompatível.`);
    }
  }
  const dataVersion = Number(batch.resultWorkbookVersion.match(/d(\d+)$/)?.[1] ?? 0);
  sheet.addRow([
    batch.id,
    appliedAt,
    batch.sourceSha256,
    batch.sourceWorkbookVersion,
    batch.resultWorkbookVersion,
    dataVersion,
    workbookMappingVersion,
    appliedCount,
    keptCount,
    excelChangeCount,
  ]);
  sheet.state = "veryHidden";
}

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
    }
    appliedProposalIds.push(item.proposalId);
  }

  writeMetadata(
    workbook,
    input.batch,
    input.appliedAt,
    appliedProposalIds.length,
    keptExcelProposalIds.length,
    excelChangeItems.length + keptExcelProposalIds.length,
  );
  workbook.calcProperties.fullCalcOnLoad = true;
  const resultCells = extractCells(workbook, input.companies);
  const output = Buffer.from(await workbook.xlsx.writeBuffer());
  const resultSha256 = createHash("sha256").update(output).digest("hex");
  const dataVersion = Number(input.batch.resultWorkbookVersion.match(/d(\d+)$/)?.[1] ?? 0);

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
