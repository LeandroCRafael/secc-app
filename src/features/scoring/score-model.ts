import type { Company360Model, Company360Point } from "@/features/company360/company-360-model";

export const scoreMethodology = {
  id: "secc-financial-signals",
  version: "0.1.0-experimental",
  referenceDate: "2026-07-18",
  analysisWindow: "t-1",
  objective: "Resumir sinais contábeis observáveis no exercício anterior ao evento de reestruturação.",
  minimumCoverage: 60,
  limitations: [
    "Baseline heurístico ainda sem variável-alvo, calibração estatística ou validação temporal.",
    "Não estima probabilidade de default, não constitui rating e não recomenda crédito ou investimento.",
    "Dados posteriores ao evento são excluídos para reduzir vazamento de informação.",
    "Ausências não reduzem artificialmente o sinal: o score só é exibido com cobertura mínima.",
  ],
} as const;

type ScoreStatus = "eligible" | "insufficient_data" | "baseline_pending" | "event_pending";
type ScoreBand = "limited" | "attention" | "elevated" | "very_elevated";

export type ScoreContribution = {
  key: string;
  label: string;
  observed: number;
  observedUnit: "percent" | "multiple";
  points: number;
  maxPoints: number;
  interpretation: string;
  sources: string[];
};

export type CompanyScore = {
  companyId: string;
  name: string;
  sector: string;
  eventYear: number | null;
  analysisYear: number | null;
  status: ScoreStatus;
  score: number | null;
  band: ScoreBand | null;
  coverage: number;
  availableWeight: number;
  availableDimensions: number;
  contributions: ScoreContribution[];
  missingDimensions: string[];
  pendingChanges: number;
};

export type ScorePortfolio = {
  methodology: typeof scoreMethodology;
  baseline: Company360Model["baseline"];
  companies: CompanyScore[];
  eligibleCount: number;
  insufficientCount: number;
  averageCoverage: number;
  bands: Record<ScoreBand, number>;
};

type RuleResult = Omit<ScoreContribution, "key" | "label" | "maxPoints">;
type Rule = {
  key: string;
  label: string;
  maxPoints: number;
  calculate: (values: ValueReader) => RuleResult | null;
};

type ValueReader = {
  value: (variable: string) => number | null;
  sources: (...variables: string[]) => string[];
};

function ratio(numerator: number | null, denominator: number | null): number | null {
  if (numerator === null || denominator === null || denominator === 0) return null;
  return numerator / denominator;
}

function stepped(value: number, levels: Array<{ when: (input: number) => boolean; points: number; label: string }>): { points: number; label: string } {
  return levels.find((level) => level.when(value)) ?? { points: 0, label: "Sem sinal adicional na régua experimental." };
}

const rules: Rule[] = [
  {
    key: "ebit_margin", label: "Margem EBIT", maxPoints: 20,
    calculate: (reader) => {
      const value = ratio(reader.value("EBIT"), reader.value("Receita Líquida"));
      if (value === null) return null;
      const result = stepped(value, [
        { when: (input) => input < 0, points: 20, label: "Margem operacional negativa." },
        { when: (input) => input < 0.05, points: 10, label: "Margem operacional positiva, porém inferior a 5%." },
      ]);
      return { observed: value * 100, observedUnit: "percent", points: result.points, interpretation: result.label, sources: reader.sources("EBIT", "Receita Líquida") };
    },
  },
  {
    key: "net_margin", label: "Margem líquida", maxPoints: 15,
    calculate: (reader) => {
      const value = ratio(reader.value("Lucro Líquido"), reader.value("Receita Líquida"));
      if (value === null) return null;
      const result = stepped(value, [
        { when: (input) => input < 0, points: 15, label: "Resultado líquido negativo." },
        { when: (input) => input < 0.03, points: 7.5, label: "Margem líquida positiva, porém inferior a 3%." },
      ]);
      return { observed: value * 100, observedUnit: "percent", points: result.points, interpretation: result.label, sources: reader.sources("Lucro Líquido", "Receita Líquida") };
    },
  },
  {
    key: "current_ratio", label: "Liquidez corrente", maxPoints: 15,
    calculate: (reader) => {
      const value = ratio(reader.value("Ativo Circulante"), reader.value("Passivo Circulante"));
      if (value === null) return null;
      const result = stepped(value, [
        { when: (input) => input < 1, points: 15, label: "Ativos circulantes inferiores aos passivos circulantes." },
        { when: (input) => input < 1.2, points: 7.5, label: "Liquidez corrente entre 1,0x e 1,2x." },
      ]);
      return { observed: value, observedUnit: "multiple", points: result.points, interpretation: result.label, sources: reader.sources("Ativo Circulante", "Passivo Circulante") };
    },
  },
  {
    key: "net_debt_assets", label: "Dívida líquida / ativos", maxPoints: 20,
    calculate: (reader) => {
      const shortDebt = reader.value("Empréstimos CP");
      const longDebt = reader.value("Empréstimos LP");
      const cash = reader.value("Caixa + Equivalentes");
      const assets = reader.value("Ativo Total");
      if (shortDebt === null || longDebt === null || cash === null) return null;
      const value = ratio(shortDebt + longDebt - cash, assets);
      if (value === null) return null;
      const result = stepped(value, [
        { when: (input) => input > 0.6, points: 20, label: "Dívida líquida superior a 60% dos ativos." },
        { when: (input) => input > 0.4, points: 14, label: "Dívida líquida entre 40% e 60% dos ativos." },
        { when: (input) => input > 0.2, points: 7, label: "Dívida líquida entre 20% e 40% dos ativos." },
      ]);
      return { observed: value * 100, observedUnit: "percent", points: result.points, interpretation: result.label, sources: reader.sources("Empréstimos CP", "Empréstimos LP", "Caixa + Equivalentes", "Ativo Total") };
    },
  },
  {
    key: "equity_assets", label: "Patrimônio líquido / ativos", maxPoints: 15,
    calculate: (reader) => {
      const value = ratio(reader.value("Patrimônio Líquido"), reader.value("Ativo Total"));
      if (value === null) return null;
      const result = stepped(value, [
        { when: (input) => input < 0, points: 15, label: "Patrimônio líquido negativo." },
        { when: (input) => input < 0.15, points: 8, label: "Capital próprio inferior a 15% dos ativos." },
      ]);
      return { observed: value * 100, observedUnit: "percent", points: result.points, interpretation: result.label, sources: reader.sources("Patrimônio Líquido", "Ativo Total") };
    },
  },
  {
    key: "operating_cash_margin", label: "FCO / receita", maxPoints: 15,
    calculate: (reader) => {
      const value = ratio(reader.value("FCO"), reader.value("Receita Líquida"));
      if (value === null) return null;
      const result = stepped(value, [
        { when: (input) => input < 0, points: 15, label: "Fluxo de caixa operacional negativo." },
        { when: (input) => input < 0.05, points: 8, label: "Conversão operacional inferior a 5% da receita." },
      ]);
      return { observed: value * 100, observedUnit: "percent", points: result.points, interpretation: result.label, sources: reader.sources("FCO", "Receita Líquida") };
    },
  },
];

function trustedNumericPoint(points: Company360Point[], year: number, variable: string): Company360Point | null {
  return points.find((point) => point.year === year && point.variable === variable && point.availability === "available" && typeof point.value === "number" && !point.suspiciousScale) ?? null;
}

function band(score: number): ScoreBand {
  if (score >= 75) return "very_elevated";
  if (score >= 50) return "elevated";
  if (score >= 25) return "attention";
  return "limited";
}

export function buildCompanyScore(model: Pick<Company360Model, "company" | "baseline" | "trustedPoints" | "pendingPoints">): CompanyScore {
  const eventYear = model.company.eventYear;
  const analysisYear = eventYear === null ? null : eventYear - 1;
  const base = { companyId: model.company.id, name: model.company.name, sector: model.company.sector, eventYear, analysisYear, score: null, band: null, coverage: 0, availableWeight: 0, availableDimensions: 0, contributions: [], missingDimensions: rules.map((rule) => rule.label), pendingChanges: model.pendingPoints.length } satisfies Omit<CompanyScore, "status">;
  if (!model.baseline) return { ...base, status: "baseline_pending" };
  if (analysisYear === null) return { ...base, status: "event_pending" };

  const reader: ValueReader = {
    value: (variable) => trustedNumericPoint(model.trustedPoints, analysisYear, variable)?.value as number ?? null,
    sources: (...variables) => variables.map((variable) => trustedNumericPoint(model.trustedPoints, analysisYear, variable)?.cellReference).filter((source): source is string => Boolean(source)),
  };
  const contributions: ScoreContribution[] = [];
  const missingDimensions: string[] = [];
  for (const rule of rules) {
    const result = rule.calculate(reader);
    if (!result) missingDimensions.push(rule.label);
    else contributions.push({ key: rule.key, label: rule.label, maxPoints: rule.maxPoints, ...result });
  }
  const availableWeight = contributions.reduce((sum, item) => sum + item.maxPoints, 0);
  const coverage = Math.round(availableWeight);
  const status: ScoreStatus = coverage >= scoreMethodology.minimumCoverage && contributions.length >= 4 ? "eligible" : "insufficient_data";
  const rawPoints = contributions.reduce((sum, item) => sum + item.points, 0);
  const score = status === "eligible" && availableWeight > 0 ? Math.round((rawPoints / availableWeight) * 100) : null;
  return { ...base, status, score, band: score === null ? null : band(score), coverage, availableWeight, availableDimensions: contributions.length, contributions, missingDimensions };
}

export function buildScorePortfolio(models: Array<Pick<Company360Model, "company" | "baseline" | "trustedPoints" | "pendingPoints">>): ScorePortfolio {
  const companies = models.map(buildCompanyScore).sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
  const eligible = companies.filter((company) => company.status === "eligible");
  const bands: ScorePortfolio["bands"] = { limited: 0, attention: 0, elevated: 0, very_elevated: 0 };
  for (const company of eligible) if (company.band) bands[company.band] += 1;
  return {
    methodology: scoreMethodology,
    baseline: models.find((model) => model.baseline)?.baseline ?? null,
    companies,
    eligibleCount: eligible.length,
    insufficientCount: companies.length - eligible.length,
    averageCoverage: companies.length === 0 ? 0 : Math.round(companies.reduce((sum, company) => sum + company.coverage, 0) / companies.length),
    bands,
  };
}
