import type { AuditEvent, Company, Proposal } from "@/types/domain";

export const demoCompanies: Company[] = [
  { id: "demo-cia-aurora", slug: "companhia-aurora-demo", name: "Companhia Aurora (Demo)", tier: "tier_1", sector: "Indústria fictícia", eventType: "judicial_recovery", eventYear: 2021, publicationStatus: "demo" },
  { id: "demo-varejo-horizonte", slug: "varejo-horizonte-demo", name: "Varejo Horizonte (Demo)", tier: "tier_2", sector: "Varejo fictício", eventType: "restructuring", eventYear: 2022, publicationStatus: "demo" },
  { id: "demo-logistica-atlas", slug: "logistica-atlas-demo", name: "Logística Atlas (Demo)", tier: "unclassified", sector: "Logística fictícia", eventType: "extrajudicial_recovery", eventYear: 2023, publicationStatus: "demo" }
];

export const demoProposals: Proposal[] = [
  {
    id: "proposal-demo-001", companyId: "demo-cia-aurora", year: 2020, variable: "Receita líquida",
    value: 842.4, unit: "BRL_millions", availability: "available", status: "under_review",
    createdBy: "demo-curator", createdAt: "2026-07-15T10:30:00.000Z", version: 1, publishAuthorized: true,
    notes: "Valor inteiramente fictício para demonstrar o fluxo.",
    source: { id: "source-demo-001", organization: "Fonte Fictícia SECC", title: "Demonstração financeira simulada", url: "https://example.com/secc-demo", referenceDate: "2020-12-31", collectedAt: "2026-07-15" }
  },
  {
    id: "proposal-demo-002", companyId: "demo-varejo-horizonte", year: 2024, variable: "Headcount",
    value: null, unit: "count", availability: "unavailable", status: "approved",
    createdBy: "demo-curator", createdAt: "2026-07-15T10:40:00.000Z", version: 2, publishAuthorized: true,
    notes: "Indisponibilidade fictícia já revisada.",
    source: { id: "source-demo-002", organization: "Fonte Fictícia SECC", title: "Nota metodológica simulada", url: "https://example.com/secc-demo-nd", referenceDate: "2024-12-31", collectedAt: "2026-07-15" }
  },
  {
    id: "proposal-demo-003", companyId: "demo-logistica-atlas", year: 2025, variable: "Dívida bruta",
    value: 410.2, unit: "BRL_millions", availability: "available", status: "approved",
    createdBy: "demo-curator", createdAt: "2026-07-15T10:50:00.000Z", version: 1, publishAuthorized: false,
    notes: "Aprovado internamente, mas sem autorização fictícia de publicação.",
    source: { id: "source-demo-003", organization: "Fonte Fictícia SECC", title: "Balanço simulado", url: "https://example.com/secc-demo-private", referenceDate: "2025-12-31", collectedAt: "2026-07-15" }
  }
];

export const demoAudit: AuditEvent[] = [
  { id: "audit-demo-001", action: "proposal.submitted", entityId: "proposal-demo-001", actorId: "demo-curator", occurredAt: "2026-07-15T10:30:00.000Z", previousVersion: null, resultingVersion: 1, reason: "Entrada manual de demonstração", origin: "manual" },
  { id: "audit-demo-002", action: "proposal.approved", entityId: "proposal-demo-002", actorId: "demo-reviewer", occurredAt: "2026-07-15T11:00:00.000Z", previousVersion: 1, resultingVersion: 2, reason: "Fonte e estado N/D conferidos em cenário fictício", origin: "manual" }
];
