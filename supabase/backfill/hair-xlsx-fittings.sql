-- =============================================================================
-- Back-fill fittings from HAIR.xlsx
--
-- Column A = date, B = 'Y' system removed, C = 'Y' system re-fitted,
-- D = 'Y' new system installed. One row per event, oldest first.
--
-- Run the steps in order. Each one reports what it did, so a step that writes
-- nothing is visible in the results pane instead of failing quietly:
--
--   STEP 0  read-only: every account, and how many fittings it already holds.
--   STEP 1  replace <<< OWNER >>> (3 places) with an owner_id from step 0.
--   STEP 2  delete rows a previous run created          -> "DELETE 0"
--   STEP 3  insert the 48 sessions                      -> 48 rows returned
--   STEP 4  totals: 48 fittings, 6 new systems, 1 open  -> one row
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

-- ---------------------------------------------------------------------------
-- STEP 0 — read-only. Every auth account, with what it already holds. The
-- account you sign in with should show all_rows = 0; if it shows rows, those
-- are fittings logged in the app and they need deleting before a back-fill
-- (see the note at the bottom).
-- ---------------------------------------------------------------------------
select u.id                as owner_id,
       u.email,
       u.is_anonymous,
       u.created_at,
       u.last_sign_in_at,
       count(f.id)                                                         as all_rows,
       count(f.id) filter (where f.comments = 'Backfilled from HAIR.xlsx')  as backfilled_rows,
       count(f.id) filter (where f.removed_on is null)                     as open_rows
from auth.users as u
left join public.hair_fittings as f on f.user_id = u.id
group by u.id, u.email, u.is_anonymous, u.created_at, u.last_sign_in_at
order by u.created_at;

-- ---------------------------------------------------------------------------
-- STEP 1 — replace all three  <<< OWNER >>>  placeholders with the owner_id
-- you want to fill. Leaving one unreplaced fails loudly (invalid uuid).
-- ---------------------------------------------------------------------------

-- STEP 2 — clears rows a previous run of this script created, so re-running
-- after fixing a date is safe. Expect "DELETE 0" the first time.
delete from public.hair_fittings
 where user_id = '<<< OWNER >>>'::uuid
   and comments = 'Backfilled from HAIR.xlsx';

-- STEP 3 — the 53 dated sheet rows become 48 sessions. The results pane should
-- come back with 48 rows; anything less means nothing was written.
insert into public.hair_fittings (user_id, kind, fitted_on, removed_on, comments)
select '<<< OWNER >>>'::uuid, s.kind, s.fitted_on, s.removed_on, 'Backfilled from HAIR.xlsx'
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
  ) as s (kind, fitted_on, removed_on)
returning kind, fitted_on, removed_on, comments;

-- ---------------------------------------------------------------------------
-- STEP 4 — what the app will now show. Expect: 48 fittings, 6 new systems,
-- 42 re-fits, 1 open, 2025-01-20 .. 2026-10-02.
-- ---------------------------------------------------------------------------
select count(*)                                            as fittings,
       count(*) filter (where kind = 'new-system')          as new_systems,
       count(*) filter (where kind = 'refit')               as refits,
       count(*) filter (where removed_on is null)           as open_sessions,
       min(fitted_on)                                       as first_fitted,
       max(fitted_on)                                       as last_fitted,
       count(*) filter (where comments = 'Backfilled from HAIR.xlsx') as backfilled
from public.hair_fittings
where user_id = '<<< OWNER >>>'::uuid;

-- ---------------------------------------------------------------------------
-- If step 0 showed rows for the account you are filling (all_rows > 0), those
-- came from logging fittings in the app. Deal with them before running step 3,
-- otherwise the history interleaves or the one-open-session index rejects the
-- insert. Either delete them in the app, or clear the whole account with:
--
--   delete from public.hair_fittings where user_id = '<your owner id>'::uuid;
--
-- ---------------------------------------------------------------------------


