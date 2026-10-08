-- ============================================================================
-- Migração 4 — Orçamento Cirúrgico (equipe fixa, hospital, anestesista,
-- terceiros/parceiros, orçamentos e proposta pública do paciente).
-- Execute no SQL Editor do Supabase, um único "Run".
-- ============================================================================

-- ---------- identidade visual, contatos e textos padrão (linha única) -------
alter table settings add column if not exists doctor_name text;
alter table settings add column if not exists doctor_title text;
alter table settings add column if not exists brand_primary text;
alter table settings add column if not exists brand_accent text;
alter table settings add column if not exists commercial_name text;
alter table settings add column if not exists commercial_phone text;
alter table settings add column if not exists commercial_photo text;
alter table settings add column if not exists financial_name text;
alter table settings add column if not exists financial_phone text;
alter table settings add column if not exists financial_photo text;
alter table settings add column if not exists std_texts jsonb;
alter table settings add column if not exists quote_seeded boolean not null default false;

-- ---------- equipe fixa do cirurgião ----------------------------------------
create table if not exists team_members (
  id uuid primary key default gen_random_uuid(),
  role text not null,
  name text,
  value numeric not null default 0,
  discountable boolean not null default true,
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------- terceiros: hospital, anestesista, parceiros ---------------------
-- Toda a tabela de preços, descontos e condições fica em "config" (jsonb).
create table if not exists third_parties (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('hospital','anestesista','parceiro')),
  name text not null,
  active boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------- orçamentos -------------------------------------------------------
create table if not exists quotes (
  id uuid primary key default gen_random_uuid(),
  code text unique,
  patient_name text,
  status text not null default 'rascunho' check (status in ('rascunho','publicado','revogado')),
  step int not null default 1,
  data jsonb not null default '{}'::jsonb,
  snapshot jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  published_at timestamptz
);
create index if not exists quotes_code_idx on quotes(code);

alter table team_members enable row level security;
alter table third_parties enable row level security;
alter table quotes enable row level security;

drop policy if exists "staff full access" on team_members;
drop policy if exists "staff full access" on third_parties;
drop policy if exists "staff full access" on quotes;
create policy "staff full access" on team_members for all to authenticated using (true) with check (true);
create policy "staff full access" on third_parties for all to authenticated using (true) with check (true);
create policy "staff full access" on quotes for all to authenticated using (true) with check (true);

grant select, insert, update, delete on team_members, third_parties, quotes to authenticated;

-- ---------- proposta pública (landing do paciente) --------------------------
-- Só devolve orçamentos MARCADOS como publicados. Rascunho/revogado = null.
create or replace function get_public_quote(p_code text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select snapshot from quotes
  where code = lower(p_code) and status = 'publicado' and snapshot is not null;
$$;
grant execute on function get_public_quote(text) to anon;
