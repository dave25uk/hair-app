-- =============================================================================
-- Back-fill fittings from HAIR.xlsx   —   nothing to edit, just run it
--
--   1. Open  https://supabase.com/dashboard/project/qysscushyrhgrodlpovg/sql/new
--   2. Clear the editor (Ctrl+A, Delete), paste this whole file.
--   3. Press Run. Read the results in the order below.
--
--   STEP 0  one row: which database, how many accounts, how many fittings.
--   STEP 1  one row: the account being filled, and what it already holds.
--   STEP 2  clears that account's fittings ("DELETE n" plus the n rows it
--           removed, so you can see exactly what was replaced).
--   STEP 3  48 rows — the history, one row per fitting.
--   STEP 4  one row of totals: 48 fittings, 6 new systems, 42 re-fits, 1 open.
--
-- STEP 2 removes *every* fitting on the account, not just ones this script made,
-- because the spreadsheet is the complete record from 20 Jan 2025. Anything
-- already in the app is replaced by it — including the open session that made an
-- earlier attempt fail with hair_fittings_one_open_idx (the table only allows one
-- open session per person, and the sheet's last row is also open). Costs and
-- settings are not touched, and STEP 2 runs again cleanly on a second attempt
-- (it will report "DELETE 48" then).
--
-- The account: dave.brown04@live.com, id 759cae52-53f0-4896-ac90-51b42a105d3e.
-- That id appears in the four places marked <<< ACCOUNT >>>; find/replace it to
-- fill a different account.
--
-- Column A of the sheet = date, B = 'Y' system removed, C = 'Y' system
-- re-fitted, D = 'Y' new system installed. One row per event, oldest first.
--
-- How the sheet was converted
--   * B=Y closes the session that is currently on, on that date.
--   * C=Y starts a 'refit'; D=Y starts a 'new-system' on that date.
--   * Most rows have B and C/D together: off and back on the same day, so the
--     old session ends and the new one starts on that date. That is one wear
--     day, not a gap — the same thing the app does when you log a fitting.
--   * Five sessions do have a genuine gap, because the sheet puts the removal
--     and the re-fit on different dates (off 7 Aug, back on 9 Aug 2025; and
--     four one-day gaps). Those are kept as gaps, not smoothed over.
--   * Row 2 marks a removal with nothing on before it (the record starts
--     there), so it is ignored.
--   * The last row leaves its session open, which is what the app reads as
--     "on now".
--
-- This is a one-off script, not a migration: it writes a specific person's
-- history, so it should not run as part of `supabase db push`.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- STEP 0 — read-only sanity check. "fittings = 0" means the table really is
-- empty; if it isn't 0, someone already has history in here.
-- ---------------------------------------------------------------------------
select current_database()                                     as database,
       (select count(*) from auth.users)                       as accounts,
       (select count(*) from public.hair_fittings)             as fittings,
       (select count(*) from public.hair_fittings
         where removed_on is null)                             as open_sessions;

-- ---------------------------------------------------------------------------
-- STEP 1 — read-only. The account being filled and what it currently holds.
-- open_rows = 1 is the row that blocked the previous attempt.
-- ---------------------------------------------------------------------------
select u.id                as owner_id,
       u.email,
       u.created_at,
       u.last_sign_in_at,
       count(f.id)                                                         as all_rows,
       count(f.id) filter (where f.comments = 'Backfilled from HAIR.xlsx')  as backfilled_rows,
       count(f.id) filter (where f.removed_on is null)                     as open_rows
from auth.users as u
left join public.hair_fittings as f on f.user_id = u.id
where u.id = '759cae52-53f0-4896-ac90-51b42a105d3e'::uuid  -- <<< ACCOUNT >>>
group by u.id, u.email, u.created_at, u.last_sign_in_at;

-- ---------------------------------------------------------------------------
-- STEP 2 — clears the account's fittings so the spreadsheet can replace them.
-- It shows what it removed; "DELETE 0" means there was nothing there.
-- ---------------------------------------------------------------------------
delete from public.hair_fittings
 where user_id = '759cae52-53f0-4896-ac90-51b42a105d3e'::uuid  -- <<< ACCOUNT >>>
returning kind, fitted_on, removed_on, comments;

-- ---------------------------------------------------------------------------
-- STEP 3 — the 53 dated sheet rows become 48 sessions. The results pane must
-- come back with 48 rows; anything less means nothing was written.
-- ---------------------------------------------------------------------------
insert into public.hair_fittings (user_id, kind, fitted_on, removed_on, comments)
select '759cae52-53f0-4896-ac90-51b42a105d3e'::uuid,  -- <<< ACCOUNT >>>
       s.kind, s.fitted_on, s.removed_on, 'Backfilled from HAIR.xlsx'
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
where user_id = '759cae52-53f0-4896-ac90-51b42a105d3e'::uuid;  -- <<< ACCOUNT >>>

-- ---------------------------------------------------------------------------
-- Nothing else to do. Reload the app (Ctrl+Shift+R once, so the service worker
-- doesn't serve its cached copy) and the fittings page should show 48 sessions
-- from 20 Jan 2025, with the 2 Oct 2026 re-fit still on.
-- ---------------------------------------------------------------------------



