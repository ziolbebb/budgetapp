-- ============================================================
-- BudżetApp — Supabase Schema
-- Wklej całość w: Supabase → SQL Editor → New query → Run
-- ============================================================

-- Włącz UUID
create extension if not exists "pgcrypto";

-- ============================================================
-- UŻYTKOWNIK (PIN zamiast hasła — jeden użytkownik)
-- ============================================================
create table if not exists app_config (
  key   text primary key,
  value text not null
);
-- domyślny PIN: 1234 (SHA-256 zahashowany po stronie klienta)
insert into app_config (key, value)
values ('pin_hash', 'bcb15f821479b4d5772bd0ca866c00ad5f926e3580720659cc80d39c9d09802a')
on conflict (key) do nothing;

-- ============================================================
-- TRANSAKCJE (zaplanowane + rzeczywiste)
-- ============================================================
create table if not exists transactions (
  id          uuid primary key default gen_random_uuid(),
  period_key  text not null,          -- np. "p_2026_04"
  subtype     text not null,          -- "planned" | "actual"
  category    text not null,
  description text not null,
  amount      numeric(10,2) not null,
  created_at  timestamptz default now()
);

-- ============================================================
-- PRZYCHODY
-- ============================================================
create table if not exists incomes (
  id          uuid primary key default gen_random_uuid(),
  period_key  text not null,
  source      text not null,          -- "dominos" | "rodzice" | "szycie" | "inne_inc"
  amount      numeric(10,2) not null,
  created_at  timestamptz default now()
);

-- ============================================================
-- OSZCZĘDNOŚCI — cele
-- ============================================================
create table if not exists savings_goals (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  target      numeric(10,2) not null,
  color       text default '#6C63FF',
  icon        text default '🎯',
  created_at  timestamptz default now()
);

create table if not exists savings_deposits (
  id          uuid primary key default gen_random_uuid(),
  goal_id     uuid references savings_goals(id) on delete cascade,
  amount      numeric(10,2) not null,
  note        text default '',
  created_at  timestamptz default now()
);

-- ============================================================
-- WYDATKI DŁUGOTERMINOWE
-- ============================================================
create table if not exists longterm_expenses (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  total_budget numeric(10,2) not null,
  icon        text default '📦',
  color       text default '#F5C542',
  active      boolean default true,
  created_at  timestamptz default now()
);

create table if not exists longterm_payments (
  id          uuid primary key default gen_random_uuid(),
  expense_id  uuid references longterm_expenses(id) on delete cascade,
  period_key  text not null,
  amount      numeric(10,2) not null,
  note        text default '',
  created_at  timestamptz default now()
);

-- ============================================================
-- RLS — wyłącz (aplikacja prywatna, jeden użytkownik)
-- ============================================================
alter table app_config          disable row level security;
alter table transactions        disable row level security;
alter table incomes             disable row level security;
alter table savings_goals       disable row level security;
alter table savings_deposits    disable row level security;
alter table longterm_expenses   disable row level security;
alter table longterm_payments   disable row level security;

-- Zezwól na wszystko dla anon key
grant all on app_config         to anon;
grant all on transactions       to anon;
grant all on incomes            to anon;
grant all on savings_goals      to anon;
grant all on savings_deposits   to anon;
grant all on longterm_expenses  to anon;
grant all on longterm_payments  to anon;
