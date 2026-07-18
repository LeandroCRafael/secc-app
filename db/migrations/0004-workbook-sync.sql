alter table proposals drop constraint proposals_unit_check;
alter table proposals add constraint proposals_unit_check
  check (unit in ('BRL', 'BRL_millions', 'percent', 'count', 'count_millions', 'text'));

create table workbook_snapshots (
  id text primary key,
  workbook_id text not null,
  original_name text not null,
  size_bytes integer not null check (size_bytes > 0),
  sha256 text not null,
  workbook_version text not null,
  data_version integer not null check (data_version >= 0),
  mapping_version text not null,
  kind text not null check (kind in ('source', 'result')),
  sync_batch_id text,
  created_by text not null,
  created_at timestamptz not null,
  unique (workbook_id, sha256, kind)
);

create table workbook_snapshot_cells (
  snapshot_id text not null references workbook_snapshots(id) on update cascade on delete cascade,
  cell_key text not null,
  sheet_name text not null,
  cell_address text not null,
  company_id text not null references companies(id) on update cascade on delete restrict,
  year integer not null check (year between 1900 and 2200),
  variable text not null,
  unit text not null check (unit in ('BRL', 'BRL_millions', 'percent', 'count', 'count_millions', 'text')),
  value_json jsonb not null,
  cell_hash text not null,
  primary key (snapshot_id, cell_key)
);

create table workbook_sync_batches (
  id text primary key,
  idempotency_key text not null unique,
  workbook_id text not null,
  source_snapshot_id text not null references workbook_snapshots(id) on update cascade on delete restrict,
  status text not null check (status in ('prepared', 'blocked', 'applied', 'failed')),
  mapping_version text not null,
  source_workbook_version text not null,
  result_workbook_version text not null,
  source_sha256 text not null,
  result_sha256 text,
  approved_count integer not null default 0 check (approved_count >= 0),
  ready_count integer not null default 0 check (ready_count >= 0),
  conflict_count integer not null default 0 check (conflict_count >= 0),
  unmapped_count integer not null default 0 check (unmapped_count >= 0),
  unchanged_count integer not null default 0 check (unchanged_count >= 0),
  excel_change_count integer not null default 0 check (excel_change_count >= 0),
  requested_by text not null,
  requested_at timestamptz not null,
  applied_by text,
  applied_at timestamptz,
  output_file_name text,
  backup_file_name text not null,
  failure_reason text,
  constraint workbook_sync_batch_app_counts check (
    approved_count = ready_count + conflict_count + unmapped_count + unchanged_count
  )
);

alter table workbook_snapshots
  add constraint workbook_snapshots_sync_batch_fk
  foreign key (sync_batch_id) references workbook_sync_batches(id) on update cascade on delete set null;

create table workbook_sync_items (
  id bigint generated always as identity primary key,
  batch_id text not null references workbook_sync_batches(id) on update cascade on delete cascade,
  proposal_id text references proposals(id) on update cascade on delete restrict,
  proposal_version integer,
  direction text not null check (direction in ('app_to_excel', 'excel_to_app')),
  company_id text not null references companies(id) on update cascade on delete restrict,
  year integer not null check (year between 1900 and 2200),
  variable text not null,
  unit text not null check (unit in ('BRL', 'BRL_millions', 'percent', 'count', 'count_millions', 'text')),
  sheet_name text,
  cell_address text,
  previous_value jsonb,
  proposed_value jsonb,
  status text not null check (status in ('ready', 'unchanged', 'conflict', 'unmapped', 'applied', 'kept_excel', 'imported')),
  resolution text check (resolution is null or resolution in ('use_app', 'keep_excel')),
  message text not null
);

alter table proposals
  add column last_sync_batch_id text references workbook_sync_batches(id) on update cascade on delete set null,
  add column synchronized_at timestamptz;

create index workbook_snapshots_latest_idx on workbook_snapshots (workbook_id, kind, created_at desc);
create index workbook_snapshot_cells_company_idx on workbook_snapshot_cells (company_id, year, variable);
create index workbook_sync_batches_created_idx on workbook_sync_batches (requested_at desc);
create index workbook_sync_items_batch_idx on workbook_sync_items (batch_id, direction, status);

comment on table workbook_sync_batches is 'Lotes persistidos de prévia e aplicação do intercâmbio XLSX.';
comment on table workbook_snapshot_cells is 'Fotografia controlada das células mapeadas; não armazena o arquivo bruto.';
comment on table workbook_sync_items is 'Diff por proposta ou alteração originada na planilha.';
