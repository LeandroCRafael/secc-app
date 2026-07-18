import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { applyWorkbookSync } from "@/lib/excel/workbook-apply";
import { prepareWorkbookSync, workbookMappingDefinitions } from "@/lib/excel/workbook-mapping";
import type { WorkbookSnapshot } from "@/lib/excel/sync-contracts";
import type { Company, Proposal } from "@/types/domain";

const company: Company = {
  id: "company-teste",
  slug: "empresa-teste",
  name: "Empresa Teste",
  tier: "tier_1",
  sector: "Teste",
  eventType: "judicial_recovery",
  eventYear: 2024,
  publicationStatus: "private",
};

function proposal(overrides: Partial<Proposal> = {}): Proposal {
  return {
    id: "proposal-receita-2024",
    companyId: company.id,
    year: 2024,
    variable: "Receita Líquida",
    value: 125.5,
    unit: "BRL_millions",
    availability: "available",
    status: "approved",
    createdBy: "curator-test",
    createdAt: "2026-07-17T10:00:00.000Z",
    version: 2,
    publishAuthorized: false,
    source: {
      id: "source-test",
      organization: "Fonte teste",
      title: "Documento teste",
      url: "https://example.com/test",
      referenceDate: "2024-12-31",
      collectedAt: "2026-07-17",
    },
    ...overrides,
  };
}

async function sourceWorkbook(receita: ExcelJS.CellValue = null): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  for (const sheetName of [...new Set(workbookMappingDefinitions.map((item) => item.sheetName))]) {
    const sheet = workbook.addWorksheet(sheetName);
    const definitions = workbookMappingDefinitions.filter((item) => item.sheetName === sheetName);
    for (const item of definitions) sheet.getCell(item.headerRow, item.column).value = item.header;
    const first = definitions[0]!;
    sheet.getCell(first.dataStartRow, first.companyColumn).value = company.name;
    sheet.getCell(first.dataStartRow, first.yearColumn).value = 2024;
  }
  workbook.getWorksheet("02. Dados Financeiros")!.getCell("D6").value = receita;
  workbook.getWorksheet("02. Dados Financeiros")!.getCell("AB6").value = { formula: "SUM(1,2)", result: 3 };
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

async function preview(source: Buffer, approved: Proposal[], baseline: WorkbookSnapshot | null = null) {
  return prepareWorkbookSync({
    source,
    originalName: "SECC_mestre.xlsx",
    actorId: "admin-test",
    requestedAt: "2026-07-17T12:00:00.000Z",
    companies: [company],
    approvedProposals: approved,
    baseline,
  });
}

describe("sincronização controlada do XLSX mestre", () => {
  it("mapeia proposta aprovada, escreve na célula real e preserva fórmulas", async () => {
    const source = await sourceWorkbook();
    const prepared = await preview(source, [proposal()]);
    expect(prepared.batch.status).toBe("prepared");
    expect(prepared.batch.readyCount).toBe(1);
    expect(prepared.items[0]).toMatchObject({ sheetName: "02. Dados Financeiros", cellAddress: "D6", status: "ready" });

    const applied = await applyWorkbookSync({
      source,
      batch: prepared.batch,
      items: prepared.items,
      resolutions: {},
      companies: [company],
      actorId: "admin-test",
      appliedAt: "2026-07-17T12:05:00.000Z",
    });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(applied.workbook as unknown as Parameters<typeof workbook.xlsx.load>[0]);
    expect(workbook.getWorksheet("02. Dados Financeiros")?.getCell("D6").value).toBe(125.5);
    expect(workbook.getWorksheet("02. Dados Financeiros")?.getCell("AB6").value).toMatchObject({ formula: "SUM(1,2)" });
    expect(workbook.getWorksheet("SECC_App_Sync")?.state).toBe("veryHidden");
    expect(applied.appliedProposalIds).toEqual(["proposal-receita-2024"]);
  });

  it("exige decisão quando Excel e app divergem e respeita manter Excel", async () => {
    const source = await sourceWorkbook(99);
    const prepared = await preview(source, [proposal()]);
    expect(prepared.batch.conflictCount).toBe(1);
    await expect(applyWorkbookSync({
      source,
      batch: prepared.batch,
      items: prepared.items,
      resolutions: {},
      companies: [company],
      actorId: "admin-test",
      appliedAt: "2026-07-17T12:05:00.000Z",
    })).rejects.toThrow("Resolva o conflito");

    const kept = await applyWorkbookSync({
      source,
      batch: prepared.batch,
      items: prepared.items,
      resolutions: { "proposal-receita-2024": "keep_excel" },
      companies: [company],
      actorId: "admin-test",
      appliedAt: "2026-07-17T12:05:00.000Z",
    });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(kept.workbook as unknown as Parameters<typeof workbook.xlsx.load>[0]);
    expect(workbook.getWorksheet("02. Dados Financeiros")?.getCell("D6").value).toBe(99);
    expect(kept.keptExcelProposalIds).toEqual(["proposal-receita-2024"]);
  });

  it("detecta alteração feita no Excel desde a versão controlada", async () => {
    const source = await sourceWorkbook();
    const initial = await preview(source, []);
    const applied = await applyWorkbookSync({
      source,
      batch: initial.batch,
      items: initial.items,
      resolutions: {},
      companies: [company],
      actorId: "admin-test",
      appliedAt: "2026-07-17T12:05:00.000Z",
    });
    const changedWorkbook = new ExcelJS.Workbook();
    await changedWorkbook.xlsx.load(applied.workbook as unknown as Parameters<typeof changedWorkbook.xlsx.load>[0]);
    changedWorkbook.getWorksheet("02. Dados Financeiros")!.getCell("D6").value = 77;
    const changed = Buffer.from(await changedWorkbook.xlsx.writeBuffer());

    const next = await preview(changed, [], applied.resultSnapshot);
    expect(next.batch.status).toBe("prepared");
    expect(next.batch.excelChangeCount).toBe(1);
    expect(next.items.find((item) => item.direction === "excel_to_app")).toMatchObject({
      cellAddress: "D6",
      previousValue: null,
      proposedValue: 77,
      status: "ready",
    });
  });

  it("mantém a mesma chave idempotente para a mesma origem e versões de proposta", async () => {
    const source = await sourceWorkbook();
    const first = await preview(source, [proposal()]);
    const second = await preview(source, [proposal()]);
    expect(second.batch.id).toBe(first.batch.id);
    expect(second.batch.idempotencyKey).toBe(first.batch.idempotencyKey);
  });
});
