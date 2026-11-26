# Hair Tracker

A small, personal PWA for tracking hair-system fittings, re-fits and what they cost. It works out
when the next replacement needs ordering, keeps a running cost picture, and stays readable offline.
There is no sign-in screen.

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

### No sign-in

The app is built for exactly one person, so there is no login form. On first load
`src/state/SessionContext.tsx` mints a **silent anonymous Supabase session** and keeps it in the
browser; subsequent loads reuse it. Nothing secret is compiled into the bundle — unlike hard-coded
email/password credentials, which would be readable by anyone who views the deployed JavaScript.

This requires anonymous sign-ins to be enabled on the project: *Authentication → Sign In /
Providers → Anonymous sign-ins*. If they are off, the app shows a clear error with a retry button
rather than a login form.

Row level security still does its job: anonymous sessions get the `authenticated` role, so the
`auth.uid() = user_id` policies apply exactly as before and rows stay private to that session.

**The trade-off:** the data belongs to that browser. Clearing site data, or opening the app on
another device, starts a new anonymous identity and therefore an empty record. Use **Settings →
Export JSON** for a backup. A `hair-app.device.v1` marker in `localStorage` lets the app tell a
genuine first visit apart from a browser whose session was wiped: in that case it explains what
happened and offers a deliberate *Start a new record* button instead of silently opening an empty
record.

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
