import "server-only";
import type { TransactionSql } from "postgres";
import { getDatabase } from "@/lib/database/postgres";
import type { OperationalRepository } from "@/types/contracts";
import type { AuditEvent, Company, CompanyCoverage, CompanyDiagnostic, Proposal, ReviewDecision, Source, WorkbookSnapshot } from "@/types/domain";

type CompanyRow = {
  id: string;
  slug: string;
  name: string;
  tier: Company["tier"];
  sector: string;
  event_type: Company["eventType"];
  event_year: number | null;
  publication_status: Company["publicationStatus"];
  workbook_row: number | null;
  company_type: string | null;
  reference_code: string | null;
  collection_start_year: number | null;
  collection_end_year: number | null;
  workbook_status: string | null;
  workbook_completion: string | null;
  cvm_cnpj: string | null;
  cvm_code: string | null;
  source_workbook_hash: string | null;
  coverage_updated_at: Date | null;
};

type DiagnosticRow = CompanyRow & {
  financial_filled: number | null;
  financial_expected: number | null;
  qualitative_filled: number | null;
  qualitative_expected: number | null;
  market_filled: number | null;
  market_expected: number | null;
  researched_years: number | null;
  total_years: number | null;
  last_data_year: number | null;
  workbook_hash: string | null;
  calculated_at: Date | null;
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
  external_key: string | null;
};

type AuditRow = {
  id: string;
  action: string;
  entity_id: string;
  actor_id: string;
  occurred_at: Date;
  previous_version: number | null;
  resulting_version: number;
  reason: string;
  origin: AuditEvent["origin"];
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
    workbookRow: row.workbook_row,
    companyType: row.company_type,
    referenceCode: row.reference_code,
    collectionStartYear: row.collection_start_year,
    collectionEndYear: row.collection_end_year,
    workbookStatus: row.workbook_status,
    workbookCompletion: row.workbook_completion === null ? null : Number(row.workbook_completion),
    cvmCnpj: row.cvm_cnpj,
    cvmCode: row.cvm_code,
    sourceWorkbookHash: row.source_workbook_hash,
    coverageUpdatedAt: row.coverage_updated_at?.toISOString() ?? null,
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
    externalKey: row.external_key ?? undefined,
  };
}

const companyColumns = `
  c.id, c.slug, c.name, c.tier, c.sector, c.event_type, c.event_year,
  c.publication_status, c.workbook_row, c.company_type, c.reference_code,
  c.collection_start_year, c.collection_end_year, c.workbook_status,
  c.workbook_completion, c.cvm_cnpj, c.cvm_code, c.source_workbook_hash,
  c.coverage_updated_at
`;

export class PostgresOperationalRepository implements OperationalRepository {
  async listCompanies(): Promise<Company[]> {
    const rows = await getDatabase()<CompanyRow[]>`
      select ${getDatabase().unsafe(companyColumns)}
      from companies c
      order by c.name
    `;
    return rows.map(mapCompany);
  }

  async listCompanyDiagnostics(): Promise<CompanyDiagnostic[]> {
    const rows = await getDatabase()<DiagnosticRow[]>`
      select ${getDatabase().unsafe(companyColumns)},
        cv.financial_filled, cv.financial_expected, cv.qualitative_filled,
        cv.qualitative_expected, cv.market_filled, cv.market_expected,
        cv.researched_years, cv.total_years, cv.last_data_year,
        cv.workbook_hash, cv.calculated_at
      from companies c
      left join company_coverage cv on cv.company_id = c.id
      order by c.name
    `;
    return rows.map((row) => ({
      ...mapCompany(row),
      coverage: row.calculated_at === null ? null : {
        companyId: row.id,
        financialFilled: row.financial_filled ?? 0,
        financialExpected: row.financial_expected ?? 0,
        qualitativeFilled: row.qualitative_filled ?? 0,
        qualitativeExpected: row.qualitative_expected ?? 0,
        marketFilled: row.market_filled ?? 0,
        marketExpected: row.market_expected ?? 0,
        researchedYears: row.researched_years ?? 0,
        totalYears: row.total_years ?? 0,
        lastDataYear: row.last_data_year,
        workbookHash: row.workbook_hash ?? "",
        calculatedAt: row.calculated_at.toISOString(),
      },
    }));
  }

  async listProposals(): Promise<Proposal[]> {
    const rows = await getDatabase()<ProposalRow[]>`
      select
        p.id, p.company_id, p.year, p.variable, p.value_numeric, p.value_text,
        p.unit, p.availability, p.status, p.created_by, p.created_at, p.version,
        p.notes, p.publish_authorized, p.external_key,
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

  async listAuditEvents(): Promise<AuditEvent[]> {
    const rows = await getDatabase()<AuditRow[]>`
      select id, action, entity_id, actor_id, occurred_at, previous_version,
        resulting_version, reason, origin
      from audit_events
      order by occurred_at desc, id desc
    `;
    return rows.map((row) => ({
      id: row.id,
      action: row.action,
      entityId: row.entity_id,
      actorId: row.actor_id,
      occurredAt: row.occurred_at.toISOString(),
      previousVersion: row.previous_version,
      resultingVersion: row.resulting_version,
      reason: row.reason,
      origin: row.origin,
    }));
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
      await this.applyDecision(transaction, decision);
    });
  }

  async decideProposal(decision: ReviewDecision, audit: AuditEvent): Promise<void> {
    const sql = getDatabase();
    await sql.begin(async (transaction) => {
      const versions = await this.applyDecision(transaction, decision);
      if (
        audit.entityId !== decision.proposalId ||
        audit.previousVersion !== versions.previous ||
        audit.resultingVersion !== versions.resulting
      ) {
        throw new Error("Evento de auditoria incompatível com a decisão.");
      }
      await this.insertAudit(transaction, audit);
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

  async synchronizeWorkbook(snapshot: WorkbookSnapshot, audit: AuditEvent): Promise<void> {
    const sql = getDatabase();
    await sql.begin(async (transaction) => {
      for (const { company, coverage } of snapshot.companies) {
        await transaction`
          insert into companies (
            id, slug, name, tier, sector, event_type, event_year, publication_status,
            workbook_row, company_type, reference_code, collection_start_year,
            collection_end_year, workbook_status, workbook_completion,
            source_workbook_hash, coverage_updated_at
          ) values (
            ${company.id}, ${company.slug}, ${company.name}, ${company.tier},
            ${company.sector}, ${company.eventType}, ${company.eventYear},
            ${company.publicationStatus}, ${company.workbookRow ?? null},
            ${company.companyType ?? null}, ${company.referenceCode ?? null},
            ${company.collectionStartYear ?? null}, ${company.collectionEndYear ?? null},
            ${company.workbookStatus ?? null}, ${company.workbookCompletion ?? null},
            ${snapshot.hash}, ${snapshot.calculatedAt}
          )
          on conflict (id) do update set
            slug = excluded.slug, name = excluded.name, tier = excluded.tier,
            sector = excluded.sector, event_type = excluded.event_type,
            event_year = excluded.event_year, workbook_row = excluded.workbook_row,
            company_type = excluded.company_type, reference_code = excluded.reference_code,
            collection_start_year = excluded.collection_start_year,
            collection_end_year = excluded.collection_end_year,
            workbook_status = excluded.workbook_status,
            workbook_completion = excluded.workbook_completion,
            source_workbook_hash = excluded.source_workbook_hash,
            coverage_updated_at = excluded.coverage_updated_at,
            updated_at = now()
        `;
        await this.upsertCoverage(transaction, coverage);
      }
      await this.insertAudit(transaction, audit);
    });
  }

  async linkCvmCompany(companyId: string, cnpj: string, cvmCode: string, audit: AuditEvent): Promise<void> {
    const sql = getDatabase();
    await sql.begin(async (transaction) => {
      const rows = await transaction<{ id: string }[]>`
        update companies set cvm_cnpj = ${cnpj}, cvm_code = ${cvmCode}, updated_at = now()
        where id = ${companyId}
        returning id
      `;
      if (!rows[0]) throw new Error("Empresa não encontrada para vínculo com a CVM.");
      await this.insertAudit(transaction, audit);
    });
  }

  async submitProposals(proposals: Proposal[], audit: AuditEvent): Promise<number> {
    const sql = getDatabase();
    return sql.begin(async (transaction) => {
      let inserted = 0;
      for (const proposal of proposals) {
        await this.saveSource(transaction, proposal.source);
        const numericValue = typeof proposal.value === "number" ? proposal.value : null;
        const textValue = typeof proposal.value === "string" ? proposal.value : null;
        const rows = await transaction<{ id: string }[]>`
          insert into proposals (
            id, company_id, source_id, year, variable, value_numeric, value_text,
            unit, availability, status, created_by, created_at, version, notes,
            publish_authorized, external_key
          ) values (
            ${proposal.id}, ${proposal.companyId}, ${proposal.source.id}, ${proposal.year},
            ${proposal.variable}, ${numericValue}, ${textValue}, ${proposal.unit},
            ${proposal.availability}, ${proposal.status}, ${proposal.createdBy},
            ${proposal.createdAt}, ${proposal.version}, ${proposal.notes ?? null},
            ${proposal.publishAuthorized}, ${proposal.externalKey ?? null}
          )
          on conflict (external_key) do update set
            source_id = excluded.source_id,
            value_numeric = excluded.value_numeric,
            value_text = excluded.value_text,
            unit = excluded.unit,
            availability = excluded.availability,
            status = 'under_review',
            created_by = excluded.created_by,
            version = proposals.version + 1,
            notes = excluded.notes,
            publish_authorized = false,
            updated_at = excluded.created_at
          where proposals.status in ('submitted', 'under_review', 'conflicted')
          returning id
        `;
        inserted += rows.length;
      }
      await this.insertAudit(transaction, audit);
      return inserted;
    });
  }

  private async insertProposal(transaction: TransactionSql, proposal: Proposal): Promise<void> {
    const numericValue = typeof proposal.value === "number" ? proposal.value : null;
    const textValue = typeof proposal.value === "string" ? proposal.value : null;
    await transaction`
      insert into proposals (
        id, company_id, source_id, year, variable, value_numeric, value_text,
        unit, availability, status, created_by, created_at, version, notes,
        publish_authorized, external_key
      ) values (
        ${proposal.id}, ${proposal.companyId}, ${proposal.source.id}, ${proposal.year},
        ${proposal.variable}, ${numericValue}, ${textValue}, ${proposal.unit},
        ${proposal.availability}, ${proposal.status}, ${proposal.createdBy},
        ${proposal.createdAt}, ${proposal.version}, ${proposal.notes ?? null},
        ${proposal.publishAuthorized}, ${proposal.externalKey ?? null}
      )
    `;
  }

  private async upsertCoverage(transaction: TransactionSql, coverage: CompanyCoverage): Promise<void> {
    await transaction`
      insert into company_coverage (
        company_id, financial_filled, financial_expected, qualitative_filled,
        qualitative_expected, market_filled, market_expected, researched_years,
        total_years, last_data_year, workbook_hash, calculated_at
      ) values (
        ${coverage.companyId}, ${coverage.financialFilled}, ${coverage.financialExpected},
        ${coverage.qualitativeFilled}, ${coverage.qualitativeExpected},
        ${coverage.marketFilled}, ${coverage.marketExpected}, ${coverage.researchedYears},
        ${coverage.totalYears}, ${coverage.lastDataYear}, ${coverage.workbookHash},
        ${coverage.calculatedAt}
      )
      on conflict (company_id) do update set
        financial_filled = excluded.financial_filled,
        financial_expected = excluded.financial_expected,
        qualitative_filled = excluded.qualitative_filled,
        qualitative_expected = excluded.qualitative_expected,
        market_filled = excluded.market_filled,
        market_expected = excluded.market_expected,
        researched_years = excluded.researched_years,
        total_years = excluded.total_years,
        last_data_year = excluded.last_data_year,
        workbook_hash = excluded.workbook_hash,
        calculated_at = excluded.calculated_at
    `;
  }

  private async applyDecision(
    transaction: TransactionSql,
    decision: ReviewDecision,
  ): Promise<{ previous: number; resulting: number }> {
    const rows = await transaction<{ version: number }[]>`
      select version from proposals where id = ${decision.proposalId} for update
    `;
    const current = rows[0];
    if (!current) throw new Error("Proposta não encontrada.");
    if (current.version !== decision.expectedVersion) throw new Error("Conflito de versão da proposta.");

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
    return { previous: current.version, resulting: nextVersion };
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
