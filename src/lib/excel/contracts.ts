import type { Proposal } from "@/types/domain";

export interface SyncRequest {
  syncBatchId: string;
  idempotencyKey: string;
  workbookId: string;
  sourceWorkbookVersion: string;
  currentWorkbookVersion: string;
  mappingVersion: string;
  approvedProposals: Proposal[];
}

export interface SyncPreview {
  status: "prepared" | "blocked" | "duplicate";
  backupPlanned: boolean;
  affectedCells: string[];
  conflicts: string[];
  message: string;
}

export interface ExcelAdapter {
  preview(request: SyncRequest): Promise<SyncPreview>;
}
