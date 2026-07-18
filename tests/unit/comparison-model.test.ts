import { describe, expect, it } from "vitest";
import { buildComparisonModel, comparisonMetric, relativePeriodLabel } from "@/features/comparison/comparison-model";
import type { Company360Model, Company360Point } from "@/features/company360/company-360-model";

function point(year: number, variable: string, value: number): Company360Point {
  return {
    id: `${year}-${variable}`, year, variable, value, unit: "BRL_millions", availability: "available",
    workflowStatus: "synchronized", origin: "workbook", sourceOrganization: "Planilha mestre",
    sourceTitle: "secc-d1", sourceUrl: "/admin/sincronizacao", referenceDate: `${year}-12-31`,
    cellReference: `02!D${year}`, suspiciousScale: false,
  };
}

function companyModel(id: string, eventYear: number | null, values: number[], baseline = true): Company360Model {
  const points = eventYear === null ? [] : values.map((value, index) => point(eventYear - 2 + index, "Receita Líquida", value));
  return {
    company: {
      id, slug: id, name: `Empresa ${id}`, tier: "tier_1", sector: "Indústria", eventType: "judicial_recovery",
      eventYear, publicationStatus: "private", companyType: "Listada", coverage: {
        companyId: id, financialFilled: points.length, financialExpected: 5, qualitativeFilled: 2,
        qualitativeExpected: 8, marketFilled: 1, marketExpected: 4, researchedYears: points.length,
        totalYears: 5, lastDataYear: points.at(-1)?.year ?? null, workbookHash: "hash", calculatedAt: "2026-07-18T10:00:00.000Z",
      },
    },
    isPilot: true,
    baseline: baseline ? { workbookVersion: "secc-d1", dataVersion: 1, mappingVersion: "secc-map-v1", createdAt: "2026-07-18T10:00:00.000Z", sha256: "a".repeat(64) } : null,
    trustedPoints: points, pendingPoints: [],
    financialSeries: [{ variable: "Receita Líquida", unit: "BRL_millions", points }],
    qualitativePoints: [], marketPoints: [], indicators: [], years: points.map(({ year }) => year),
    statusCounts: { under_review: 0, approved: 0, conflicted: 0, synchronized: 0 },
    suspiciousPendingCount: 0, latestTrustedYear: points.at(-1)?.year ?? null, executiveSummary: "",
  };
}

describe("comparador executivo", () => {
  it("alinha empresas pelo período relativo e calcula índice t-1=100", () => {
    const model = buildComparisonModel([companyModel("a", 2022, [80, 100, 120, 90, 110])], "Receita Líquida");
    expect(model.companies[0]!.cells.map((cell) => cell.calendarYear)).toEqual([2020, 2021, 2022, 2023, 2024]);
    expect(model.companies[0]!.cells.map((cell) => cell.indexedValue)).toEqual([80, 100, 120, 90, 110]);
    expect(model.controlledCompanies).toBe(1);
  });

  it("mantém lacunas e bloqueia normalização sem evento ou linha de base", () => {
    const model = buildComparisonModel([companyModel("a", null, [], false)]);
    expect(model.companies[0]!.cells.every((cell) => cell.point === null)).toBe(true);
    expect(model.companies[0]!.readiness).toBe("event_pending");
    expect(model.limitations).toContain("Empresas sem ano de evento não podem ser alinhadas em períodos relativos.");
  });

  it("usa métrica padrão e rótulos estáveis", () => {
    expect(comparisonMetric("inexistente").variable).toBe("Receita Líquida");
    expect(relativePeriodLabel(-1)).toBe("t-1");
    expect(relativePeriodLabel(0)).toBe("t0");
    expect(relativePeriodLabel(2)).toBe("t+2");
  });
});
