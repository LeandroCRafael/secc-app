import type { DataPoint } from "@/types/domain";

export type WorkbookScalar = string | number | boolean | null;
export type WorkbookCellValue = WorkbookScalar | { formula: string; result: WorkbookScalar };
export type WorkbookSyncStatus = "prepared" | "blocked" | "applied" | "failed";
export type WorkbookSyncItemStatus = "ready" | "unchanged" | "conflict" | "unmapped" | "applied" | "kept_excel" | "imported";
export type WorkbookSyncResolution = "use_app" | "keep_excel";

export interface WorkbookSnapshotCell {
  cellKey: string;
  sheetName: string;
  cellAddress: string;
  companyId: string;
  year: number;
  variable: string;
  unit: DataPoint["unit"];
  value: WorkbookCellValue;
  cellHash: string;
}

export interface WorkbookSyncItem {
  id?: number;
  batchId: string;
  proposalId: string | null;
  proposalVersion: number | null;
  direction: "app_to_excel" | "excel_to_app";
  companyId: string;
  companyName?: string;
  year: number;
  variable: string;
  unit: DataPoint["unit"];
  sheetName: string | null;
  cellAddress: string | null;
  previousValue: WorkbookCellValue;
  proposedValue: WorkbookCellValue;
  status: WorkbookSyncItemStatus;
  resolution: WorkbookSyncResolution | null;
  message: string;
}

export interface WorkbookSyncBatch {
  id: string;
  idempotencyKey: string;
  workbookId: string;
  sourceSnapshotId: string;
  status: WorkbookSyncStatus;
  mappingVersion: string;
  sourceWorkbookVersion: string;
  resultWorkbookVersion: string;
  sourceSha256: string;
  resultSha256: string | null;
  approvedCount: number;
  readyCount: number;
  conflictCount: number;
  unmappedCount: number;
  unchangedCount: number;
  excelChangeCount: number;
  requestedBy: string;
  requestedAt: string;
  appliedBy: string | null;
  appliedAt: string | null;
  outputFileName: string | null;
  backupFileName: string;
  failureReason: string | null;
}

export interface WorkbookSnapshot {
  id: string;
  workbookId: string;
  originalName: string;
  sizeBytes: number;
  sha256: string;
  workbookVersion: string;
  dataVersion: number;
  mappingVersion: string;
  kind: "source" | "result";
  syncBatchId: string | null;
  createdBy: string;
  createdAt: string;
  cells: WorkbookSnapshotCell[];
}

export interface WorkbookSyncPreview {
  batch: WorkbookSyncBatch;
  sourceSnapshot: WorkbookSnapshot;
  items: WorkbookSyncItem[];
  hasBaseline: boolean;
  versionConflict: string | null;
}

export interface WorkbookSyncApplication {
  workbook: Buffer;
  resultSha256: string;
  resultSnapshot: WorkbookSnapshot;
  appliedProposalIds: string[];
  keptExcelProposalIds: string[];
  excelChangeItems: WorkbookSyncItem[];
}
