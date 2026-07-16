import type { CompanyDiagnostic, Proposal } from "@/types/domain";

export type FinancialBand = "high" | "medium" | "low" | "very_low" | "empty";
export type DiagnosticPriority = "critical" | "high" | "medium" | "low";

export const financialBandLabels: Record<FinancialBand, string> = {
  high: "≥ 90%",
  medium: "60% a 89,9%",
  low: "20% a 59,9%",
  very_low: "Abaixo de 20%",
  empty: "Sem dados",
};

export const priorityLabels: Record<DiagnosticPriority, string> = {
  critical: "Crítica",
  high: "Alta",
  medium: "Média",
  low: "Baixa",
};

export function coverageRate(filled = 0, expected = 0): number {
  if (expected <= 0 || filled <= 0) return 0;
  return Math.min(1, filled / expected);
}

export function financialExpectedCells(company: CompanyDiagnostic): number {
  const coverage = company.coverage;
  if (!coverage) return 0;
  return coverage.financialExpected > 0 ? coverage.financialExpected : coverage.researchedYears * 24;
}

export function financialCoverageRate(company: CompanyDiagnostic): number {
  return coverageRate(company.coverage?.financialFilled ?? 0, financialExpectedCells(company));
}

export function financialBand(company: CompanyDiagnostic): FinancialBand {
  const coverage = company.coverage;
  const filled = coverage?.financialFilled ?? 0;
  const rate = financialCoverageRate(company);
  if (filled === 0) return "empty";
  if (rate >= 0.9) return "high";
  if (rate >= 0.6) return "medium";
  if (rate >= 0.2) return "low";
  return "very_low";
}

export function diagnosticPriority(company: CompanyDiagnostic): DiagnosticPriority {
  const financial = company.coverage?.financialFilled ?? 0;
  const qualitative = company.coverage?.qualitativeFilled ?? 0;
  const market = company.coverage?.marketFilled ?? 0;
  const rate = financialCoverageRate(company);
  const hasWindow = Boolean(company.collectionStartYear && company.collectionEndYear);
  const listed = company.companyType?.toLocaleLowerCase("pt-BR").includes("listada") ?? false;

  if (!hasWindow) return company.tier === "tier_1" ? "critical" : company.tier === "tier_2" ? "high" : "low";
  if (company.tier === "tier_1" && financial === 0) return "critical";
  if (company.tier === "tier_1" && (rate < 0.9 || qualitative === 0)) return "high";
  if (company.tier === "tier_2" && financial === 0) return "medium";
  if (listed && market === 0) return "medium";
  return "low";
}

export function nextDiagnosticAction(company: CompanyDiagnostic): string {
  const coverage = company.coverage;
  const financial = coverage?.financialFilled ?? 0;
  const qualitative = coverage?.qualitativeFilled ?? 0;
  const market = coverage?.marketFilled ?? 0;
  const rate = financialCoverageRate(company);
  const listed = company.companyType?.toLocaleLowerCase("pt-BR").includes("listada") ?? false;

  if (!company.collectionStartYear || !company.collectionEndYear) return "Confirmar ano da RJ e definir janela";
  if (financial === 0) return "Coletar dados financeiros";
  if (rate < 0.9) return "Completar dados financeiros";
  if (qualitative === 0) return "Coletar dados qualitativos";
  if (listed && market === 0) return "Coletar dados de mercado";
  return "Revisar e aprovar para publicação";
}

const tierOrder = ["tier_1", "tier_2", "unclassified"] as const;
const tierLabels = { tier_1: "T1", tier_2: "T2", unclassified: "BUSCA" } as const;
const bandOrder: FinancialBand[] = ["high", "medium", "low", "very_low", "empty"];

export function buildDashboardModel(companies: CompanyDiagnostic[], proposals: Proposal[]) {
  const withFinancial = companies.filter((company) => (company.coverage?.financialFilled ?? 0) > 0).length;
  const withQualitative = companies.filter((company) => (company.coverage?.qualitativeFilled ?? 0) > 0).length;
  const withMarket = companies.filter((company) => (company.coverage?.marketFilled ?? 0) > 0).length;
  const blocked = companies.filter((company) => company.workbookStatus === "Bloqueada").length;
  const highCoverage = companies.filter((company) => financialBand(company) === "high").length;
  const pendingProposals = proposals.filter((proposal) => ["submitted", "under_review", "conflicted"].includes(proposal.status)).length;
  const priorityCounts = companies.reduce<Record<DiagnosticPriority, number>>((counts, company) => {
    counts[diagnosticPriority(company)] += 1;
    return counts;
  }, { critical: 0, high: 0, medium: 0, low: 0 });

  return {
    total: companies.length,
    withFinancial,
    withoutFinancial: companies.length - withFinancial,
    withQualitative,
    withMarket,
    blocked,
    highCoverage,
    pendingProposals,
    priorityCounts,
    latestCalculation: companies.map((company) => company.coverage?.calculatedAt ?? null).filter(Boolean).sort().at(-1) ?? null,
    tiers: tierOrder.map((tier) => ({
      key: tier,
      label: tierLabels[tier],
      total: companies.filter((company) => company.tier === tier).length,
      withFinancial: companies.filter((company) => company.tier === tier && (company.coverage?.financialFilled ?? 0) > 0).length,
    })),
    bands: bandOrder.map((band) => ({
      key: band,
      label: financialBandLabels[band],
      value: companies.filter((company) => financialBand(company) === band).length,
    })),
    workbookStatuses: ["Bloqueada", "Coletado - conferir", "Em andamento"].map((status) => ({
      label: status,
      value: companies.filter((company) => company.workbookStatus === status).length,
    })),
  };
}

export type DashboardModel = ReturnType<typeof buildDashboardModel>;
