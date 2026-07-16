alter table companies alter column event_year drop not null;

alter table companies
  add column workbook_row integer unique,
  add column company_type text,
  add column reference_code text,
  add column collection_start_year integer,
  add column collection_end_year integer,
  add column workbook_status text,
  add column workbook_completion numeric,
  add column cvm_cnpj text,
  add column cvm_code text,
  add column source_workbook_hash text,
  add column coverage_updated_at timestamptz;

create table company_coverage (
  company_id text primary key references companies(id) on update cascade on delete cascade,
  financial_filled integer not null default 0 check (financial_filled >= 0),
  financial_expected integer not null default 0 check (financial_expected >= 0),
  qualitative_filled integer not null default 0 check (qualitative_filled >= 0),
  qualitative_expected integer not null default 0 check (qualitative_expected >= 0),
  market_filled integer not null default 0 check (market_filled >= 0),
  market_expected integer not null default 0 check (market_expected >= 0),
  researched_years integer not null default 0 check (researched_years >= 0),
  total_years integer not null default 0 check (total_years >= 0),
  last_data_year integer,
  workbook_hash text not null,
  calculated_at timestamptz not null
);

alter table proposals add column external_key text unique;

create index companies_cvm_cnpj_idx on companies (cvm_cnpj) where cvm_cnpj is not null;
create index companies_workbook_status_idx on companies (workbook_status);

comment on table company_coverage is 'Cobertura calculada a partir da planilha mestre; não replica os valores financeiros.';
