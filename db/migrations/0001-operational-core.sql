create table companies (
  id text primary key,
  slug text not null unique,
  name text not null,
  tier text not null check (tier in ('tier_1', 'tier_2', 'unclassified')),
  sector text not null,
  event_type text not null check (event_type in ('judicial_recovery', 'extrajudicial_recovery', 'bankruptcy', 'restructuring')),
  event_year integer not null check (event_year between 1900 and 2200),
  publication_status text not null check (publication_status in ('demo', 'published', 'private')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table sources (
  id text primary key,
  organization text not null,
  title text not null,
  url text not null,
  reference_date date not null,
  collected_at date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table proposals (
  id text primary key,
  company_id text not null references companies(id) on update cascade on delete restrict,
  source_id text not null references sources(id) on update cascade on delete restrict,
  year integer not null check (year between 1900 and 2200),
  variable text not null,
  value_numeric numeric,
  value_text text,
  unit text not null check (unit in ('BRL_millions', 'percent', 'count', 'text')),
  availability text not null check (availability in ('available', 'not_researched', 'unavailable', 'not_applicable', 'future_period', 'withheld', 'under_review', 'conflicted', 'rejected')),
  status text not null check (status in ('draft', 'submitted', 'under_review', 'approved', 'rejected', 'synchronized', 'published', 'conflicted')),
  created_by text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null default now(),
  version integer not null default 1 check (version > 0),
  notes text,
  publish_authorized boolean not null default false,
  constraint proposals_single_value check (num_nonnulls(value_numeric, value_text) <= 1),
  constraint proposals_available_has_value check (availability <> 'available' or num_nonnulls(value_numeric, value_text) = 1)
);

create table review_decisions (
  id bigint generated always as identity primary key,
  proposal_id text not null references proposals(id) on update cascade on delete restrict,
  decision text not null check (decision in ('approved', 'rejected', 'changes_requested')),
  justification text not null check (length(trim(justification)) > 0),
  decided_by text not null,
  decided_at timestamptz not null,
  previous_version integer not null check (previous_version > 0),
  resulting_version integer not null check (resulting_version = previous_version + 1)
);

create table audit_events (
  id text primary key,
  action text not null,
  entity_id text not null,
  actor_id text not null,
  occurred_at timestamptz not null,
  previous_version integer check (previous_version is null or previous_version > 0),
  resulting_version integer not null check (resulting_version > 0),
  reason text not null check (length(trim(reason)) > 0),
  origin text not null check (origin in ('manual', 'upload', 'excel', 'system'))
);

create index proposals_company_status_idx on proposals (company_id, status);
create index proposals_review_queue_idx on proposals (status, created_at) where status in ('submitted', 'under_review', 'conflicted');
create index review_decisions_proposal_idx on review_decisions (proposal_id, decided_at desc);
create index audit_events_entity_idx on audit_events (entity_id, occurred_at desc);

comment on table proposals is 'Propostas operacionais; aprovação não implica sincronização nem publicação.';
comment on table audit_events is 'Trilha append-only das ações operacionais do SECC.';

create function prevent_audit_event_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_events é append-only';
end;
$$;

create trigger audit_events_append_only
before update or delete on audit_events
for each row execute function prevent_audit_event_mutation();
