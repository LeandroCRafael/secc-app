import type { Company360Indicator, Company360Model, Company360Point } from "@/features/company360/company-360-model";
import type { DataPoint } from "@/types/domain";

export const comparisonPeriods = [-2, -1, 0, 1, 2] as const;

export const comparisonMetrics = [
  { variable: "Receita Líquida", label: "Receita líquida", unit: "BRL_millions", indexable: true },
  { variable: "EBIT", label: "EBIT", unit: "BRL_millions", indexable: false },
  { variable: "Lucro Líquido", label: "Lucro líquido", unit: "BRL_millions", indexable: false },
  { variable: "Caixa + Equivalentes", label: "Caixa e equivalentes", unit: "BRL_millions", indexable: true },
  { variable: "Empréstimos CP", label: "Empréstimos CP", unit: "BRL_millions", indexable: true },
  { variable: "Empréstimos LP", label: "Empréstimos LP", unit: "BRL_millions", indexable: true },
  { variable: "Ativo Total", label: "Ativo total", unit: "BRL_millions", indexable: true },
  { variable: "Patrimônio Líquido", label: "Patrimônio líquido", unit: "BRL_millions", indexable: false },
] as const;

export type ComparisonMetric = (typeof comparisonMetrics)[number];
export type ComparisonPeriod = (typeof comparisonPeriods)[number];
export type ComparisonReadiness = "controlled" | "partial" | "baseline_pending" | "event_pending";

export type ComparisonCell = {
  relativePeriod: ComparisonPeriod;
  calendarYear: number | null;
  point: Company360Point | null;
  indexedValue: number | null;
};

export type ComparisonCompany = {
  id: string;
  name: string;
  sector: string;
  tier: string;
  companyType: string | null;
  referenceCode: string | null;
  eventYear: number | null;
  financialCoverage: number;
  qualitativeCoverage: number;
  marketCoverage: number;
  latestTrustedYear: number | null;
  pendingCount: number;
  suspiciousPendingCount: number;
  comparablePeriods: number;
  readiness: ComparisonReadiness;
  cells: ComparisonCell[];
  indicators: Partial<Record<Company360Indicator["key"], Company360Indicator>>;
};

export type ComparisonModel = {
  metric: ComparisonMetric;
  companies: ComparisonCompany[];
  baseline: Company360Model["baseline"];
  controlledCompanies: number;
  comparableCompanies: number;
  pendingChanges: number;
  limitations: string[];
};

function coverage(filled = 0, expected = 0): number {
  if (expected <= 0) return 0;
  return Math.round(Math.min(1, filled / expected) * 100);
}

function validNumeric(point: Company360Point | null | undefined): point is Company360Point & { value: number } {
  return Boolean(
    point &&
      point.availability === "available" &&
      !point.suspiciousScale &&
      typeof point.value === "number",
  );
}

function relativePoint(model: Company360Model, variable: string, period: ComparisonPeriod): Company360Point | null {
  if (model.company.eventYear === null) return null;
  const calendarYear = model.company.eventYear + period;
  const series = model.financialSeries.find((item) => item.variable === variable);
  return series?.points.find((point) => point.year === calendarYear) ?? null;
}

function readiness(model: Company360Model, comparablePeriods: number): ComparisonReadiness {
  if (model.company.eventYear === null) return "event_pending";
  if (!model.baseline) return "baseline_pending";
  return comparablePeriods >= 3 ? "controlled" : "partial";
}

function indicatorsByKey(indicators: Company360Indicator[]): ComparisonCompany["indicators"] {
  return Object.fromEntries(indicators.map((indicator) => [indicator.key, indicator])) as ComparisonCompany["indicators"];
}

function buildCompany(model: Company360Model, metric: ComparisonMetric): ComparisonCompany {
  const basePoint = relativePoint(model, metric.variable, -1);
  const baseValue = metric.indexable && validNumeric(basePoint) && basePoint.value !== 0 ? basePoint.value : null;
  const cells = comparisonPeriods.map((relativePeriod) => {
    const point = relativePoint(model, metric.variable, relativePeriod);
    const indexedValue = baseValue !== null && validNumeric(point)
      ? Number(((point.value / baseValue) * 100).toFixed(4))
      : null;
    return {
      relativePeriod,
      calendarYear: model.company.eventYear === null ? null : model.company.eventYear + relativePeriod,
      point,
      indexedValue,
    } satisfies ComparisonCell;
  });
  const comparablePeriods = cells.filter((cell) => validNumeric(cell.point ?? undefined)).length;
  const companyCoverage = model.company.coverage;
  return {
    id: model.company.id,
    name: model.company.name,
    sector: model.company.sector,
    tier: model.company.tier,
    companyType: model.company.companyType ?? null,
    referenceCode: model.company.referenceCode ?? null,
    eventYear: model.company.eventYear,
    financialCoverage: coverage(companyCoverage?.financialFilled, companyCoverage?.financialExpected),
    qualitativeCoverage: coverage(companyCoverage?.qualitativeFilled, companyCoverage?.qualitativeExpected),
    marketCoverage: coverage(companyCoverage?.marketFilled, companyCoverage?.marketExpected),
    latestTrustedYear: model.latestTrustedYear,
    pendingCount: model.pendingPoints.length,
    suspiciousPendingCount: model.suspiciousPendingCount,
    comparablePeriods,
    readiness: readiness(model, comparablePeriods),
    cells,
    indicators: indicatorsByKey(model.indicators),
  };
}

export function comparisonMetric(variable: string | undefined): ComparisonMetric {
  return comparisonMetrics.find((metric) => metric.variable === variable) ?? comparisonMetrics[0];
}

export function buildComparisonModel(models: Company360Model[], metricInput?: string): ComparisonModel {
  const metric = comparisonMetric(metricInput);
  const companies = models.map((model) => buildCompany(model, metric));
  const baseline = models.find((model) => model.baseline)?.baseline ?? null;
  const controlledCompanies = companies.filter((company) => company.readiness === "controlled").length;
  const comparableCompanies = companies.filter((company) => company.comparablePeriods >= 2).length;
  const pendingChanges = companies.reduce((sum, company) => sum + company.pendingCount, 0);
  const limitations: string[] = [];
  if (!baseline) limitations.push("A primeira linha de base Excel ainda não foi aplicada; valores e indicadores permanecem bloqueados.");
  if (companies.some((company) => company.eventYear === null)) limitations.push("Empresas sem ano de evento não podem ser alinhadas em períodos relativos.");
  if (companies.some((company) => company.suspiciousPendingCount > 0)) limitations.push("Propostas com escala suspeita estão fora da comparação até nova coleta ou correção.");
  if (comparableCompanies < 2) limitations.push(`Menos de duas empresas possuem ao menos dois períodos válidos para ${metric.label}.`);
  return { metric, companies, baseline, controlledCompanies, comparableCompanies, pendingChanges, limitations };
}

export function relativePeriodLabel(period: ComparisonPeriod): string {
  if (period === 0) return "t0";
  return `t${period > 0 ? "+" : ""}${period}`;
}

export function formatComparisonValue(value: number, unit: DataPoint["unit"]): string {
  if (unit === "percent") return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value)}%`;
  if (unit === "BRL") return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 }).format(value);
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value);
}
