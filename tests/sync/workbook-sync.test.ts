import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { demoCompanies, demoProposals } from "@/features/demo/data";
import { buildSynchronizedWorkbook } from "@/lib/excel/workbook-sync";

async function sourceWorkbook(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Painel");
  sheet.getCell("A1").value = 10;
  sheet.getCell("A2").value = 20;
  sheet.getCell("A3").value = { formula: "SUM(A1:A2)", result: 30 };
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

describe("sincronização XLSX por arquivo", () => {
  it("preserva a planilha e adiciona propostas aprovadas em staging", async () => {
    const approved = demoProposals.filter((proposal) => proposal.status === "approved");
    const first = await buildSynchronizedWorkbook({
      source: await sourceWorkbook(), proposals: approved, companies: demoCompanies,
      batchId: "batch-1", generatedAt: "2026-07-16T12:00:00.000Z", sourceSha256: "hash-1",
    });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(first.workbook as unknown as Parameters<typeof workbook.xlsx.load>[0]);
    expect(workbook.getWorksheet("Painel")?.getCell("A3").value).toMatchObject({ formula: "SUM(A1:A2)" });
    expect(workbook.getWorksheet("SECC_App_Staging")?.getCell("B2").value).toBe(approved[0]?.id);
    expect(first.insertedProposalIds).toEqual(approved.map((proposal) => proposal.id));

    const second = await buildSynchronizedWorkbook({
      source: first.workbook, proposals: approved, companies: demoCompanies,
      batchId: "batch-2", generatedAt: "2026-07-16T13:00:00.000Z", sourceSha256: "hash-2",
    });
    expect(second.insertedProposalIds).toHaveLength(0);
    expect(second.skippedProposalIds).toEqual(approved.map((proposal) => proposal.id));
  });
});
