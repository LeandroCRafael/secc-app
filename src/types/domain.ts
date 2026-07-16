export const availabilityStates = [
  "available",
  "not_researched",
  "unavailable",
  "not_applicable",
  "future_period",
  "withheld",
  "under_review",
  "conflicted",
  "rejected"
] as const;

export type AvailabilityState = (typeof availabilityStates)[number];
export type Role = "public" | "curator" | "reviewer" | "admin";
export type WorkflowStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "rejected"
  | "synchronized"
  | "published"
  | "conflicted";

export interface Source {
  id: string;
  organization: string;
  title: string;
  url: string;
  referenceDate: string;
  collectedAt: string;
}

export interface DataPoint {
  id: string;
  companyId: string;
  year: number;
  variable: string;
  value: number | string | null;
  unit: "BRL_millions" | "percent" | "count" | "text";
  availability: AvailabilityState;
  sourceId: string | null;
  validationStatus: WorkflowStatus;
}

export interface Company {
  id: string;
  slug: string;
  name: string;
  tier: "tier_1" | "tier_2" | "unclassified";
  sector: string;
  eventType: "judicial_recovery" | "extrajudicial_recovery" | "bankruptcy" | "restructuring";
  eventYear: number | null;
  publicationStatus: "demo" | "published" | "private";
  workbookRow?: number | null;
  companyType?: string | null;
  referenceCode?: string | null;
  collectionStartYear?: number | null;
  collectionEndYear?: number | null;
  workbookStatus?: string | null;
  workbookCompletion?: number | null;
  cvmCnpj?: string | null;
  cvmCode?: string | null;
  sourceWorkbookHash?: string | null;
  coverageUpdatedAt?: string | null;
}

export interface CompanyCoverage {
  companyId: string;
  financialFilled: number;
  financialExpected: number;
  qualitativeFilled: number;
  qualitativeExpected: number;
  marketFilled: number;
  marketExpected: number;
  researchedYears: number;
  totalYears: number;
  lastDataYear: number | null;
  workbookHash: string;
  calculatedAt: string;
}

export interface CompanyDiagnostic extends Company {
  coverage: CompanyCoverage | null;
}

export interface WorkbookSnapshot {
  hash: string;
  sourceName: string;
  calculatedAt: string;
  companies: Array<{ company: Company; coverage: CompanyCoverage }>;
}

export interface Proposal {
  id: string;
  companyId: string;
  year: number;
  variable: string;
  value: number | string | null;
  unit: DataPoint["unit"];
  availability: AvailabilityState;
  source: Source;
  status: WorkflowStatus;
  createdBy: string;
  createdAt: string;
  version: number;
  notes?: string;
  publishAuthorized: boolean;
  externalKey?: string;
}

export interface ReviewDecision {
  proposalId: string;
  expectedVersion: number;
  decision: "approved" | "rejected" | "changes_requested";
  justification: string;
  decidedBy: string;
  decidedAt: string;
}

export interface AuditEvent {
  id: string;
  action: string;
  entityId: string;
  actorId: string;
  occurredAt: string;
  previousVersion: number | null;
  resultingVersion: number;
  reason: string;
  origin: "manual" | "upload" | "excel" | "system";
}
