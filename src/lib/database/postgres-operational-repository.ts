import "server-only";
import type { TransactionSql } from "postgres";
import { getDatabase } from "@/lib/database/postgres";
import type { OperationalRepository } from "@/types/contracts";
import type { AuditEvent, Company, Proposal, ReviewDecision, Source } from "@/types/domain";

type CompanyRow = {
  id: string;
  slug: string;
  name: string;
  tier: Company["tier"];
  sector: string;
  event_type: Company["eventType"];
  event_year: number;
  publication_status: Company["publicationStatus"];
};

type ProposalRow = {
  id: string;
  company_id: string;
  year: number;
  variable: string;
  value_numeric: string | null;
  value_text: string | null;
  unit: Proposal["unit"];
  availability: Proposal["availability"];
  status: Proposal["status"];
  created_by: string;
  created_at: Date;
  version: number;
  notes: string | null;
  publish_authorized: boolean;
  source_id: string;
  source_organization: string;
  source_title: string;
  source_url: string;
  source_reference_date: string;
  source_collected_at: string;
};

function mapCompany(row: CompanyRow): Company {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    tier: row.tier,
    sector: row.sector,
    eventType: row.event_type,
    eventYear: row.event_year,
    publicationStatus: row.publication_status,
  };
}

function mapProposal(row: ProposalRow): Proposal {
  const value = row.value_numeric === null ? row.value_text : Number(row.value_numeric);
  return {
    id: row.id,
    companyId: row.company_id,
    year: row.year,
    variable: row.variable,
    value,
    unit: row.unit,
    availability: row.availability,
    source: {
      id: row.source_id,
      organization: row.source_organization,
      title: row.source_title,
      url: row.source_url,
      referenceDate: row.source_reference_date,
      collectedAt: row.source_collected_at,
    },
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at.toISOString(),
    version: row.version,
    notes: row.notes ?? undefined,
    publishAuthorized: row.publish_authorized,
  };
}

export class PostgresOperationalRepository implements OperationalRepository {
  async listCompanies(): Promise<Company[]> {
    const rows = await getDatabase()<CompanyRow[]>`
      select id, slug, name, tier, sector, event_type, event_year, publication_status
      from companies
      order by name
    `;
    return rows.map(mapCompany);
  }

  async listProposals(): Promise<Proposal[]> {
    const rows = await getDatabase()<ProposalRow[]>`
      select
        p.id, p.company_id, p.year, p.variable, p.value_numeric, p.value_text,
        p.unit, p.availability, p.status, p.created_by, p.created_at, p.version,
        p.notes, p.publish_authorized,
        s.id as source_id, s.organization as source_organization,
        s.title as source_title, s.url as source_url,
        s.reference_date::text as source_reference_date,
        s.collected_at::text as source_collected_at
      from proposals p
      join sources s on s.id = p.source_id
      order by p.created_at desc, p.id
    `;
    return rows.map(mapProposal);
  }

  async createCompany(company: Company, audit: AuditEvent): Promise<void> {
    const sql = getDatabase();
    try {
      await sql.begin(async (transaction) => {
        await transaction`
          insert into companies (
            id, slug, name, tier, sector, event_type, event_year, publication_status
          ) values (
            ${company.id}, ${company.slug}, ${company.name}, ${company.tier},
            ${company.sector}, ${company.eventType}, ${company.eventYear},
            ${company.publicationStatus}
          )
        `;
        await this.insertAudit(transaction, audit);
      });
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
        throw new Error("Empresa já existe.", { cause: error });
      }
      throw error;
    }
  }

  async submitProposal(proposal: Proposal, audit: AuditEvent): Promise<void> {
    const sql = getDatabase();
    try {
      await sql.begin(async (transaction) => {
        await this.saveSource(transaction, proposal.source);
        await this.insertProposal(transaction, proposal);
        await this.insertAudit(transaction, audit);
      });
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
        throw new Error("Controle otimista: proposta já existe.", { cause: error });
      }
      throw error;
    }
  }

  async saveProposal(proposal: Proposal): Promise<void> {
    const sql = getDatabase();

    try {
      await sql.begin(async (transaction) => {
        await this.saveSource(transaction, proposal.source);
        await this.insertProposal(transaction, proposal);
      });
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
        throw new Error("Controle otimista: proposta já existe.", { cause: error });
      }
      throw error;
    }
  }

  async decide(decision: ReviewDecision): Promise<void> {
    const sql = getDatabase();
    await sql.begin(async (transaction) => {
      const rows = await transaction<{ version: number }[]>`
        select version from proposals where id = ${decision.proposalId} for update
      `;
      const current = rows[0];
      if (!current) throw new Error("Proposta não encontrada.");

      const status = decision.decision === "changes_requested" ? "under_review" : decision.decision;
      const nextVersion = current.version + 1;
      await transaction`
        update proposals
        set status = ${status}, version = ${nextVersion}, updated_at = ${decision.decidedAt}
        where id = ${decision.proposalId}
      `;
      await transaction`
        insert into review_decisions (
          proposal_id, decision, justification, decided_by, decided_at,
          previous_version, resulting_version
        ) values (
          ${decision.proposalId}, ${decision.decision}, ${decision.justification},
          ${decision.decidedBy}, ${decision.decidedAt}, ${current.version}, ${nextVersion}
        )
      `;
    });
  }

  async appendAudit(event: AuditEvent): Promise<void> {
    await getDatabase()`
      insert into audit_events (
        id, action, entity_id, actor_id, occurred_at, previous_version,
        resulting_version, reason, origin
      ) values (
        ${event.id}, ${event.action}, ${event.entityId}, ${event.actorId},
        ${event.occurredAt}, ${event.previousVersion}, ${event.resultingVersion},
        ${event.reason}, ${event.origin}
      )
    `;
  }

  private async insertProposal(transaction: TransactionSql, proposal: Proposal): Promise<void> {
    const numericValue = typeof proposal.value === "number" ? proposal.value : null;
    const textValue = typeof proposal.value === "string" ? proposal.value : null;
    await transaction`
      insert into proposals (
        id, company_id, source_id, year, variable, value_numeric, value_text,
        unit, availability, status, created_by, created_at, version, notes,
        publish_authorized
      ) values (
        ${proposal.id}, ${proposal.companyId}, ${proposal.source.id}, ${proposal.year},
        ${proposal.variable}, ${numericValue}, ${textValue}, ${proposal.unit},
        ${proposal.availability}, ${proposal.status}, ${proposal.createdBy},
        ${proposal.createdAt}, ${proposal.version}, ${proposal.notes ?? null},
        ${proposal.publishAuthorized}
      )
    `;
  }

  private async insertAudit(transaction: TransactionSql, event: AuditEvent): Promise<void> {
    await transaction`
      insert into audit_events (
        id, action, entity_id, actor_id, occurred_at, previous_version,
        resulting_version, reason, origin
      ) values (
        ${event.id}, ${event.action}, ${event.entityId}, ${event.actorId},
        ${event.occurredAt}, ${event.previousVersion}, ${event.resultingVersion},
        ${event.reason}, ${event.origin}
      )
    `;
  }

  private async saveSource(
    transaction: TransactionSql,
    source: Source,
  ): Promise<void> {
    await transaction`
      insert into sources (
        id, organization, title, url, reference_date, collected_at
      ) values (
        ${source.id}, ${source.organization}, ${source.title}, ${source.url},
        ${source.referenceDate}, ${source.collectedAt}
      )
      on conflict (id) do update set
        organization = excluded.organization,
        title = excluded.title,
        url = excluded.url,
        reference_date = excluded.reference_date,
        collected_at = excluded.collected_at,
        updated_at = now()
    `;
  }
}
