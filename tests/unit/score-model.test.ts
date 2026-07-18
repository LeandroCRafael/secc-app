import { describe, expect, it } from "vitest";
import { buildCompanyScore } from "@/features/scoring/score-model";
import type { Company360Model, Company360Point } from "@/features/company360/company-360-model";

function point(variable: string, value: number): Company360Point {
  return { id: variable, year: 2023, variable, value, unit: "BRL_millions", availability: "available", workflowStatus: "synchronized", origin: "workbook", sourceOrganization: "Planilha", sourceTitle: "secc-d1", sourceUrl: "/admin/sincronizacao", referenceDate: "2023-12-31", cellReference: `02. Dados Financeiros!${variable}`, suspiciousScale: false };
}

function model(points: Company360Point[]): Pick<Company360Model, "company" | "baseline" | "trustedPoints" | "pendingPoints"> {
  return { company: { id: "company-1", slug: "empresa", name: "Empresa", tier: "tier_1", sector: "Teste", eventType: "judicial_recovery", eventYear: 2024, publicationStatus: "private", coverage: null }, baseline: { workbookVersion: "secc-d1", dataVersion: 1, mappingVersion: "secc-map-v1", createdAt: "2026-07-18T00:00:00.000Z", sha256: "abc" }, trustedPoints: points, pendingPoints: [] };
}

describe("score experimental SECC", () => {
  it("calcula somente com dados t-1 e explica a contribuição observada", () => {
    const result = buildCompanyScore(model([
      point("Receita Líquida", 100), point("EBIT", -10), point("Lucro Líquido", -20),
      point("Ativo Circulante", 80), point("Passivo Circulante", 100), point("Empréstimos CP", 40),
      point("Empréstimos LP", 50), point("Caixa + Equivalentes", 10), point("Ativo Total", 100),
      point("Patrimônio Líquido", -5), point("FCO", -2),
    ]));
    expect(result.status).toBe("eligible");
    expect(result.score).toBe(100);
    expect(result.contributions).toHaveLength(6);
    expect(result.contributions[0]?.sources[0]).toContain("02. Dados Financeiros");
  });

  it("bloqueia o score quando a cobertura é insuficiente", () => {
    const result = buildCompanyScore(model([point("Receita Líquida", 100), point("EBIT", -10)]));
    expect(result.status).toBe("insufficient_data");
    expect(result.score).toBeNull();
    expect(result.coverage).toBe(20);
  });

  it("ignora dados posteriores ao evento", () => {
    const postEvent = { ...point("EBIT", -10), year: 2024 };
    const result = buildCompanyScore(model([point("Receita Líquida", 100), postEvent]));
    expect(result.availableDimensions).toBe(0);
    expect(result.score).toBeNull();
  });
});
