import type { AuditEvent, Company, CompanyCoverage, Proposal, ReviewDecision, WorkbookSnapshot } from "@/types/domain";
import type { OperationalRepository } from "@/types/contracts";

export class LocalOperationalRepository implements OperationalRepository {
  private readonly coverage = new Map<string, CompanyCoverage>();
  constructor(private readonly companies: Company[] = [], private readonly proposals: Proposal[] = [], private readonly audits: AuditEvent[] = []) {}
  async listCompanies() { return structuredClone(this.companies); }
  async listCompanyDiagnostics() { return this.companies.map((company) => ({ ...structuredClone(company), coverage: structuredClone(this.coverage.get(company.id) ?? null) })); }
  async listProposals() { return structuredClone(this.proposals); }
  async listAuditEvents() { return structuredClone(this.audits).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)); }
  async createCompany(company: Company, audit: AuditEvent) {
    if (this.companies.some((item) => item.id === company.id || item.slug === company.slug)) throw new Error("Empresa já existe.");
    this.companies.push(structuredClone(company));
    this.audits.push(structuredClone(audit));
  }
  async submitProposal(proposal: Proposal, audit: AuditEvent) {
    if (this.proposals.some((item) => item.id === proposal.id)) throw new Error("Controle otimista: proposta já existe.");
    this.proposals.push(structuredClone(proposal));
    this.audits.push(structuredClone(audit));
  }
  async saveProposal(proposal: Proposal) {
    if (this.proposals.some((item) => item.id === proposal.id)) throw new Error("Controle otimista: proposta já existe.");
    this.proposals.push(structuredClone(proposal));
  }
  async decide(decision: ReviewDecision) {
    const proposal = this.proposals.find((item) => item.id === decision.proposalId);
    if (!proposal) throw new Error("Proposta não encontrada.");
    if (proposal.version !== decision.expectedVersion) throw new Error("Conflito de versão da proposta.");
    proposal.status = decision.decision === "changes_requested" ? "under_review" : decision.decision;
    proposal.version += 1;
  }
  async decideProposal(decision: ReviewDecision, audit: AuditEvent) {
    const proposal = this.proposals.find((item) => item.id === decision.proposalId);
    if (!proposal) throw new Error("Proposta não encontrada.");
    if (proposal.version !== decision.expectedVersion) throw new Error("Conflito de versão da proposta.");
    proposal.status = decision.decision === "changes_requested" ? "under_review" : decision.decision;
    proposal.version += 1;
    this.audits.push(structuredClone(audit));
  }
  async appendAudit(event: AuditEvent) { this.audits.push(structuredClone(event)); }
  async synchronizeWorkbook(snapshot: WorkbookSnapshot, audit: AuditEvent) {
    for (const record of snapshot.companies) {
      const index = this.companies.findIndex((company) => company.id === record.company.id);
      if (index >= 0) this.companies[index] = structuredClone(record.company);
      else this.companies.push(structuredClone(record.company));
      this.coverage.set(record.company.id, structuredClone(record.coverage));
    }
    this.audits.push(structuredClone(audit));
  }
  async linkCvmCompany(companyId: string, cnpj: string, cvmCode: string, audit: AuditEvent) {
    const company = this.companies.find((item) => item.id === companyId);
    if (!company) throw new Error("Empresa não encontrada para vínculo com a CVM.");
    company.cvmCnpj = cnpj;
    company.cvmCode = cvmCode;
    this.audits.push(structuredClone(audit));
  }
  async submitProposals(proposals: Proposal[], audit: AuditEvent) {
    let inserted = 0;
    for (const proposal of proposals) {
      if (proposal.externalKey && this.proposals.some((item) => item.externalKey === proposal.externalKey)) continue;
      this.proposals.push(structuredClone(proposal));
      inserted += 1;
    }
    this.audits.push(structuredClone(audit));
    return inserted;
  }
}
