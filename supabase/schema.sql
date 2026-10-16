-- Fluxo Finanças — esquema do banco (Supabase / PostgreSQL)
-- VERSÃO 2 (funções atômicas, orçamentos, lançamentos fixos). Serve para banco novo OU já existente.
-- Cole este arquivo inteiro em: Supabase > SQL Editor > New query > Run.
-- Pode ser executado mais de uma vez sem quebrar nada.

create table if not exists transactions (
  id bigserial primary key,
  user_id text not null default 'owner',
  type text not null check (type in ('income','expense')),
  description text not null,
  category text not null,
  amount numeric(14,2) not null check (amount > 0),
  transaction_date date not null,
  deleted_at timestamptz,
  source_key text unique,
  created_at timestamptz not null default now()
);

create table if not exists debts (
  id bigserial primary key,
  user_id text not null default 'owner',
  name text not null,
  creditor text not null default '',
  total_amount numeric(14,2) not null check (total_amount > 0),
  installment_count integer not null check (installment_count > 0),
  paid_installments integer not null default 0 check (paid_installments >= 0),
  current_installment_value numeric(14,2) not null check (current_installment_value >= 0),
  due_day integer not null check (due_day between 1 and 31),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists debt_payments (
  id bigserial primary key,
  debt_id bigint not null references debts(id) on delete cascade,
  installments_paid integer not null check (installments_paid > 0),
  amount_paid numeric(14,2) not null check (amount_paid > 0),
  previous_installment_value numeric(14,2) not null,
  next_installment_value numeric(14,2) not null,
  payment_date date not null,
  note text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists recurring_bills (
  id bigserial primary key,
  user_id text not null default 'owner',
  name text not null,
  category text not null,
  amount numeric(14,2) not null check (amount > 0),
  due_day integer not null check (due_day between 1 and 31),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists recurring_bill_payments (
  id bigserial primary key,
  bill_id bigint not null references recurring_bills(id) on delete cascade,
  transaction_id bigint references transactions(id) on delete set null,
  reference_month text not null,
  paid_at timestamptz not null default now(),
  unique (bill_id, reference_month)
);

-- ===== Compatibilidade com bancos criados antes (adiciona colunas que faltam; não apaga nada) =====
alter table transactions add column if not exists user_id text not null default 'owner';
alter table transactions add column if not exists deleted_at timestamptz;
alter table transactions add column if not exists source_key text;
create unique index if not exists transactions_source_key_key on transactions (source_key);
alter table debts add column if not exists user_id text not null default 'owner';
alter table debts add column if not exists creditor text not null default '';
alter table debts add column if not exists updated_at timestamptz not null default now();
alter table debt_payments add column if not exists note text not null default '';
alter table debt_payments add column if not exists previous_installment_value numeric(14,2) not null default 0;
alter table debt_payments add column if not exists next_installment_value numeric(14,2) not null default 0;

alter table debt_payments add column if not exists transaction_id bigint references transactions(id) on delete set null;

create table if not exists budgets (
  id bigserial primary key,
  user_id text not null default 'owner',
  category text not null,
  limit_amount numeric(14,2) not null check (limit_amount > 0),
  created_at timestamptz not null default now(),
  unique (user_id, category)
);

create table if not exists recurring_transactions (
  id bigserial primary key,
  user_id text not null default 'owner',
  type text not null check (type in ('income','expense')),
  description text not null,
  category text not null,
  amount numeric(14,2) not null check (amount > 0),
  day integer not null check (day between 1 and 31),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ===== Funções atômicas (tudo ou nada) =====

-- Paga parcela(s) de uma dívida: grava o pagamento, cria a despesa e atualiza a dívida numa só transação.
create or replace function pay_debt(p_debt_id bigint, p_count integer, p_amount numeric, p_next_value numeric, p_date date, p_note text default '')
returns void language plpgsql set search_path = public as $$
declare d debts%rowtype; v_count integer; v_payment bigint; v_tx bigint;
begin
  select * into d from debts where id = p_debt_id for update;
  if not found then raise exception 'Dívida não encontrada.'; end if;
  v_count := least(p_count, d.installment_count - d.paid_installments);
  if v_count <= 0 or p_amount <= 0 or p_next_value < 0 then raise exception 'Dados do pagamento inválidos.'; end if;
  insert into debt_payments (debt_id, installments_paid, amount_paid, previous_installment_value, next_installment_value, payment_date, note)
    values (p_debt_id, v_count, p_amount, d.current_installment_value, p_next_value, p_date, coalesce(p_note, ''))
    returning id into v_payment;
  insert into transactions (type, description, category, amount, transaction_date, source_key)
    values ('expense', 'Parcela: ' || d.name || case when v_count > 1 then ' (' || v_count || 'x)' else '' end, 'Dívidas', p_amount, p_date, 'debtpay:' || v_payment)
    returning id into v_tx;
  update debt_payments set transaction_id = v_tx where id = v_payment;
  update debts set paid_installments = d.paid_installments + v_count, current_installment_value = p_next_value, updated_at = now() where id = p_debt_id;
end $$;

-- Marca uma conta mensal como paga em um mês (cria/reativa a despesa; clicar duas vezes não duplica).
create or replace function pay_bill(p_bill_id bigint, p_month text, p_date date)
returns void language plpgsql set search_path = public as $$
declare b recurring_bills%rowtype; v_tx bigint;
begin
  if p_month !~ '^\d{4}-\d{2}$' then raise exception 'Mês de referência inválido.'; end if;
  select * into b from recurring_bills where id = p_bill_id;
  if not found then raise exception 'Conta não encontrada.'; end if;
  insert into transactions (type, description, category, amount, transaction_date, source_key)
    values ('expense', b.name, b.category, b.amount, p_date, 'recurring:' || b.id || ':' || p_month)
    on conflict (source_key) do update set deleted_at = null, transaction_date = excluded.transaction_date
    returning id into v_tx;
  insert into recurring_bill_payments (bill_id, transaction_id, reference_month)
    values (b.id, v_tx, p_month) on conflict (bill_id, reference_month) do nothing;
end $$;

-- Desfaz o pagamento de uma conta mensal (a despesa vai para a lixeira).
create or replace function unpay_bill(p_bill_id bigint, p_month text)
returns void language plpgsql set search_path = public as $$
begin
  delete from recurring_bill_payments where bill_id = p_bill_id and reference_month = p_month;
  update transactions set deleted_at = now() where source_key = 'recurring:' || p_bill_id || ':' || p_month;
end $$;

-- Lança as transações fixas (ex.: salário) do mês cujo dia já chegou. Idempotente.
create or replace function generate_recurring(p_month text, p_today date)
returns integer language plpgsql set search_path = public as $$
declare n integer;
begin
  if p_month !~ '^\d{4}-\d{2}$' then raise exception 'Mês inválido.'; end if;
  with ins as (
    insert into transactions (type, description, category, amount, transaction_date, source_key)
    select r.type, r.description, r.category, r.amount, x.d, 'rectx:' || r.id || ':' || p_month
    from recurring_transactions r
    cross join lateral (select ((p_month || '-01')::date + (least(r.day, extract(day from (date_trunc('month', (p_month || '-01')::date) + interval '1 month - 1 day'))::integer) - 1)) as d) x
    where r.active and x.d <= p_today
    on conflict (source_key) do nothing
    returning 1
  ) select count(*) into n from ins;
  return n;
end $$;

grant execute on function pay_debt(bigint, integer, numeric, numeric, date, text) to anon;
grant execute on function pay_bill(bigint, text, date) to anon;
grant execute on function unpay_bill(bigint, text) to anon;
grant execute on function generate_recurring(text, date) to anon;

-- Segurança (RLS). O Supabase BLOQUEIA tudo quando o RLS está ligado e não há política.
-- As políticas abaixo liberam acesso para a chave "anon" porque o app ainda NÃO tem login.
-- Quando adicionar autenticação, troque "to anon" por "to authenticated" e filtre por user_id.
alter table transactions enable row level security;
alter table debts enable row level security;
alter table debt_payments enable row level security;
alter table recurring_bills enable row level security;
alter table recurring_bill_payments enable row level security;
alter table budgets enable row level security;
alter table recurring_transactions enable row level security;

do $$
declare t text;
begin
  foreach t in array array['transactions','debts','debt_payments','recurring_bills','recurring_bill_payments','budgets','recurring_transactions']
  loop
    execute format('drop policy if exists "app_anon_all" on %I', t);
    execute format('create policy "app_anon_all" on %I for all to anon using (true) with check (true)', t);
  end loop;
end $$;

-- Atualização em tempo real (a tela se atualiza sozinha se você abrir em dois aparelhos).
do $$
declare t text;
begin
  foreach t in array array['transactions','debts','debt_payments','recurring_bills','recurring_bill_payments','budgets','recurring_transactions']
  loop
    begin
      execute format('alter publication supabase_realtime add table %I', t);
    exception when duplicate_object then null; when undefined_object then null;
    end;
  end loop;
end $$;

-- ===== Avisos por e-mail =====
create table if not exists notification_settings (
  id bigserial primary key,
  user_id text not null default 'owner' unique,
  name text not null default '',
  email text not null default '',
  enabled boolean not null default false,
  days_before integer not null default 1 check (days_before between 0 and 7),
  last_test_at timestamptz,
  updated_at timestamptz not null default now()
);
create table if not exists reminder_log (
  id bigserial primary key,
  reminder_key text not null unique,
  email text not null,
  sent_at timestamptz not null default now()
);
alter table notification_settings enable row level security;
alter table reminder_log enable row level security;  -- sem política: só o servidor (service role) acessa
drop policy if exists "app_anon_all" on notification_settings;
create policy "app_anon_all" on notification_settings for all to anon using (true) with check (true);

notify pgrst, 'reload schema';
