import "server-only";
import type { JSONValue, TransactionSql } from "postgres";
import { getDatabase } from "@/lib/database/postgres";
import type { StructuredImportBatch, StructuredImportRow } from "@/lib/imports/contracts";
import type { AuditEvent, Proposal } from "@/types/domain";

type BatchRow = {
  id: string;
  company_id: string;
  company_name?: string;
  original_name: string;
  mime: string;
  size_bytes: number;
  sha256: string;
  row_count: number;
  valid_count: number;
  error_count: number;
  status: StructuredImportBatch["status"];
  created_by: string;
  created_at: Date;
  imported_at: Date | null;
};

type ImportRow = {
  row_number: number;
  raw_data: StructuredImportRow["raw"];
  proposal_data: Proposal | null;
  errors: string[];
};

function mapBatch(row: BatchRow): StructuredImportBatch {
  return {
    id: row.id,
    companyId: row.company_id,
    companyName: row.company_name,
    originalName: row.original_name,
    mime: row.mime,
    sizeBytes: row.size_bytes,
    sha256: row.sha256,
    rowCount: row.row_count,
    validCount: row.valid_count,
    errorCount: row.error_count,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at.toISOString(),
    importedAt: row.imported_at?.toISOString() ?? null,
  };
}

export class PostgresImportRepository {
  async createPreview(batch: StructuredImportBatch, rows: StructuredImportRow[], audit: AuditEvent): Promise<void> {
    const sql = getDatabase();
    await sql.begin(async (transaction) => {
      await transaction`
        insert into import_batches (
          id, company_id, original_name, mime, size_bytes, sha256,
          row_count, valid_count, error_count, status, created_by, created_at, imported_at
        ) values (
          ${batch.id}, ${batch.companyId}, ${batch.originalName}, ${batch.mime},
          ${batch.sizeBytes}, ${batch.sha256}, ${batch.rowCount}, ${batch.validCount},
          ${batch.errorCount}, ${batch.status}, ${batch.createdBy}, ${batch.createdAt},
          ${batch.importedAt}
        )
      `;
      for (const row of rows) {
        await transaction`
          insert into import_rows (batch_id, row_number, raw_data, proposal_data, errors)
          values (
            ${batch.id}, ${row.rowNumber}, ${transaction.json(row.raw)},
            ${row.proposal ? transaction.json(row.proposal as unknown as JSONValue) : null}, ${transaction.json(row.errors)}
          )
        `;
      }
      await this.insertAudit(transaction, audit);
    });
  }

  async getBatch(batchId: string): Promise<{ batch: StructuredImportBatch; rows: StructuredImportRow[] } | null> {
    const sql = getDatabase();
    const [batches, rows] = await Promise.all([
      sql<BatchRow[]>`
        select b.*, c.name as company_name
        from import_batches b join companies c on c.id = b.company_id
        where b.id = ${batchId}
      `,
      sql<ImportRow[]>`
        select row_number, raw_data, proposal_data, errors
        from import_rows where batch_id = ${batchId} order by row_number
      `,
    ]);
    const batch = batches[0];
    if (!batch) return null;
    return {
      batch: mapBatch(batch),
      rows: rows.map((row) => ({
        rowNumber: row.row_number,
        raw: row.raw_data,
        proposal: row.proposal_data,
        errors: row.errors,
      })),
    };
  }

  async listRecentBatches(limit = 10): Promise<StructuredImportBatch[]> {
    const rows = await getDatabase()<BatchRow[]>`
      select b.*, c.name as company_name
      from import_batches b join companies c on c.id = b.company_id
      order by b.created_at desc limit ${limit}
    `;
    return rows.map(mapBatch);
  }

  async confirmBatch(batchId: string, importedAt: string, audit: AuditEvent): Promise<{ inserted: number; skipped: number; companyId: string; alreadyImported: boolean }> {
    const sql = getDatabase();
    return sql.begin(async (transaction) => {
      const batches = await transaction<BatchRow[]>`
        select * from import_batches where id = ${batchId} for update
      `;
      const batch = batches[0];
      if (!batch) throw new Error("Lote de importação não encontrado.");
      if (batch.status === "imported") {
        return { inserted: 0, skipped: batch.valid_count, companyId: batch.company_id, alreadyImported: true };
      }
      const rows = await transaction<ImportRow[]>`
        select row_number, raw_data, proposal_data, errors
        from import_rows where batch_id = ${batchId} and proposal_data is not null
        order by row_number
      `;
      let inserted = 0;
      for (const row of rows) {
        const proposal = row.proposal_data;
        if (!proposal) continue;
        await transaction`
          insert into sources (id, organization, title, url, reference_date, collected_at)
          values (
            ${proposal.source.id}, ${proposal.source.organization}, ${proposal.source.title},
            ${proposal.source.url}, ${proposal.source.referenceDate}, ${proposal.source.collectedAt}
          )
          on conflict (id) do update set
            organization = excluded.organization, title = excluded.title, url = excluded.url,
            reference_date = excluded.reference_date, collected_at = excluded.collected_at,
            updated_at = now()
        `;
        const numericValue = typeof proposal.value === "number" ? proposal.value : null;
        const textValue = typeof proposal.value === "string" ? proposal.value : null;
        const result = await transaction<{ id: string }[]>`
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
          on conflict (external_key) do nothing returning id
        `;
        inserted += result.length;
      }
      await transaction`
        update import_batches set status = 'imported', imported_at = ${importedAt}
        where id = ${batchId}
      `;
      await this.insertAudit(transaction, audit);
      return { inserted, skipped: rows.length - inserted, companyId: batch.company_id, alreadyImported: false };
    });
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
}
