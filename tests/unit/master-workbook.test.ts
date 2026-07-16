import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { parseMasterWorkbook } from "@/lib/workbook/master-workbook";

async function workbookBuffer(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const companies = workbook.addWorksheet("01. Cadastro empresas");
  companies.getRow(4).values = ["#", "Tier", "Tipo", "Empresa", "Código", "Setor", "Ano RJ", "Janela", "Site", "Status", "%"];
  companies.getRow(5).values = [1, "Tier 1", "Listada", "Empresa Árvore S.A.", "ARVR3", "Indústria", 2020, "2018 a 2021", "", "Coletado", 0.5];
  companies.getRow(6).values = [2, "Tier 2", "Fechada", "Empresa Vazia", "", "Serviços", 2019, "2019 a 2020", "", "Pendente", 0];
  const financial = workbook.addWorksheet("02. Dados Financeiros");
  financial.getRow(6).values = ["Empresa Árvore S.A.", 2020, "T0", 100, 60, 40, "N/D"];
  const qualitative = workbook.addWorksheet("03. Dados Qualitativos");
  qualitative.getRow(6).values = ["Empresa Árvore S.A.", 2020, "Sim", "Não"];
  const market = workbook.addWorksheet("04. Mercado (listadas)");
  market.getRow(6).values = ["Empresa Árvore S.A.", 2020, "T0", 15, 2];
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

describe("diagnóstico da planilha mestre", () => {
  it("lê cadastro, janela e cobertura sem copiar a planilha para o domínio público", async () => {
    const snapshot = await parseMasterWorkbook(await workbookBuffer(), "mestre.xlsx", "2026-07-16T12:00:00.000Z");
    expect(snapshot.companies).toHaveLength(2);
    const first = snapshot.companies[0]!;
    expect(first.company).toMatchObject({ id: "workbook:1", name: "Empresa Árvore S.A.", tier: "tier_1", collectionStartYear: 2018, collectionEndYear: 2021 });
    expect(first.coverage).toMatchObject({ financialFilled: 3, financialExpected: 96, qualitativeFilled: 2, qualitativeExpected: 32, marketFilled: 2, marketExpected: 16, researchedYears: 1, lastDataYear: 2020 });
    expect(snapshot.companies[1]!.coverage.financialFilled).toBe(0);
    expect(snapshot.hash).toMatch(/^[a-f0-9]{64}$/);
  });
});
