import { describe, expect, it } from "vitest";
import { companyIdFromRoute, companyWorkspacePath, pathWithMessage, safeCompanyReturnPath } from "@/lib/navigation/admin-return";

describe("retorno seguro da estação por empresa", () => {
  it("codifica o identificador no caminho", () => {
    expect(companyWorkspacePath("workbook:10")).toBe("/admin/empresas/workbook%3A10");
    expect(companyIdFromRoute("workbook%3A10")).toBe("workbook:10");
    expect(companyIdFromRoute("workbook%ZZ10")).toBe("workbook%ZZ10");
  });

  it("aceita apenas o caminho exato da empresa", () => {
    const expected = "/admin/empresas/workbook%3A10";
    expect(safeCompanyReturnPath(expected, "workbook:10")).toBe(expected);
    expect(safeCompanyReturnPath("https://example.com", "workbook:10")).toBe(expected);
    expect(safeCompanyReturnPath("/admin/empresas/outra", "workbook:10")).toBe(expected);
  });

  it("adiciona mensagem sem permitir montagem manual de query", () => {
    expect(pathWithMessage("/admin/empresas/a", "Coleta concluída.")).toBe("/admin/empresas/a?message=Coleta%20conclu%C3%ADda.");
  });
});
