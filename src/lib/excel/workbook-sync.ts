import ExcelJS from "exceljs";
import type { Company, Proposal } from "@/types/domain";

const stagingSheetName = "SECC_App_Staging";
const metadataSheetName = "SECC_App_Metadata";

const headers = [
  "lote_id", "proposta_id", "empresa_id", "empresa", "ano", "variavel", "valor",
  "unidade", "disponibilidade", "fonte_organizacao", "fonte_titulo", "fonte_url",
  "data_referencia", "data_coleta", "gerado_em",
] as const;

export interface WorkbookSyncInput {
  source: Buffer;
  proposals: Proposal[];
  companies: Company[];
  batchId: string;
  generatedAt: string;
  sourceSha256: string;
}

export interface WorkbookSyncOutput {
  workbook: Buffer;
  insertedProposalIds: string[];
  skippedProposalIds: string[];
  sheetName: string;
}

function assertStagingLayout(sheet: ExcelJS.Worksheet): void {
  const actual = headers.map((_, index) => String(sheet.getCell(1, index + 1).value ?? ""));
  if (actual.some((value, index) => value !== headers[index])) {
    throw new Error(`A aba ${stagingSheetName} existe, mas o cabeçalho não corresponde ao contrato SECC.`);
  }
}

function prepareStagingSheet(workbook: ExcelJS.Workbook): ExcelJS.Worksheet {
  const existing = workbook.getWorksheet(stagingSheetName);
  if (existing) {
    assertStagingLayout(existing);
    return existing;
  }

  const sheet = workbook.addWorksheet(stagingSheetName, { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.addRow([...headers]);
  sheet.autoFilter = { from: "A1", to: "O1" };
  sheet.getRow(1).height = 24;
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF153F35" } };
  sheet.getRow(1).alignment = { vertical: "middle" };
  const widths = [20, 38, 38, 28, 10, 24, 16, 16, 18, 24, 32, 42, 16, 16, 22];
  widths.forEach((width, index) => { sheet.getColumn(index + 1).width = width; });
  sheet.getColumn(5).numFmt = "0";
  sheet.getColumn(7).numFmt = "#,##0.00";
  sheet.getColumn(13).numFmt = "yyyy-mm-dd";
  sheet.getColumn(14).numFmt = "yyyy-mm-dd";
  sheet.getColumn(15).numFmt = "yyyy-mm-dd hh:mm";
  return sheet;
}

function writeMetadata(
  workbook: ExcelJS.Workbook,
  input: Pick<WorkbookSyncInput, "batchId" | "generatedAt" | "sourceSha256">,
  inserted: number,
  skipped: number,
): void {
  let sheet = workbook.getWorksheet(metadataSheetName);
  if (!sheet) {
    sheet = workbook.addWorksheet(metadataSheetName);
    sheet.state = "veryHidden";
    sheet.addRow(["lote_id", "gerado_em", "sha256_origem", "incluidas", "ignoradas"]);
  }
  sheet.addRow([input.batchId, input.generatedAt, input.sourceSha256, inserted, skipped]);
}

export async function buildSynchronizedWorkbook(input: WorkbookSyncInput): Promise<WorkbookSyncOutput> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(input.source as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  const sheet = prepareStagingSheet(workbook);
  const existingIds = new Set<string>();
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const value = sheet.getCell(rowNumber, 2).value;
    if (typeof value === "string" && value) existingIds.add(value);
  }

  const companyNames = new Map(input.companies.map((company) => [company.id, company.name]));
  const insertedProposalIds: string[] = [];
  const skippedProposalIds: string[] = [];
  for (const proposal of input.proposals) {
    if (existingIds.has(proposal.id)) {
      skippedProposalIds.push(proposal.id);
      continue;
    }
    sheet.addRow([
      input.batchId, proposal.id, proposal.companyId,
      companyNames.get(proposal.companyId) ?? "Empresa não localizada",
      proposal.year, proposal.variable, proposal.value, proposal.unit, proposal.availability,
      proposal.source.organization, proposal.source.title, proposal.source.url,
      proposal.source.referenceDate, proposal.source.collectedAt, input.generatedAt,
    ]);
    insertedProposalIds.push(proposal.id);
    existingIds.add(proposal.id);
  }

  writeMetadata(workbook, input, insertedProposalIds.length, skippedProposalIds.length);
  const output = await workbook.xlsx.writeBuffer();
  return {
    workbook: Buffer.from(output), insertedProposalIds, skippedProposalIds, sheetName: stagingSheetName,
  };
}
