import "server-only";
import { createHash, randomUUID } from "node:crypto";
import type { JSONValue, TransactionSql } from "postgres";
import { getDatabase } from "@/lib/database/postgres";
import type {
  WorkbookCellValue,
  WorkbookSnapshot,
  WorkbookSnapshotCell,
  WorkbookSyncApplication,
  WorkbookSyncBatch,
  WorkbookSyncItem,
  WorkbookSyncPreview,
  WorkbookSyncResolution,
} from "@/lib/excel/sync-contracts";
import type { AuditEvent, DataPoint, Proposal } from "@/types/domain";

type SnapshotRow = {
  id: string;
  workbook_id: string;
  original_name: string;
  size_bytes: number;
  sha256: string;
  workbook_version: string;
  data_version: number;
  mapping_version: string;
  kind: WorkbookSnapshot["kind"];
  sync_batch_id: string | null;
  created_by: string;
  created_at: Date;
};

type CellRow = {
  cell_key: string;
  sheet_name: string;
  cell_address: string;
  company_id: string;
  year: number;
  variable: string;
  unit: DataPoint["unit"];
  value_json: WorkbookCellValue;
  cell_hash: string;
};

type BatchRow = {
  id: string;
  idempotency_key: string;
  workbook_id: string;
  source_snapshot_id: string;
  status: WorkbookSyncBatch["status"];
  mapping_version: string;
  source_workbook_version: string;
  result_workbook_version: string;
  source_sha256: string;
  result_sha256: string | null;
  approved_count: number;
  ready_count: number;
  conflict_count: number;
  unmapped_count: number;
  unchanged_count: number;
  excel_change_count: number;
  requested_by: string;
  requested_at: Date;
  applied_by: string | null;
  applied_at: Date | null;
  output_file_name: string | null;
  backup_file_name: string;
  failure_reason: string | null;
};

type ItemRow = {
  id: number;
  batch_id: string;
  proposal_id: string | null;
  proposal_version: number | null;
  direction: WorkbookSyncItem["direction"];
  company_id: string;
  company_name?: string;
  year: number;
  variable: string;
  unit: DataPoint["unit"];
  sheet_name: string | null;
  cell_address: string | null;
  previous_value: WorkbookCellValue;
  proposed_value: WorkbookCellValue;
  status: WorkbookSyncItem["status"];
  resolution: WorkbookSyncResolution | null;
  message: string;
};

function mapBatch(row: BatchRow): WorkbookSyncBatch {
  return {
    id: row.id,
    idempotencyKey: row.idempotency_key,
    workbookId: row.workbook_id,
    sourceSnapshotId: row.source_snapshot_id,
    status: row.status,
    mappingVersion: row.mapping_version,
    sourceWorkbookVersion: row.source_workbook_version,
    resultWorkbookVersion: row.result_workbook_version,
    sourceSha256: row.source_sha256,
    resultSha256: row.result_sha256,
    approvedCount: row.approved_count,
    readyCount: row.ready_count,
    conflictCount: row.conflict_count,
    unmappedCount: row.unmapped_count,
    unchangedCount: row.unchanged_count,
    excelChangeCount: row.excel_change_count,
    requestedBy: row.requested_by,
    requestedAt: row.requested_at.toISOString(),
    appliedBy: row.applied_by,
    appliedAt: row.applied_at?.toISOString() ?? null,
    outputFileName: row.output_file_name,
    backupFileName: row.backup_file_name,
    failureReason: row.failure_reason,
  };
}

function mapItem(row: ItemRow): WorkbookSyncItem {
  return {
    id: row.id,
    batchId: row.batch_id,
    proposalId: row.proposal_id,
    proposalVersion: row.proposal_version,
    direction: row.direction,
    companyId: row.company_id,
    companyName: row.company_name,
    year: row.year,
    variable: row.variable,
    unit: row.unit,
    sheetName: row.sheet_name,
    cellAddress: row.cell_address,
    previousValue: row.previous_value,
    proposedValue: row.proposed_value,
    status: row.status,
    resolution: row.resolution,
    message: row.message,
  };
}

function mapSnapshot(row: SnapshotRow, cells: WorkbookSnapshotCell[]): WorkbookSnapshot {
  return {
    id: row.id,
    workbookId: row.workbook_id,
    originalName: row.original_name,
    sizeBytes: row.size_bytes,
    sha256: row.sha256,
    workbookVersion: row.workbook_version,
    dataVersion: row.data_version,
    mappingVersion: row.mapping_version,
    kind: row.kind,
    syncBatchId: row.sync_batch_id,
    createdBy: row.created_by,
    createdAt: row.created_at.toISOString(),
    cells,
  };
}

function mapCell(row: CellRow): WorkbookSnapshotCell {
  return {
    cellKey: row.cell_key,
    sheetName: row.sheet_name,
    cellAddress: row.cell_address,
    companyId: row.company_id,
    year: row.year,
    variable: row.variable,
    unit: row.unit,
    value: row.value_json,
    cellHash: row.cell_hash,
  };
}

function json(value: unknown): JSONValue {
  return value as JSONValue;
}

export class PostgresWorkbookSyncRepository {
  async getLatestResultSnapshot(workbookId: string): Promise<WorkbookSnapshot | null> {
    const sql = getDatabase();
    const rows = await sql<SnapshotRow[]>`
      select * from workbook_snapshots
      where workbook_id = ${workbookId} and kind = 'result'
      order by created_at desc limit 1
    `;
    const snapshot = rows[0];
    if (!snapshot) return null;
    const cells = await sql<CellRow[]>`
      select cell_key, sheet_name, cell_address, company_id, year, variable, unit, value_json, cell_hash
      from workbook_snapshot_cells where snapshot_id = ${snapshot.id}
      order by cell_key
    `;
    return mapSnapshot(snapshot, cells.map(mapCell));
  }

  async createPreview(preview: WorkbookSyncPreview, audit: AuditEvent): Promise<{ preview: WorkbookSyncPreview; reused: boolean }> {
    const sql = getDatabase();
    const reused = await sql.begin(async (transaction) => {
      await this.insertSnapshot(transaction, { ...preview.sourceSnapshot, syncBatchId: null });
      const inserted = await transaction<{ id: string }[]>`
        insert into workbook_sync_batches (
          id, idempotency_key, workbook_id, source_snapshot_id, status, mapping_version,
          source_workbook_version, result_workbook_version, source_sha256, result_sha256,
          approved_count, ready_count, conflict_count, unmapped_count, unchanged_count,
          excel_change_count, requested_by, requested_at, applied_by, applied_at,
          output_file_name, backup_file_name, failure_reason
        ) values (
          ${preview.batch.id}, ${preview.batch.idempotencyKey}, ${preview.batch.workbookId},
          ${preview.batch.sourceSnapshotId}, ${preview.batch.status}, ${preview.batch.mappingVersion},
          ${preview.batch.sourceWorkbookVersion}, ${preview.batch.resultWorkbookVersion},
          ${preview.batch.sourceSha256}, ${preview.batch.resultSha256}, ${preview.batch.approvedCount},
          ${preview.batch.readyCount}, ${preview.batch.conflictCount}, ${preview.batch.unmappedCount},
          ${preview.batch.unchangedCount}, ${preview.batch.excelChangeCount},
          ${preview.batch.requestedBy}, ${preview.batch.requestedAt}, ${preview.batch.appliedBy},
          ${preview.batch.appliedAt}, ${preview.batch.outputFileName}, ${preview.batch.backupFileName},
          ${preview.batch.failureReason}
        ) on conflict (idempotency_key) do nothing returning id
      `;
      if (inserted.length === 0) return true;
      await transaction`
        update workbook_snapshots set sync_batch_id = ${preview.batch.id}
        where id = ${preview.sourceSnapshot.id}
      `;
      await this.insertItems(transaction, preview.items);
      await this.insertAudit(transaction, audit);
      return false;
    });
    const stored = await this.getBatch(preview.batch.idempotencyKey, true);
    if (!stored) throw new Error("A prévia de sincronização não pôde ser recuperada.");
    return { preview: { ...stored, sourceSnapshot: { ...preview.sourceSnapshot, cells: [] } }, reused };
  }

  async getBatch(idOrIdempotencyKey: string, byIdempotency = false): Promise<WorkbookSyncPreview | null> {
    const sql = getDatabase();
    const rows = byIdempotency
      ? await sql<BatchRow[]>`select * from workbook_sync_batches where idempotency_key = ${idOrIdempotencyKey}`
      : await sql<BatchRow[]>`select * from workbook_sync_batches where id = ${idOrIdempotencyKey}`;
    const row = rows[0];
    if (!row) return null;
    const [items, snapshots] = await Promise.all([
      sql<ItemRow[]>`
        select i.*, c.name as company_name
        from workbook_sync_items i join companies c on c.id = i.company_id
        where i.batch_id = ${row.id} order by i.direction, i.id
      `,
      sql<SnapshotRow[]>`select * from workbook_snapshots where id = ${row.source_snapshot_id}`,
    ]);
    const source = snapshots[0];
    if (!source) throw new Error("Snapshot de origem não localizado.");
    return {
      batch: mapBatch(row),
      sourceSnapshot: mapSnapshot(source, []),
      items: items.map(mapItem),
      hasBaseline: source.workbook_version.startsWith("secc-d"),
      versionConflict: row.status === "blocked" && row.failure_reason?.includes("diverge") ? row.failure_reason : null,
    };
  }

  async listRecentBatches(limit = 10): Promise<WorkbookSyncBatch[]> {
    const rows = await getDatabase()<BatchRow[]>`
      select * from workbook_sync_batches order by requested_at desc limit ${limit}
    `;
    return rows.map(mapBatch);
  }

  async applyBatch(input: {
    batchId: string;
    application: WorkbookSyncApplication;
    resolutions: Record<string, WorkbookSyncResolution>;
    actorId: string;
    appliedAt: string;
  }): Promise<{ alreadyApplied: boolean; importedExcelProposals: number }> {
    const sql = getDatabase();
    return sql.begin(async (transaction) => {
      const rows = await transaction<BatchRow[]>`
        select * from workbook_sync_batches where id = ${input.batchId} for update
      `;
      const batch = rows[0];
      if (!batch) throw new Error("Lote de sincronização não encontrado.");
      if (batch.status === "applied") return { alreadyApplied: true, importedExcelProposals: batch.excel_change_count };
      if (batch.status === "blocked") throw new Error(batch.failure_reason ?? "Lote bloqueado.");
      const items = await transaction<ItemRow[]>`
        select * from workbook_sync_items where batch_id = ${batch.id} order by id for update
      `;
      let importedExcelProposals = 0;
      for (const item of items) {
        if (item.direction === "app_to_excel") {
          if (!item.proposal_id || item.proposal_version === null) throw new Error("Item do app sem proposta versionada.");
          const resolution = item.status === "conflict" ? input.resolutions[item.proposal_id] : null;
          if (item.status === "conflict" && !resolution) throw new Error(`Conflito ${item.proposal_id} sem resolução.`);
          if (resolution === "keep_excel") {
            importedExcelProposals += await this.insertExcelProposal(transaction, item, batch, input.actorId, input.appliedAt);
            await transaction`update workbook_sync_items set status = 'kept_excel', resolution = 'keep_excel' where id = ${item.id}`;
            continue;
          }
          const updated = await transaction<{ version: number }[]>`
            update proposals set status = 'synchronized', version = version + 1,
              last_sync_batch_id = ${batch.id}, synchronized_at = ${input.appliedAt}, updated_at = ${input.appliedAt}
            where id = ${item.proposal_id} and status = 'approved' and version = ${item.proposal_version}
            returning version
          `;
          const proposal = updated[0];
          if (!proposal) throw new Error(`A proposta ${item.proposal_id} mudou após a prévia.`);
          await this.insertAudit(transaction, {
            id: randomUUID(), action: "proposal.synchronized", entityId: item.proposal_id,
            actorId: input.actorId, occurredAt: input.appliedAt,
            previousVersion: item.proposal_version, resultingVersion: proposal.version,
            reason: `Aplicada no lote ${batch.id} em ${item.sheet_name ?? "célula já reconciliada"}!${item.cell_address ?? "N/D"}.`,
            origin: "excel",
          });
          await transaction`
            update workbook_sync_items set status = 'applied', resolution = ${resolution === "use_app" ? "use_app" : null}
            where id = ${item.id}
          `;
        } else if (item.status === "ready") {
          importedExcelProposals += await this.insertExcelProposal(transaction, item, batch, input.actorId, input.appliedAt);
          await transaction`update workbook_sync_items set status = 'imported' where id = ${item.id}`;
        }
      }

      await this.insertSnapshot(transaction, input.application.resultSnapshot);
      await transaction`
        update workbook_sync_batches set status = 'applied', result_sha256 = ${input.application.resultSha256},
          applied_by = ${input.actorId}, applied_at = ${input.appliedAt}, failure_reason = null
        where id = ${batch.id}
      `;
      await this.insertAudit(transaction, {
        id: randomUUID(), action: "excel.sync.applied", entityId: batch.id,
        actorId: input.actorId, occurredAt: input.appliedAt,
        previousVersion: null, resultingVersion: 1,
        reason: `${input.application.appliedProposalIds.length} proposta(s) sincronizadas; ${importedExcelProposals} alteração(ões) do Excel enviada(s) à revisão.`,
        origin: "excel",
      });
      return { alreadyApplied: false, importedExcelProposals };
    });
  }

  private async insertSnapshot(transaction: TransactionSql, snapshot: WorkbookSnapshot): Promise<void> {
    await transaction`
      insert into workbook_snapshots (
        id, workbook_id, original_name, size_bytes, sha256, workbook_version,
        data_version, mapping_version, kind, sync_batch_id, created_by, created_at
      ) values (
        ${snapshot.id}, ${snapshot.workbookId}, ${snapshot.originalName}, ${snapshot.sizeBytes},
        ${snapshot.sha256}, ${snapshot.workbookVersion}, ${snapshot.dataVersion},
        ${snapshot.mappingVersion}, ${snapshot.kind}, ${snapshot.syncBatchId},
        ${snapshot.createdBy}, ${snapshot.createdAt}
      ) on conflict (workbook_id, sha256, kind) do nothing
    `;
    if (snapshot.cells.length === 0) return;
    const payload = snapshot.cells.map((cell) => ({
      cell_key: cell.cellKey, sheet_name: cell.sheetName, cell_address: cell.cellAddress,
      company_id: cell.companyId, year: cell.year, variable: cell.variable, unit: cell.unit,
      value_json: cell.value, cell_hash: cell.cellHash,
    }));
    await transaction`
      insert into workbook_snapshot_cells (
        snapshot_id, cell_key, sheet_name, cell_address, company_id, year,
        variable, unit, value_json, cell_hash
      )
      select ${snapshot.id}, x.cell_key, x.sheet_name, x.cell_address, x.company_id,
        x.year, x.variable, x.unit, coalesce(x.value_json, 'null'::jsonb), x.cell_hash
      from jsonb_to_recordset(${transaction.json(json(payload))}) as x(
        cell_key text, sheet_name text, cell_address text, company_id text,
        year integer, variable text, unit text, value_json jsonb, cell_hash text
      )
      on conflict (snapshot_id, cell_key) do nothing
    `;
  }

  private async insertItems(transaction: TransactionSql, items: WorkbookSyncItem[]): Promise<void> {
    if (items.length === 0) return;
    const payload = items.map((item) => ({
      batch_id: item.batchId, proposal_id: item.proposalId, proposal_version: item.proposalVersion,
      direction: item.direction, company_id: item.companyId, year: item.year,
      variable: item.variable, unit: item.unit, sheet_name: item.sheetName,
      cell_address: item.cellAddress, previous_value: item.previousValue,
      proposed_value: item.proposedValue, status: item.status, resolution: item.resolution,
      message: item.message,
    }));
    await transaction`
      insert into workbook_sync_items (
        batch_id, proposal_id, proposal_version, direction, company_id, year,
        variable, unit, sheet_name, cell_address, previous_value, proposed_value,
        status, resolution, message
      )
      select x.batch_id, x.proposal_id, x.proposal_version, x.direction, x.company_id,
        x.year, x.variable, x.unit, x.sheet_name, x.cell_address, x.previous_value,
        x.proposed_value, x.status, x.resolution, x.message
      from jsonb_to_recordset(${transaction.json(json(payload))}) as x(
        batch_id text, proposal_id text, proposal_version integer, direction text,
        company_id text, year integer, variable text, unit text, sheet_name text,
        cell_address text, previous_value jsonb, proposed_value jsonb, status text,
        resolution text, message text
      )
    `;
  }

  private async insertExcelProposal(
    transaction: TransactionSql,
    item: ItemRow,
    batch: BatchRow,
    actorId: string,
    createdAt: string,
  ): Promise<number> {
    if (item.proposed_value && typeof item.proposed_value === "object") {
      throw new Error(`A alteração de fórmula em ${item.sheet_name}!${item.cell_address} não pode virar proposta automática.`);
    }
    const raw = item.direction === "app_to_excel" ? item.previous_value : item.proposed_value;
    if (raw && typeof raw === "object") throw new Error("Valor de fórmula não suportado na importação do Excel.");
    const normalized = typeof raw === "string" ? raw.trim().toUpperCase() : raw;
    const availability: Proposal["availability"] = raw === null || raw === ""
      ? "not_researched"
      : normalized === "N/D" ? "unavailable"
        : normalized === "N/A" ? "not_applicable"
          : normalized === "PERÍODO FUTURO" ? "future_period"
            : normalized === "RETIDO" ? "withheld" : "available";
    const value = availability === "available"
      ? (typeof raw === "boolean" ? (raw ? "Sim" : "Não") : raw as string | number)
      : null;
    const identity = createHash("sha256")
      .update(`${batch.workbook_id}|${batch.source_sha256}|${item.sheet_name}|${item.cell_address}|${JSON.stringify(raw)}`)
      .digest("hex");
    const sourceId = `source-excel-${identity.slice(0, 32)}`;
    const proposalId = `proposal-excel-${identity.slice(0, 32)}`;
    const externalKey = `excel:${identity}`;
    const date = createdAt.slice(0, 10);
    await transaction`
      insert into sources (id, organization, title, url, reference_date, collected_at)
      values (${sourceId}, 'Planilha mestre SECC', ${`Alteração em ${item.sheet_name}!${item.cell_address}`},
        'https://secc-app.vercel.app/admin/sincronizacao', ${`${item.year}-12-31`}, ${date})
      on conflict (id) do nothing
    `;
    const numericValue = typeof value === "number" ? value : null;
    const textValue = typeof value === "string" ? value : null;
    const inserted = await transaction<{ id: string }[]>`
      insert into proposals (
        id, company_id, source_id, year, variable, value_numeric, value_text,
        unit, availability, status, created_by, created_at, version, notes,
        publish_authorized, external_key
      ) values (
        ${proposalId}, ${item.company_id}, ${sourceId}, ${item.year}, ${item.variable},
        ${numericValue}, ${textValue}, ${item.unit}, ${availability}, 'under_review',
        ${actorId}, ${createdAt}, 1,
        ${`Importada do lote ${batch.id}; origem ${item.sheet_name}!${item.cell_address}.`}, false, ${externalKey}
      ) on conflict (external_key) do nothing returning id
    `;
    if (inserted.length > 0) {
      await this.insertAudit(transaction, {
        id: randomUUID(), action: "excel.change.submitted", entityId: proposalId,
        actorId, occurredAt: createdAt, previousVersion: null, resultingVersion: 1,
        reason: `Alteração da planilha importada para revisão a partir de ${item.sheet_name}!${item.cell_address}.`,
        origin: "excel",
      });
    }
    return inserted.length;
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
