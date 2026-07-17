import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { parseStructuredImport } from "@/lib/parsers/structured-import";

const header = "ano;variavel;valor;unidade;disponibilidade;organizacao_fonte;titulo_fonte;url_fonte;data_referencia;observacao";

function input(bytes: Buffer, kind: "csv" | "xlsx" = "csv") {
  return {
    bytes,
    kind,
    companyId: "workbook:1",
    actorId: "admin-test",
    originalName: kind === "csv" ? "dados.csv" : "dados.xlsx",
    createdAt: "2026-07-17T12:00:00.000Z",
  } as const;
}

describe("importação estruturada", () => {
  it("normaliza CSV brasileiro em proposta revisável", async () => {
    const csv = `${header}\n2024;Receita Líquida;1.234,50;BRL_millions;disponível;CVM;DFP 2024;https://dados.cvm.gov.br;31/12/2024;Consolidado`;
    const result = await parseStructuredImport(input(Buffer.from(csv)));
    expect(result.validCount).toBe(1);
    expect(result.errorCount).toBe(0);
    expect(result.rows[0]?.proposal).toMatchObject({
      companyId: "workbook:1", year: 2024, variable: "Receita Líquida", value: 1234.5,
      unit: "BRL_millions", status: "under_review", publishAuthorized: false,
    });
  });

  it("mantém linha inválida na prévia sem criar proposta", async () => {
    const csv = `${header}\n2024;Receita;;BRL_millions;available;CVM;DFP;file:///privado;2024-12-31;`;
    const result = await parseStructuredImport(input(Buffer.from(csv)));
    expect(result.validCount).toBe(0);
    expect(result.errorCount).toBe(1);
    expect(result.rows[0]?.proposal).toBeNull();
    expect(result.rows[0]?.errors.length).toBeGreaterThan(0);
  });

  it("gera a mesma chave externa no reenvio do mesmo arquivo", async () => {
    const csv = `${header}\n2023;EBIT;-10,25;BRL_millions;available;Companhia;Relatório;https://example.com/relatorio;2023-12-31;`;
    const first = await parseStructuredImport(input(Buffer.from(csv)));
    const second = await parseStructuredImport(input(Buffer.from(csv)));
    expect(first.rows[0]?.proposal?.externalKey).toBe(second.rows[0]?.proposal?.externalKey);
  });

  it("lê a primeira aba visível de um XLSX", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Dados");
    sheet.addRow(header.split(";"));
    sheet.addRow([2022, "Margem EBIT", 12.5, "percent", "available", "Companhia", "Release", "https://example.com/release", new Date("2022-12-31T00:00:00Z"), ""]);
    const bytes = Buffer.from(await workbook.xlsx.writeBuffer());
    const result = await parseStructuredImport(input(bytes, "xlsx"));
    expect(result.rows[0]?.proposal).toMatchObject({ year: 2022, value: 12.5, unit: "percent" });
  });

  it("rejeita arquivo sem o contrato mínimo", async () => {
    await expect(parseStructuredImport(input(Buffer.from("ano;valor\n2024;10")))).rejects.toThrow("Colunas obrigatórias ausentes");
  });
});
