-- ============================================================
-- BudżetApp — Supabase Schema v2
-- Paste everything into: Supabase → SQL Editor → New query → Run
-- ============================================================

-- Drop existing tables first (safe re-run)
drop table if exists longterm_payments cascade;
drop table if exists longterm_expenses  cascade;
drop table if exists savings_deposits   cascade;
drop table if exists savings_goals      cascade;
drop table if exists incomes            cascade;
drop table if exists transactions       cascade;
drop table if exists app_config         cascade;

create extension if not exists "pgcrypto";

-- app_config
create table app_config (
  key   text primary key,
  value text not null
);
-- Default PIN: 1234  (SHA-256 of "1234::bp_salt_v2")
insert into app_config (key, value) values
  ('pin_hash', '31866173ad258556bd1c0da90a0b1c28f3a17f4a82ebd9c79a5d5b48a497ec6a');

-- transactions
create table transactions (
  id          uuid primary key default gen_random_uuid(),
  period_key  text not null,
  subtype     text not null,
  category    text not null,
  description text not null,
  amount      numeric(10,2) not null,
  created_at  timestamptz default now()
);

-- incomes
create table incomes (
  id          uuid primary key default gen_random_uuid(),
  period_key  text not null,
  source      text not null,
  amount      numeric(10,2) not null,
  created_at  timestamptz default now()
);

-- savings_goals
create table savings_goals (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  target     numeric(10,2) not null,
  color      text default '#6C63FF',
  icon       text default '🎯',
  created_at timestamptz default now()
);

-- savings_deposits
create table savings_deposits (
  id         uuid primary key default gen_random_uuid(),
  goal_id    uuid references savings_goals(id) on delete cascade,
  amount     numeric(10,2) not null,
  note       text default '',
  created_at timestamptz default now()
);

-- longterm_expenses
create table longterm_expenses (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  total_budget numeric(10,2) not null,
  icon         text default '📦',
  color        text default '#F5C542',
  active       boolean default true,
  created_at   timestamptz default now()
);

-- longterm_payments
create table longterm_payments (
  id         uuid primary key default gen_random_uuid(),
  expense_id uuid references longterm_expenses(id) on delete cascade,
  period_key text not null,
  amount     numeric(10,2) not null,
  note       text default '',
  created_at timestamptz default now()
);

-- Enable RLS on all tables
alter table app_config          enable row level security;
alter table transactions        enable row level security;
alter table incomes             enable row level security;
alter table savings_goals       enable row level security;
alter table savings_deposits    enable row level security;
alter table longterm_expenses   enable row level security;
alter table longterm_payments   enable row level security;

-- Allow full access via anon key (single-user PIN-protected app)
create policy "allow_all" on app_config        for all to anon using (true) with check (true);
create policy "allow_all" on transactions      for all to anon using (true) with check (true);
create policy "allow_all" on incomes           for all to anon using (true) with check (true);
create policy "allow_all" on savings_goals     for all to anon using (true) with check (true);
create policy "allow_all" on savings_deposits  for all to anon using (true) with check (true);
create policy "allow_all" on longterm_expenses for all to anon using (true) with check (true);
create policy "allow_all" on longterm_payments for all to anon using (true) with check (true);

-- ══ ADD THIS TO YOUR EXISTING SCHEMA (run separately if tables already exist) ══
-- Custom expense categories
create table if not exists custom_categories (
  id         uuid primary key default gen_random_uuid(),
  type       text not null default 'expense', -- 'expense' | 'income'
  label      text not null,
  icon       text not null default '🏷️',
  color      text not null default '#6C63FF',
  sort_order int  default 99,
  created_at timestamptz default now()
);
alter table custom_categories enable row level security;
create policy "allow_all" on custom_categories for all to anon using (true) with check (true);

-- ══ RUN THIS if custom_categories table already exists (adds missing columns) ══
-- Nothing needed — table structure is unchanged.
-- But if you're starting fresh, the full schema above will create it correctly.

-- ══ IMPORTANT: After deploying v6, the app will automatically seed your default
-- categories into the custom_categories table on first login.
-- This means ALL categories (including defaults) can now be edited and deleted.
