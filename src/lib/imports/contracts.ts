import type { Proposal } from "@/types/domain";

export type ImportBatchStatus = "previewed" | "imported";

export interface StructuredImportBatch {
  id: string;
  companyId: string;
  companyName?: string;
  originalName: string;
  mime: string;
  sizeBytes: number;
  sha256: string;
  rowCount: number;
  validCount: number;
  errorCount: number;
  status: ImportBatchStatus;
  createdBy: string;
  createdAt: string;
  importedAt: string | null;
}

export interface StructuredImportRow {
  rowNumber: number;
  raw: Record<string, string | number | null>;
  proposal: Proposal | null;
  errors: string[];
}

export interface StructuredImportPreview {
  sha256: string;
  rows: StructuredImportRow[];
  validCount: number;
  errorCount: number;
}
