-- =============================================================================
-- Back-fill fittings from HAIR.xlsx
--
-- Column A = date, B = 'Y' system removed, C = 'Y' system re-fitted,
-- D = 'Y' new system installed. One row per event, oldest first.
--
-- How to run
--   1. Change the email on the line marked <<< CHANGE ME.
--   2. Paste the whole file into the Supabase SQL editor and run it.
--   3. Reload the app. You should see 48 fittings: 6 new systems, 42 re-fits,
--      the most recent (2 Oct 2026) still open.
--
-- How the sheet was converted
--   * B=Y closes the session that is currently on, on that date.
--   * C=Y starts a 'refit'; D=Y starts a 'new-system' on that date.
--   * Most rows have B and C/D together: off and back on the same day, so the
--     old session ends and the new one starts on that date. That is one wear
--     day, not a gap — the same thing the app does when you log a fitting.
--   * Row 2 marks a removal with nothing on before it (the record starts
--     there), so it is ignored.
--   * The last row leaves its session open, which is what the app reads as
--     "on now".
--
-- This is a one-off script, not a migration: it writes a specific person's
-- history, so it should not run as part of `supabase db push`.
-- =============================================================================

-- The account to fill. <<< CHANGE ME >>>
set hair_backfill.email = 'you@example.com';

do $$
declare
  v_email text := current_setting('hair_backfill.email');
  v_user uuid;
  v_count integer;
begin
  select id into v_user from auth.users where lower(email) = lower(v_email);
  if v_user is null then
    raise exception 'No Supabase user matches %', v_email;
  end if;

  -- Idempotent: drop only rows a previous run of *this* script created.
  delete from public.hair_fittings
   where user_id = v_user
     and comments = 'Backfilled from HAIR.xlsx';

  select count(*) into v_count from public.hair_fittings where user_id = v_user;
  if v_count > 0 then
    raise exception
      'That account already has % fitting(s). This back-fill expects an empty record — delete them in the app first, then run this again.',
      v_count;
  end if;

  insert into public.hair_fittings (user_id, kind, fitted_on, removed_on, comments)
  select v_user, s.kind, s.fitted_on, s.removed_on, 'Backfilled from HAIR.xlsx'
  from (values
    ('new-system', date '2025-01-20', date '2025-02-02'),
    ('refit',      date '2025-02-02', date '2025-02-12'),
    ('refit',      date '2025-02-12', date '2025-02-24'),
    ('refit',      date '2025-02-24', date '2025-03-03'),
    ('refit',      date '2025-03-03', date '2025-03-15'),
    ('refit',      date '2025-03-15', date '2025-03-31'),
    ('refit',      date '2025-03-31', date '2025-04-14'),
    ('new-system', date '2025-04-14', date '2025-05-02'),
    ('refit',      date '2025-05-02', date '2025-05-15'),
    ('refit',      date '2025-05-15', date '2025-05-31'),
    ('refit',      date '2025-05-31', date '2025-06-05'),
    ('refit',      date '2025-06-05', date '2025-06-22'),
    ('refit',      date '2025-06-22', date '2025-07-04'),
    ('refit',      date '2025-07-04', date '2025-07-15'),
    ('refit',      date '2025-07-15', date '2025-07-23'),
    ('new-system', date '2025-07-23', date '2025-08-07'),
    ('refit',      date '2025-08-09', date '2025-08-25'),
    ('refit',      date '2025-08-25', date '2025-09-09'),
    ('refit',      date '2025-09-10', date '2025-09-22'),
    ('refit',      date '2025-09-23', date '2025-10-06'),
    ('refit',      date '2025-10-06', date '2025-10-21'),
    ('refit',      date '2025-10-21', date '2025-10-30'),
    ('refit',      date '2025-10-30', date '2025-11-13'),
    ('refit',      date '2025-11-13', date '2025-11-26'),
    ('refit',      date '2025-11-26', date '2025-12-09'),
    ('new-system', date '2025-12-09', date '2025-12-21'),
    ('refit',      date '2025-12-21', date '2026-01-04'),
    ('refit',      date '2026-01-04', date '2026-01-18'),
    ('refit',      date '2026-01-19', date '2026-02-03'),
    ('refit',      date '2026-02-03', date '2026-02-09'),
    ('refit',      date '2026-02-09', date '2026-02-22'),
    ('new-system', date '2026-02-23', date '2026-02-28'),
    ('refit',      date '2026-02-28', date '2026-03-17'),
    ('refit',      date '2026-03-17', date '2026-04-01'),
    ('refit',      date '2026-04-01', date '2026-04-16'),
    ('refit',      date '2026-04-16', date '2026-04-30'),
    ('refit',      date '2026-04-30', date '2026-05-16'),
    ('refit',      date '2026-05-16', date '2026-06-03'),
    ('refit',      date '2026-06-03', date '2026-06-10'),
    ('new-system', date '2026-06-10', date '2026-06-21'),
    ('refit',      date '2026-06-21', date '2026-07-07'),
    ('refit',      date '2026-07-07', date '2026-07-20'),
    ('refit',      date '2026-07-20', date '2026-08-05'),
    ('refit',      date '2026-08-05', date '2026-08-17'),
    ('refit',      date '2026-08-17', date '2026-08-31'),
    ('refit',      date '2026-08-31', date '2026-09-17'),
    ('refit',      date '2026-09-17', date '2026-10-02'),
    ('refit',      date '2026-10-02', null)
  ) as s (kind, fitted_on, removed_on);
end $$;

-- What the app will now show.
select count(*)                                        as fittings,
       count(*) filter (where kind = 'new-system')      as new_systems,
       count(*) filter (where kind = 'refit')           as refits,
       count(*) filter (where removed_on is null)       as open_sessions,
       min(fitted_on)                                   as first_fitted,
       max(fitted_on)                                   as last_fitted
from public.hair_fittings
where user_id = (
  select id from auth.users where lower(email) = lower(current_setting('hair_backfill.email'))
);

