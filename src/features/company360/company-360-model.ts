import type { WorkbookCellValue, WorkbookSnapshot } from "@/lib/excel/sync-contracts";
import type { CompanyDiagnostic, DataPoint, Proposal, WorkflowStatus } from "@/types/domain";

export const company360MetricGroups = [
  {
    key: "result",
    label: "Resultado",
    variables: ["Receita Líquida", "Lucro Bruto", "EBIT", "Resultado Financeiro", "Lucro Líquido"]
  },
  {
    key: "liquidity",
    label: "Liquidez e capital de giro",
    variables: [
      "Caixa + Equivalentes",
      "Contas a Receber",
      "Estoques",
      "Ativo Circulante",
      "Fornecedores",
      "Passivo Circulante"
    ]
  },
  {
    key: "capital",
    label: "Estrutura de capital",
    variables: [
      "Empréstimos CP",
      "Empréstimos LP",
      "Ativo Total",
      "Passivo Total",
      "Patrimônio Líquido",
      "FCO",
      "Capex"
    ]
  }
] as const;

const qualitativeVariables = [
  "Auditor",
  "Opinião auditor",
  "Going Concern flag",
  "% receita top-5 clientes",
  "% receita mercado interno",
  "Provisões + Contingências",
  "Atrasou DFP",
  "Fato relevante: waiver/breach"
] as const;

const marketVariables = [
  "Cotação 31/12",
  "Ações em circulação",
  "Market Cap",
  "Volume médio diário"
] as const;

export type Company360Origin = "workbook" | "proposal";

export type Company360Point = {
  id: string;
  year: number;
  variable: string;
  value: string | number | null;
  unit: DataPoint["unit"];
  availability: DataPoint["availability"];
  workflowStatus: WorkflowStatus;
  origin: Company360Origin;
  sourceOrganization: string;
  sourceTitle: string;
  sourceUrl: string;
  referenceDate: string;
  cellReference: string | null;
  suspiciousScale: boolean;
};

export type Company360Indicator = {
  key: "ebitMargin" | "netMargin" | "currentRatio" | "grossDebt" | "netDebt";
  label: string;
  year: number;
  value: number;
  unit: "percent" | "multiple" | "BRL_millions";
};

export type Company360Model = {
  company: CompanyDiagnostic;
  isPilot: boolean;
  baseline: null | {
    workbookVersion: string;
    dataVersion: number;
    mappingVersion: string;
    createdAt: string;
    sha256: string;
  };
  trustedPoints: Company360Point[];
  pendingPoints: Company360Point[];
  financialSeries: Array<{ variable: string; unit: DataPoint["unit"]; points: Company360Point[] }>;
  qualitativePoints: Company360Point[];
  marketPoints: Company360Point[];
  indicators: Company360Indicator[];
  years: number[];
  statusCounts: Record<"under_review" | "approved" | "conflicted" | "synchronized", number>;
  suspiciousPendingCount: number;
  latestTrustedYear: number | null;
  executiveSummary: string;
};

function scalar(value: WorkbookCellValue): string | number | null {
  if (value && typeof value === "object") {
    return typeof value.result === "boolean" ? (value.result ? "Sim" : "Não") : value.result;
  }
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  return value;
}

function availability(value: string | number | null): DataPoint["availability"] {
  if (value === null || value === "") return "not_researched";
  if (typeof value === "number") return "available";
  const normalized = value.trim().toLocaleUpperCase("pt-BR");
  if (normalized === "N/D") return "unavailable";
  if (normalized === "N/A") return "not_applicable";
  if (normalized === "PERÍODO FUTURO") return "future_period";
  if (normalized === "RETIDO") return "withheld";
  return "available";
}

function suspiciousScale(value: string | number | null, unit: DataPoint["unit"]): boolean {
  return typeof value === "number" && unit === "BRL_millions" && Math.abs(value) >= 1_000_000_000;
}

function workbookPoints(snapshot: WorkbookSnapshot | null, companyId: string): Company360Point[] {
  if (!snapshot) return [];
  return snapshot.cells
    .filter((cell) => cell.companyId === companyId)
    .map((cell) => {
      const value = scalar(cell.value);
      return {
        id: `workbook:${snapshot.id}:${cell.cellKey}`,
        year: cell.year,
        variable: cell.variable,
        value,
        unit: cell.unit,
        availability: availability(value),
        workflowStatus: "synchronized",
        origin: "workbook",
        sourceOrganization: "Planilha mestre SECC",
        sourceTitle: `Versão ${snapshot.workbookVersion}`,
        sourceUrl: "/admin/sincronizacao",
        referenceDate: `${cell.year}-12-31`,
        cellReference: `${cell.sheetName}!${cell.cellAddress}`,
        suspiciousScale: suspiciousScale(value, cell.unit)
      } satisfies Company360Point;
    });
}

function proposalPoints(proposals: Proposal[], companyId: string): Company360Point[] {
  return proposals
    .filter((proposal) => proposal.companyId === companyId && proposal.status !== "rejected")
    .map((proposal) => ({
      id: proposal.id,
      year: proposal.year,
      variable: proposal.variable === "Caixa + Equiv." ? "Caixa + Equivalentes" : proposal.variable,
      value: proposal.value,
      unit: proposal.unit,
      availability: proposal.availability,
      workflowStatus: proposal.status,
      origin: "proposal",
      sourceOrganization: proposal.source.organization,
      sourceTitle: proposal.source.title,
      sourceUrl: proposal.source.url,
      referenceDate: proposal.source.referenceDate,
      cellReference: null,
      suspiciousScale: suspiciousScale(proposal.value, proposal.unit)
    }));
}

function valueAt(points: Company360Point[], year: number, variable: string): number | null {
  const point = points.find(
    (item) =>
      item.year === year &&
      item.variable === variable &&
      item.availability === "available" &&
      !item.suspiciousScale
  );
  return typeof point?.value === "number" ? point.value : null;
}

function ratio(numerator: number | null, denominator: number | null): number | null {
  if (numerator === null || denominator === null || denominator === 0) return null;
  return numerator / denominator;
}

function buildIndicators(points: Company360Point[], years: number[]): Company360Indicator[] {
  const latest = [...years]
    .reverse()
    .find((year) =>
      points.some(
        (point) =>
          point.year === year && point.availability === "available" && !point.suspiciousScale
      )
    );
  if (latest === undefined) return [];
  const revenue = valueAt(points, latest, "Receita Líquida");
  const ebit = valueAt(points, latest, "EBIT");
  const netIncome = valueAt(points, latest, "Lucro Líquido");
  const currentAssets = valueAt(points, latest, "Ativo Circulante");
  const currentLiabilities = valueAt(points, latest, "Passivo Circulante");
  const shortDebt = valueAt(points, latest, "Empréstimos CP");
  const longDebt = valueAt(points, latest, "Empréstimos LP");
  const cash = valueAt(points, latest, "Caixa + Equivalentes");
  const grossDebt =
    shortDebt === null && longDebt === null ? null : (shortDebt ?? 0) + (longDebt ?? 0);
  const candidates: Array<Company360Indicator | null> = [
    ratio(ebit, revenue) === null
      ? null
      : {
          key: "ebitMargin",
          label: "Margem EBIT",
          year: latest,
          value: ratio(ebit, revenue)! * 100,
          unit: "percent"
        },
    ratio(netIncome, revenue) === null
      ? null
      : {
          key: "netMargin",
          label: "Margem líquida",
          year: latest,
          value: ratio(netIncome, revenue)! * 100,
          unit: "percent"
        },
    ratio(currentAssets, currentLiabilities) === null
      ? null
      : {
          key: "currentRatio",
          label: "Liquidez corrente",
          year: latest,
          value: ratio(currentAssets, currentLiabilities)!,
          unit: "multiple"
        },
    grossDebt === null
      ? null
      : {
          key: "grossDebt",
          label: "Dívida financeira",
          year: latest,
          value: grossDebt,
          unit: "BRL_millions"
        },
    grossDebt === null || cash === null
      ? null
      : {
          key: "netDebt",
          label: "Dívida financeira líquida",
          year: latest,
          value: grossDebt - cash,
          unit: "BRL_millions"
        }
  ];
  return candidates.filter((item): item is Company360Indicator => item !== null);
}

function coveragePercent(filled = 0, expected = 0): number {
  return expected > 0 ? Math.round((filled / expected) * 100) : 0;
}

function summary(
  company: CompanyDiagnostic,
  baseline: WorkbookSnapshot | null,
  trustedPoints: Company360Point[],
  pendingPoints: Company360Point[]
): string {
  const coverage = coveragePercent(
    company.coverage?.financialFilled,
    company.coverage?.financialExpected
  );
  if (!baseline) {
    return pendingPoints.length > 0
      ? `A planilha indica ${coverage}% de cobertura financeira. Há ${pendingPoints.length} dado(s) em fluxo de revisão, mas a primeira linha de base controlada ainda precisa ser aplicada antes de qualquer conclusão financeira.`
      : `A planilha indica ${coverage}% de cobertura financeira, mas a primeira linha de base controlada ainda não foi aplicada. A prioridade é registrar o XLSX atual para liberar séries e indicadores auditáveis.`;
  }
  const available = trustedPoints.filter(
    (point) => point.availability === "available" && !point.suspiciousScale
  ).length;
  return `A versão ${baseline.workbookVersion} sustenta ${available} observação(ões) disponíveis para esta empresa. A leitura abaixo separa valores sincronizados de propostas ainda sujeitas a revisão.`;
}

export function selectPilotCompanies(companies: CompanyDiagnostic[], limit = 8): string[] {
  return companies
    .filter((company) => !company.name.trim().startsWith("(") && Boolean(company.eventYear))
    .map((company) => {
      const coverage = company.coverage;
      const financialRate =
        coverage && coverage.financialExpected > 0
          ? coverage.financialFilled / coverage.financialExpected
          : 0;
      const score =
        financialRate * 100 +
        Math.min(coverage?.qualitativeFilled ?? 0, 8) * 3 +
        Math.min(coverage?.marketFilled ?? 0, 4) * 2 +
        (company.companyType?.toLocaleLowerCase("pt-BR").includes("listada") ? 4 : 0);
      return { id: company.id, name: company.name, score };
    })
    .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name, "pt-BR"))
    .slice(0, limit)
    .map(({ id }) => id);
}

export function buildCompany360Model(input: {
  company: CompanyDiagnostic;
  companies: CompanyDiagnostic[];
  proposals: Proposal[];
  baseline: WorkbookSnapshot | null;
}): Company360Model {
  const trustedPoints = workbookPoints(input.baseline, input.company.id);
  const pendingPoints = proposalPoints(input.proposals, input.company.id)
    .filter((point) => point.workflowStatus !== "synchronized")
    .sort(
      (left, right) =>
        right.year - left.year || left.variable.localeCompare(right.variable, "pt-BR")
    );
  const years = [...new Set(trustedPoints.map((point) => point.year))].sort(
    (left, right) => left - right
  );
  const financialVariables = company360MetricGroups.flatMap((group) => [...group.variables]);
  const financialSeries = financialVariables.map((variable) => ({
    variable,
    unit:
      trustedPoints.find((point) => point.variable === variable)?.unit ??
      ("BRL_millions" as DataPoint["unit"]),
    points: trustedPoints
      .filter((point) => point.variable === variable)
      .sort((left, right) => left.year - right.year)
  }));
  const statusCounts = { under_review: 0, approved: 0, conflicted: 0, synchronized: 0 };
  for (const proposal of input.proposals.filter((item) => item.companyId === input.company.id)) {
    if (proposal.status in statusCounts)
      statusCounts[proposal.status as keyof typeof statusCounts] += 1;
  }
  return {
    company: input.company,
    isPilot: selectPilotCompanies(input.companies).includes(input.company.id),
    baseline: input.baseline
      ? {
          workbookVersion: input.baseline.workbookVersion,
          dataVersion: input.baseline.dataVersion,
          mappingVersion: input.baseline.mappingVersion,
          createdAt: input.baseline.createdAt,
          sha256: input.baseline.sha256
        }
      : null,
    trustedPoints,
    pendingPoints,
    financialSeries,
    qualitativePoints: trustedPoints.filter((point) =>
      qualitativeVariables.includes(point.variable as (typeof qualitativeVariables)[number])
    ),
    marketPoints: trustedPoints.filter((point) =>
      marketVariables.includes(point.variable as (typeof marketVariables)[number])
    ),
    indicators: buildIndicators(trustedPoints, years),
    years,
    statusCounts,
    suspiciousPendingCount: pendingPoints.filter((point) => point.suspiciousScale).length,
    latestTrustedYear: years.at(-1) ?? null,
    executiveSummary: summary(input.company, input.baseline, trustedPoints, pendingPoints)
  };
}

export function eventRelativeLabel(year: number, eventYear: number | null): string {
  if (eventYear === null) return String(year);
  const difference = year - eventYear;
  if (difference === 0) return `${year} · t0`;
  return `${year} · t${difference > 0 ? "+" : ""}${difference}`;
}
