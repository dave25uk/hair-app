-- =============================================================================
-- Hair Tracker schema
--
-- This app shares the Supabase project with another app (hanging baskets), so
-- every object lives in the existing `public` schema and is prefixed `hair_`.
-- That avoids touching the project's PostgREST exposed-schema configuration.
--
-- Row Level Security keeps every row private to its owner (`auth.uid()`), so
-- the anon key can safely ship in the browser bundle.
-- =============================================================================

create table if not exists public.hair_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  refit_interval_days integer not null default 28
    check (refit_interval_days between 1 and 365),
  new_system_interval_days integer not null default 120
    check (new_system_interval_days between 1 and 1095),
  stylist_lead_days integer not null default 14
    check (stylist_lead_days between 0 and 365),
  order_lead_days integer not null default 21
    check (order_lead_days between 0 and 365),
  currency text not null default 'GBP' check (char_length(currency) = 3),
  updated_at timestamptz not null default now()
);

create table if not exists public.hair_fittings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('new-system', 'refit')),
  fitted_on date not null,
  removed_on date,
  comments text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hair_fittings_dates_valid check (removed_on is null or removed_on >= fitted_on)
);

create table if not exists public.hair_costs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  spent_on date not null,
  category text not null check (category in ('system', 'styling', 'fitting')),
  amount_minor bigint not null check (amount_minor >= 0),
  note text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists hair_fittings_user_fitted_idx
  on public.hair_fittings (user_id, fitted_on desc);
create index if not exists hair_costs_user_spent_idx
  on public.hair_costs (user_id, spent_on desc);

-- Only one system can be "currently on" per user.
create unique index if not exists hair_fittings_one_open_idx
  on public.hair_fittings (user_id) where removed_on is null;

create or replace function public.hair_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists hair_fittings_touch on public.hair_fittings;
create trigger hair_fittings_touch
  before update on public.hair_fittings
  for each row execute function public.hair_touch_updated_at();

drop trigger if exists hair_settings_touch on public.hair_settings;
create trigger hair_settings_touch
  before update on public.hair_settings
  for each row execute function public.hair_touch_updated_at();

alter table public.hair_settings enable row level security;
alter table public.hair_fittings enable row level security;
alter table public.hair_costs enable row level security;

drop policy if exists hair_settings_owner on public.hair_settings;
create policy hair_settings_owner on public.hair_settings
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists hair_fittings_owner on public.hair_fittings;
create policy hair_fittings_owner on public.hair_fittings
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists hair_costs_owner on public.hair_costs;
create policy hair_costs_owner on public.hair_costs
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete
  on public.hair_settings, public.hair_fittings, public.hair_costs
  to authenticated;

-- -----------------------------------------------------------------------------
-- Log a fitting atomically: close the currently open session on the day the old
-- system came off, then start the new session on the day the new one went on.
-- Any days in between belong to neither session (the gap rule).
-- -----------------------------------------------------------------------------
create or replace function public.hair_log_fitting(
  p_kind text,
  p_fitted_on date,
  p_previous_removed_on date default null,
  p_comments text default ''
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
begin
  if v_user is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if p_kind not in ('new-system', 'refit') then
    raise exception 'Invalid fitting kind: %', p_kind using errcode = '22023';
  end if;

  if p_previous_removed_on is not null and p_previous_removed_on > p_fitted_on then
    raise exception 'Previous system cannot be removed after the new one is fitted'
      using errcode = '22007';
  end if;

  update public.hair_fittings
     set removed_on = coalesce(p_previous_removed_on, p_fitted_on)
   where user_id = v_user
     and removed_on is null;

  insert into public.hair_fittings (user_id, kind, fitted_on, comments)
  values (v_user, p_kind, p_fitted_on, coalesce(p_comments, ''))
  returning id into v_id;

  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Mark the current system as off without logging a new fitting.
-- -----------------------------------------------------------------------------
create or replace function public.hair_mark_removed(
  p_fitting_id uuid,
  p_removed_on date
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  update public.hair_fittings
     set removed_on = p_removed_on
   where id = p_fitting_id
     and user_id = v_user
     and removed_on is null;

  if not found then
    raise exception 'No open fitting found to remove' using errcode = 'P0002';
  end if;
end;
$$;

grant execute on function public.hair_log_fitting(text, date, date, text) to authenticated;
grant execute on function public.hair_mark_removed(uuid, date) to authenticated;
