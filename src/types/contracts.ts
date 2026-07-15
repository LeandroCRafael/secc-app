import type { AuditEvent, Company, Proposal, ReviewDecision } from "./domain";

export interface OperationalRepository {
  listCompanies(): Promise<Company[]>;
  listProposals(): Promise<Proposal[]>;
  listAuditEvents(): Promise<AuditEvent[]>;
  createCompany(company: Company, audit: AuditEvent): Promise<void>;
  submitProposal(proposal: Proposal, audit: AuditEvent): Promise<void>;
  saveProposal(proposal: Proposal): Promise<void>;
  decide(decision: ReviewDecision): Promise<void>;
  decideProposal(decision: ReviewDecision, audit: AuditEvent): Promise<void>;
  appendAudit(event: AuditEvent): Promise<void>;
}

export interface PublicationRelease {
  id: string;
  version: string;
  generatedAt: string;
  proposals: Proposal[];
  limitations: string[];
}

export interface PublicationRepository {
  preview(proposals: Proposal[]): PublicationRelease;
}

export interface FileAssetMetadata {
  id: string;
  originalName: string;
  internalName: string;
  mime: string;
  size: number;
  sha256: string;
  visibility: "private";
  status: "quarantined" | "validated" | "rejected";
}

export interface StorageAdapter {
  putPrivate(input: Uint8Array, metadata: Omit<FileAssetMetadata, "sha256">): Promise<FileAssetMetadata>;
}
