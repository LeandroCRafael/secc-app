import { describe, expect, it } from "vitest";
import { buildDashboardModel, diagnosticPriority, financialBand, nextDiagnosticAction } from "@/features/diagnostics/dashboard-model";
import type { CompanyDiagnostic } from "@/types/domain";

function company(overrides: Partial<CompanyDiagnostic> & Pick<CompanyDiagnostic, "id" | "name">): CompanyDiagnostic {
  return {
    slug: overrides.id,
    tier: "tier_1",
    sector: "Teste",
    eventType: "judicial_recovery",
    eventYear: 2020,
    publicationStatus: "private",
    companyType: "Listada",
    collectionStartYear: 2015,
    collectionEndYear: 2024,
    workbookStatus: "Em andamento",
    coverage: {
      companyId: overrides.id,
      financialFilled: 0,
      financialExpected: 240,
      qualitativeFilled: 0,
      qualitativeExpected: 80,
      marketFilled: 0,
      marketExpected: 40,
      researchedYears: 0,
      totalYears: 10,
      lastDataYear: null,
      workbookHash: "hash",
      calculatedAt: "2026-07-16T12:00:00.000Z",
    },
    ...overrides,
  };
}

describe("modelo do dashboard mestre", () => {
  it("reconcilia cards, tiers e faixas pela mesma regra da visão mestre", () => {
    const companies = [
      company({ id: "a", name: "Completa", coverage: { ...company({ id: "x", name: "x" }).coverage!, companyId: "a", financialFilled: 230, qualitativeFilled: 10, researchedYears: 10, lastDataYear: 2024 }, workbookStatus: "Coletado - conferir" }),
      company({ id: "b", name: "Parcial", coverage: { ...company({ id: "x", name: "x" }).coverage!, companyId: "b", financialFilled: 120 }, workbookStatus: "Em andamento" }),
      company({ id: "c", name: "Vazia", tier: "tier_2", companyType: "Privada", coverage: { ...company({ id: "x", name: "x" }).coverage!, companyId: "c" }, workbookStatus: "Bloqueada" }),
    ];
    const model = buildDashboardModel(companies, []);
    expect(model).toMatchObject({ total: 3, withFinancial: 2, withoutFinancial: 1, withQualitative: 1, highCoverage: 1, blocked: 1 });
    expect(model.tiers).toEqual(expect.arrayContaining([{ key: "tier_1", label: "T1", total: 2, withFinancial: 2 }]));
    expect(model.bands.map(({ key, value }) => [key, value])).toEqual([["high", 1], ["medium", 0], ["low", 1], ["very_low", 0], ["empty", 1]]);
  });

  it("prioriza ausência de janela, lacuna financeira e bloco qualitativo", () => {
    const noWindow = company({ id: "a", name: "Sem janela", collectionStartYear: null, collectionEndYear: null });
    const strongFinancial = company({ id: "b", name: "Financeiro forte", coverage: { ...company({ id: "x", name: "x" }).coverage!, companyId: "b", financialFilled: 230 } });
    expect(diagnosticPriority(noWindow)).toBe("critical");
    expect(nextDiagnosticAction(noWindow)).toContain("Confirmar ano");
    expect(financialBand(strongFinancial)).toBe("high");
    expect(diagnosticPriority(strongFinancial)).toBe("high");
    expect(nextDiagnosticAction(strongFinancial)).toBe("Coletar dados qualitativos");
  });

  it("usa anos pesquisados como denominador quando há dados, mas a janela cadastral está ausente", () => {
    const unmapped = company({
      id: "triunfo", name: "Triunfo", collectionStartYear: null, collectionEndYear: null,
      coverage: { ...company({ id: "x", name: "x" }).coverage!, companyId: "triunfo", financialFilled: 230, financialExpected: 0, researchedYears: 10, totalYears: 0 },
    });
    expect(financialBand(unmapped)).toBe("high");
    expect(diagnosticPriority(unmapped)).toBe("critical");
    expect(nextDiagnosticAction(unmapped)).toContain("Confirmar ano");
    expect(diagnosticPriority({ ...unmapped, tier: "tier_2" })).toBe("high");
  });
});
