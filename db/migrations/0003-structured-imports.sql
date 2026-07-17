create table import_batches (
  id text primary key,
  company_id text not null references companies(id) on update cascade on delete restrict,
  original_name text not null,
  mime text not null,
  size_bytes integer not null check (size_bytes > 0),
  sha256 text not null,
  row_count integer not null check (row_count >= 0),
  valid_count integer not null check (valid_count >= 0),
  error_count integer not null check (error_count >= 0),
  status text not null check (status in ('previewed', 'imported')),
  created_by text not null,
  created_at timestamptz not null,
  imported_at timestamptz,
  constraint import_batches_reconciled_counts check (row_count = valid_count + error_count)
);

create table import_rows (
  id bigint generated always as identity primary key,
  batch_id text not null references import_batches(id) on update cascade on delete cascade,
  row_number integer not null check (row_number > 1),
  raw_data jsonb not null,
  proposal_data jsonb,
  errors jsonb not null,
  unique (batch_id, row_number)
);

create index import_batches_company_created_idx on import_batches (company_id, created_at desc);
create index import_batches_status_created_idx on import_batches (status, created_at desc);
create index import_rows_batch_idx on import_rows (batch_id, row_number);

comment on table import_batches is 'Prévias normalizadas de CSV/XLSX; o arquivo bruto não é persistido nesta etapa.';
comment on table import_rows is 'Linhas validadas antes da criação controlada de propostas.';
