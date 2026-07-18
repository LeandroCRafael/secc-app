import { describe, expect, it } from "vitest";
import {
  buildCompany360Model,
  eventRelativeLabel,
  selectPilotCompanies
} from "@/features/company360/company-360-model";
import type { WorkbookSnapshot } from "@/lib/excel/sync-contracts";
import type { CompanyDiagnostic, Proposal } from "@/types/domain";

const company: CompanyDiagnostic = {
  id: "company-1",
  slug: "empresa-1",
  name: "Empresa 1",
  tier: "tier_1",
  sector: "Indústria",
  eventType: "judicial_recovery",
  eventYear: 2022,
  publicationStatus: "private",
  companyType: "Listada",
  coverage: {
    companyId: "company-1",
    financialFilled: 5,
    financialExpected: 10,
    qualitativeFilled: 1,
    qualitativeExpected: 8,
    marketFilled: 0,
    marketExpected: 4,
    researchedYears: 1,
    totalYears: 3,
    lastDataYear: 2022,
    workbookHash: "hash",
    calculatedAt: "2026-07-18T10:00:00.000Z"
  }
};

function cell(variable: string, value: number, address: string) {
  return {
    cellKey: `02!${address}`,
    sheetName: "02. Dados Financeiros",
    cellAddress: address,
    companyId: company.id,
    year: 2022,
    variable,
    unit: "BRL_millions" as const,
    value,
    cellHash: address
  };
}

const baseline: WorkbookSnapshot = {
  id: "snapshot-1",
  workbookId: "secc-master-workbook",
  originalName: "mestre.xlsx",
  sizeBytes: 100,
  sha256: "a".repeat(64),
  workbookVersion: "secc-d1",
  dataVersion: 1,
  mappingVersion: "secc-map-v1",
  kind: "result",
  syncBatchId: "batch-1",
  createdBy: "admin",
  createdAt: "2026-07-18T10:00:00.000Z",
  cells: [
    cell("Receita Líquida", 100, "D6"),
    cell("EBIT", 10, "H6"),
    cell("Lucro Líquido", -5, "J6"),
    cell("Ativo Circulante", 80, "N6"),
    cell("Passivo Circulante", 40, "S6"),
    cell("Empréstimos CP", 30, "R6"),
    cell("Empréstimos LP", 20, "T6"),
    cell("Caixa + Equivalentes", 15, "K6")
  ]
};

const proposal: Proposal = {
  id: "proposal-1",
  companyId: company.id,
  year: 2022,
  variable: "Receita Líquida",
  value: 110,
  unit: "BRL_millions",
  availability: "available",
  status: "under_review",
  createdBy: "admin",
  createdAt: "2026-07-18T11:00:00.000Z",
  version: 1,
  publishAuthorized: false,
  source: {
    id: "source-1",
    organization: "CVM",
    title: "DFP",
    url: "https://dados.cvm.gov.br/",
    referenceDate: "2022-12-31",
    collectedAt: "2026-07-18"
  }
};

describe("Empresa 360", () => {
  it("deriva indicadores apenas da linha de base sincronizada", () => {
    const model = buildCompany360Model({
      company,
      companies: [company],
      proposals: [proposal],
      baseline
    });
    expect(model.indicators.find((item) => item.key === "ebitMargin")?.value).toBe(10);
    expect(model.indicators.find((item) => item.key === "currentRatio")?.value).toBe(2);
    expect(model.indicators.find((item) => item.key === "netDebt")?.value).toBe(35);
    expect(model.pendingPoints).toHaveLength(1);
    expect(model.trustedPoints.find((item) => item.variable === "Receita Líquida")?.value).toBe(
      100
    );
  });

  it("bloqueia cálculo sem linha de base e sinaliza escala suspeita", () => {
    const suspicious = { ...proposal, value: 1_500_000_000 };
    const model = buildCompany360Model({
      company,
      companies: [company],
      proposals: [suspicious],
      baseline: null
    });
    expect(model.indicators).toEqual([]);
    expect(model.suspiciousPendingCount).toBe(1);
    expect(model.executiveSummary).toContain("linha de base");
  });

  it("seleciona coorte piloto sem linhas agregadoras", () => {
    const placeholder = { ...company, id: "placeholder", name: "(10 empresas adicionais)" };
    expect(selectPilotCompanies([placeholder, company], 8)).toEqual([company.id]);
  });

  it("normaliza o período em torno do evento", () => {
    expect(eventRelativeLabel(2021, 2022)).toBe("2021 · t-1");
    expect(eventRelativeLabel(2022, 2022)).toBe("2022 · t0");
    expect(eventRelativeLabel(2024, 2022)).toBe("2024 · t+2");
  });
});
