import { describe, expect, it } from "vitest";
import { LocalOperationalRepository } from "@/lib/database/local-operational-repository";
import type { AuditEvent, Proposal, ReviewDecision } from "@/types/domain";

const proposal: Proposal = {
  id: "proposal-test",
  companyId: "company-test",
  year: 2024,
  variable: "Receita líquida",
  value: 100,
  unit: "BRL_millions",
  availability: "available",
  source: {
    id: "source-test",
    organization: "Fonte Teste",
    title: "Documento de teste",
    url: "https://example.com/teste",
    referenceDate: "2024-12-31",
    collectedAt: "2026-07-15",
  },
  status: "under_review",
  createdBy: "admin-test",
  createdAt: "2026-07-15T12:00:00.000Z",
  version: 1,
  publishAuthorized: false,
};

const decision: ReviewDecision = {
  proposalId: proposal.id,
  expectedVersion: 1,
  decision: "approved",
  justification: "Fonte e período conferidos.",
  decidedBy: "admin-test",
  decidedAt: "2026-07-15T13:00:00.000Z",
};

const audit: AuditEvent = {
  id: "audit-test",
  action: "proposal.approved",
  entityId: proposal.id,
  actorId: "admin-test",
  occurredAt: decision.decidedAt,
  previousVersion: 1,
  resultingVersion: 2,
  reason: decision.justification,
  origin: "manual",
};

describe("LocalOperationalRepository review transaction", () => {
  it("atualiza status e versão junto com a auditoria", async () => {
    const repository = new LocalOperationalRepository([], [structuredClone(proposal)], []);
    await repository.decideProposal(decision, audit);

    const [updated] = await repository.listProposals();
    expect(updated).toMatchObject({ status: "approved", version: 2 });
    expect(await repository.listAuditEvents()).toEqual([audit]);
  });

  it("bloqueia decisão baseada em versão desatualizada", async () => {
    const repository = new LocalOperationalRepository([], [{ ...structuredClone(proposal), version: 2 }], []);
    await expect(repository.decideProposal(decision, audit)).rejects.toThrow("Conflito de versão");
    expect(await repository.listAuditEvents()).toHaveLength(0);
  });
});
