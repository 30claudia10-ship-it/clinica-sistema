-- ============================================================================
-- Sistema da Clínica — schema Supabase (Postgres)
-- Execute este arquivo inteiro no SQL Editor do Supabase (um único "Run").
-- ============================================================================

create extension if not exists pgcrypto;

-- ============================================================================
-- CADASTROS BASE
-- ============================================================================

create table patients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cpf text,
  birth_date date,
  phone text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null check (category in ('medicamento','insumo')),
  unit text not null,
  min_stock numeric not null default 0,
  stock numeric not null default 0,
  control_type text not null check (control_type in ('fechado','livre')),
  has_conversion boolean not null default false,
  conv_unit_label text,
  conv_factor_ml numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table units (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cnpj text,
  phone text,
  email text,
  payment_terms text,
  created_at timestamptz not null default now()
);

create table payment_methods (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- MAPEAMENTO (venda + tratamento)
-- ============================================================================

create table sales (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  date date not null,
  service_id uuid references services(id),
  items jsonb not null,
  payment_method text,
  created_at timestamptz not null default now()
);

create table treatment_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references sales(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  service_id uuid references services(id),
  product_id uuid references products(id),
  qty_total numeric not null,
  unit text not null,
  qty_used numeric not null default 0,
  status text not null default 'nao_iniciado' check (status in ('nao_iniciado','em_andamento','finalizado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table consumptions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references patients(id) on delete cascade,
  product_id uuid references products(id),
  qty numeric not null,
  unit text not null,
  type text not null check (type in ('fechado','livre')),
  treatment_item_id uuid references treatment_items(id) on delete set null,
  date timestamptz not null default now(),
  confirmation_status text not null default 'nao_aplicavel' check (confirmation_status in ('pendente','confirmado','nao_aplicavel')),
  confirmed_at timestamptz,
  note text,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- COMPRAS / RECEBIMENTO / ESTOQUE
-- ============================================================================

create table purchases (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('medicamento','insumo')),
  supplier_id uuid references suppliers(id),
  items jsonb not null,
  payment_method text,
  status text not null default 'orcamento' check (status in ('orcamento','compra_aberto','recebido')),
  date date not null,
  due_date date,
  created_at timestamptz not null default now()
);

create table receipts (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references purchases(id) on delete cascade,
  category text not null,
  items jsonb not null,
  nf text,
  notes text,
  status text not null default 'pendente' check (status in ('pendente','conferida')),
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

create table stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id),
  type text not null check (type in ('entrada','saida')),
  qty numeric not null,
  unit text not null,
  ref_type text,
  ref_id uuid,
  note text,
  date timestamptz not null default now()
);

-- ============================================================================
-- CONFIGURAÇÕES DA CLÍNICA (linha única)
-- ============================================================================

create table settings (
  id int primary key default 1,
  clinic_name text,
  logo_data_url text,
  company_name text,
  company_cnpj text,
  company_ie text,
  company_address text,
  company_phone text,
  company_email text,
  constraint settings_single_row check (id = 1)
);
insert into settings (id) values (1);

-- ============================================================================
-- TOKENS DO PORTAL DO PACIENTE (acesso público seguro, sem expor IDs internos)
-- ============================================================================

create table portal_tokens (
  id uuid primary key default gen_random_uuid(),
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  patient_id uuid not null references patients(id) on delete cascade,
  consumption_id uuid references consumptions(id) on delete cascade,
  expires_at timestamptz,
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);
create index portal_tokens_token_idx on portal_tokens(token);

-- ============================================================================
-- ROW LEVEL SECURITY — só a equipe autenticada acessa as tabelas diretamente.
-- O paciente (anônimo) só acessa dados via as funções portal_* abaixo.
-- ============================================================================

alter table patients enable row level security;
alter table services enable row level security;
alter table products enable row level security;
alter table units enable row level security;
alter table suppliers enable row level security;
alter table payment_methods enable row level security;
alter table sales enable row level security;
alter table treatment_items enable row level security;
alter table consumptions enable row level security;
alter table purchases enable row level security;
alter table receipts enable row level security;
alter table stock_movements enable row level security;
alter table settings enable row level security;
alter table portal_tokens enable row level security;

create policy "staff full access" on patients for all to authenticated using (true) with check (true);
create policy "staff full access" on services for all to authenticated using (true) with check (true);
create policy "staff full access" on products for all to authenticated using (true) with check (true);
create policy "staff full access" on units for all to authenticated using (true) with check (true);
create policy "staff full access" on suppliers for all to authenticated using (true) with check (true);
create policy "staff full access" on payment_methods for all to authenticated using (true) with check (true);
create policy "staff full access" on sales for all to authenticated using (true) with check (true);
create policy "staff full access" on treatment_items for all to authenticated using (true) with check (true);
create policy "staff full access" on consumptions for all to authenticated using (true) with check (true);
create policy "staff full access" on purchases for all to authenticated using (true) with check (true);
create policy "staff full access" on receipts for all to authenticated using (true) with check (true);
create policy "staff full access" on stock_movements for all to authenticated using (true) with check (true);
create policy "staff full access" on settings for all to authenticated using (true) with check (true);
create policy "staff full access" on portal_tokens for all to authenticated using (true) with check (true);

-- ============================================================================
-- FUNÇÕES PÚBLICAS (SECURITY DEFINER) — única porta de entrada para o anônimo.
-- Cada uma valida o token antes de devolver ou alterar qualquer coisa.
-- ============================================================================

-- Nome/logo da clínica (dado público, exibido no portal)
create or replace function get_public_branding()
returns table(clinic_name text, logo_data_url text)
language sql
security definer
set search_path = public
as $$
  select clinic_name, logo_data_url from settings where id = 1;
$$;
grant execute on function get_public_branding() to anon;

-- Dados completos do paciente (mapeamentos, sessões pendentes/confirmadas) — sem valores
create or replace function portal_get_patient_data(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_patient_id uuid;
  v_result jsonb;
begin
  select patient_id into v_patient_id
  from portal_tokens
  where token = p_token
    and revoked = false
    and (expires_at is null or expires_at > now());

  if v_patient_id is null then
    return null;
  end if;

  select jsonb_build_object(
    'patient', jsonb_build_object('id', p.id, 'name', p.name),
    'treatments', (
      select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select
          s.id as sale_id, s.date, sv.name as service_name,
          (select coalesce(jsonb_agg(ti), '[]'::jsonb) from (
            select ti2.id, pr.name as product_name, ti2.qty_total, ti2.qty_used, ti2.unit, ti2.status
            from treatment_items ti2
            join products pr on pr.id = ti2.product_id
            where ti2.sale_id = s.id
          ) ti) as items
        from sales s
        left join services sv on sv.id = s.service_id
        where s.patient_id = v_patient_id
        order by s.date desc
      ) t
    ),
    'pending_sessions', (
      select coalesce(jsonb_agg(c), '[]'::jsonb) from (
        select cn.id, cn.date, pr.name as product_name, cn.qty, cn.unit
        from consumptions cn
        join products pr on pr.id = cn.product_id
        where cn.patient_id = v_patient_id and cn.type = 'fechado' and cn.confirmation_status = 'pendente'
        order by cn.date desc
      ) c
    ),
    'confirmed_sessions', (
      select coalesce(jsonb_agg(c), '[]'::jsonb) from (
        select cn.id, cn.date, pr.name as product_name, cn.confirmed_at
        from consumptions cn
        join products pr on pr.id = cn.product_id
        where cn.patient_id = v_patient_id and cn.type = 'fechado' and cn.confirmation_status = 'confirmado'
        order by cn.confirmed_at desc
        limit 20
      ) c
    )
  ) into v_result
  from patients p
  where p.id = v_patient_id;

  return v_result;
end;
$$;
grant execute on function portal_get_patient_data(text) to anon;

-- Confirmar uma sessão específica (link individual enviado por WhatsApp/SMS)
create or replace function portal_confirm_session(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_consumption_id uuid;
begin
  select consumption_id into v_consumption_id
  from portal_tokens
  where token = p_token
    and revoked = false
    and (expires_at is null or expires_at > now())
    and consumption_id is not null;

  if v_consumption_id is null then
    return jsonb_build_object('ok', false, 'error', 'Link inválido ou expirado.');
  end if;

  update consumptions
  set confirmation_status = 'confirmado', confirmed_at = now()
  where id = v_consumption_id and type = 'fechado';

  return jsonb_build_object('ok', true);
end;
$$;
grant execute on function portal_confirm_session(text) to anon;

-- Detalhe de uma sessão específica (para a tela de confirmação individual)
create or replace function portal_get_session(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
begin
  select cn.id, cn.date, cn.qty, cn.unit, cn.confirmation_status, cn.confirmed_at,
         pr.name as product_name, pt.name as patient_name
  into v_row
  from portal_tokens t
  join consumptions cn on cn.id = t.consumption_id
  join products pr on pr.id = cn.product_id
  join patients pt on pt.id = t.patient_id
  where t.token = p_token
    and t.revoked = false
    and (t.expires_at is null or t.expires_at > now())
    and t.consumption_id is not null;

  if v_row is null then
    return null;
  end if;

  return to_jsonb(v_row);
end;
$$;
grant execute on function portal_get_session(text) to anon;

-- Login do paciente por CPF + data de nascimento -> devolve o token geral dele
create or replace function portal_login(p_cpf text, p_birth_date date)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_patient_id uuid;
  v_token text;
begin
  select id into v_patient_id
  from patients
  where cpf is not null and cpf <> ''
    and regexp_replace(cpf, '\D', '', 'g') = regexp_replace(p_cpf, '\D', '', 'g')
    and birth_date = p_birth_date;

  if v_patient_id is null then
    return null;
  end if;

  select token into v_token from portal_tokens
  where patient_id = v_patient_id and consumption_id is null and revoked = false
    and (expires_at is null or expires_at > now())
  limit 1;

  if v_token is null then
    insert into portal_tokens (patient_id, consumption_id)
    values (v_patient_id, null)
    returning token into v_token;
  end if;

  return v_token;
end;
$$;
grant execute on function portal_login(text, date) to anon;
