# Hair Tracker

A small and personal PWA for tracking hair-system fittings, re-fits and what they cost. It works out
when the next replacement needs ordering, keeps a running cost picture, and stays readable offline.

## What it does

- **Fittings** — log the day a system goes on (`new-system`) or the same system going back on
  (`refit`), with optional notes. When you log a new fitting the previous session can be closed in
  the same transaction.
- **Replacement countdown** — anchors on the most recent *new system* date, then works backwards
  through the stylist and order lead times: `due → stylist → order`. Days spent with nothing on
  never push the countdown back.
- **Wear maths** — day counts are inclusive, so both the fitting day and the removal day count.
  Days between sessions are reported separately as gap days and are never counted as wear.
- **Costs** — amounts are stored as integer minor units so yearly totals add up exactly. Monthly
  chart, per-category totals and cost-per-day-worn.
- **Offline** — the last successful sync is cached in `localStorage`; when a fetch fails the app
  opens that snapshot read-only with a clear banner. The service worker precaches the shell.

## Stack

React 19 + TypeScript + Vite, `vite-plugin-pwa` (Workbox `generateSW`), Supabase (Postgres + Auth +
RLS). Tests run on Vitest. No UI framework — hand-written CSS in `src/styles.css` with light
and dark palettes driven by `prefers-color-scheme`.

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in both values
npm run dev
```

`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` come from the Supabase dashboard
(*Project Settings → API*). The publishable/anon key is safe in a browser bundle because every
table is protected by row level security; never put the `service_role` key there.

If the env vars are missing the app shows a setup screen instead of a blank page.

### Signing in

The app asks for an email address and password before it opens your record. `src/state/AuthContext.tsx`
keeps the Supabase session in the browser and follows it across sign-in, sign-out, token refresh and
the email-confirmation redirect; `src/pages/AuthPage.tsx` renders the form, which doubles as account
creation. Nothing secret is compiled into the bundle — the anon key is public by design and every
table is protected by row level security (`auth.uid() = user_id`).

**Creating the account:** open the app, choose *Create an account*, and pick any email and password
(8 characters or more). Supabase has email confirmation on by default; when that is the case the app
says so and asks you to open the link before signing in.

**Set the URLs first.** Confirmation and password-reset emails link back to whatever *Authentication
→ URL Configuration* says. Set **Site URL** to the deployed address (for example
`https://hair-app-blush.vercel.app`) and add `https://dave25uk.github.io/hair-app/` under **Redirect
URLs**, otherwise the links point at `http://localhost:3000`.

**The trade-off:** the record belongs to that account, so the same email and password opens the same
data on any device — but the password is the only way in. Keep a **Settings → Export JSON** copy as a
backup. Signing out clears the offline snapshot from the browser; the rows in Supabase are untouched.

Anonymous sign-ins are no longer used and can be switched off under *Authentication → Sign In /
Providers → Anonymous sign-ins*.

If you logged data against the earlier anonymous identity, those rows still carry the old `user_id`
and stay hidden. To move them to your new account, run this once with both ids (from *Authentication
→ Users* and the `user_id` column of the tables):

```sql
update public.hair_settings set user_id = '<new-user-id>' where user_id = '<old-user-id>';
update public.hair_fittings set user_id = '<new-user-id>' where user_id = '<old-user-id>';
update public.hair_costs    set user_id = '<new-user-id>' where user_id = '<old-user-id>';
```

### Database

Apply `supabase/migrations/0001_init.sql` to your project (SQL editor, `supabase db push`, or the
CLI). It creates:

| Object | Purpose |
| --- | --- |
| `hair_settings` | one row per user: intervals, lead times, currency |
| `hair_fittings` | `kind`, `fitted_on`, `removed_on`, `comments` |
| `hair_costs` | `spent_on`, `category`, `amount_minor`, `note` |
| `hair_log_fitting(...)` | closes the open session and inserts the new one atomically |
| `hair_mark_removed(...)` | closes the open session with a removal date |
| `hair_touch_updated_at()` | trigger keeping `updated_at` honest |

RLS is enabled on all three tables with a single "owner" policy each (`auth.uid() = user_id`), and
both RPCs raise `Not authenticated` when called without a session.

### Back-filling old fittings

`supabase/backfill/hair-xlsx-fittings.sql` loads the history from `HAIR.xlsx` (column A = date,
B `Y` removed, C `Y` re-fitted, D `Y` new system) as 48 sessions: 6 new systems, 42 re-fits, the
last one still open, from 20 Jan 2025 to 2 Oct 2026. Five sessions keep a genuine one- or two-day
gap because the sheet records the removal and the re-fit on different dates.

Paste it into the SQL editor of the project in `.env.local` and run it — the account is already
baked in (`dave.brown04@live.com`, `759cae52-…`), there is nothing to edit. Five statements: a
read-only overview, that account and what it currently holds, a delete of the account's fittings
(with `RETURNING`, so you see exactly what went), the 48-row insert (also `RETURNING`, so a silent
no-op is impossible), and a totals query that should say 48 / 6 / 42 / 1.

It clears *all* of the account's fittings before inserting, because the sheet is the complete
record. That is also what resolves the one-open-session collision the table enforces:
`hair_fittings_one_open_idx` allows a single open session per person, so a session logged in the app
blocks the sheet's open 2 Oct 2026 row (`23505 duplicate key`). Costs and settings are never
touched, and running the whole thing twice still leaves 48 rows.

It is deliberately not a migration — it writes one person's history, so it should not ship with
`supabase db push`.


## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | `tsc --noEmit` then a production build into `dist/` |
| `npm run preview` | serve the production build locally |
| `npm test` | run the unit tests once (`test:watch` to keep them running) |
| `npm run typecheck` | types only |
| `npm run generate-pwa-assets` | regenerate the PWA icon set from `public/favicon.svg` |

## Deploying

`base` comes from `VITE_BASE`, normalised in `vite.config.ts`, and defaults to `/`. That default is
right for Vercel, Netlify or a custom domain at the root; the Pages workflow passes
`VITE_BASE=/hair-app/` because a project site lives under the repository name. Getting it wrong
looks exactly like a blank page — `index.html` loads, then its script and stylesheet 404, leaving
`#root` empty.

`.github/workflows/deploy.yml` builds and publishes to GitHub Pages on every push to `main`.

Add both values as repository secrets before the first run:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Pages requires the repository to be **public** on a free account: GitHub only serves Pages from
private repositories on Pro/Team/Enterprise, and until that is satisfied *Settings → Pages* shows
"Upgrade or make this repository public to enable Pages" with no source selector, while the API
returns 404 and the run fails at `configure-pages` with *Get Pages site failed*. The same limitation
is why the workflow does not use that action's `enablement: true`: it needs a personal access token,
not the default `GITHUB_TOKEN`.

1. Make the repository public: *Settings → General → Danger zone → Change visibility*.
2. Add the two secrets above: *Settings → Secrets and variables → Actions*.
3. Set *Settings → Pages → Source* to **GitHub Actions**.
4. Push to `main`, or re-run the workflow.

A step before the build checks that both secrets are present, so a missing one fails the run with a
named error instead of quietly publishing the "Almost there" setup screen.

### Vercel

Import the repository on Vercel — framework preset **Vite**, build `npm run build`, output `dist` —
and add the same two Supabase variables under *Settings → Environment Variables* for Production and
Preview. Leave `VITE_BASE` unset: the app is served from the domain root there.

`vercel.json` only sets cache headers: hashed `/assets/*` are immutable, `sw.js` is always
revalidated so a new service worker can take over. There is no rewrite rule because routing is
hash-based.

If a host ever shows a blank page, the base is the first suspect: open the console and look at the
404s. `/assets/…` failing means the build expects the root; `/hair-app/assets/…` failing means
`VITE_BASE` was baked in where it should not have been.

## Notes

- `src/lib/dates.ts` and `src/lib/calc.ts` are pure and covered by unit tests; UI code stays thin.
- Money helpers live in `dates.ts` (`parseMoneyToMinor`, `formatMoney`, `currencySymbol`) and use
  `Intl.NumberFormat`.
- Modals use the native `<dialog>` element, which provides the focus trap, Escape handling and
  top-layer stacking without extra code.
