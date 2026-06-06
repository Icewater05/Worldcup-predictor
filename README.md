# World Cup Predictor — self-hosted

A group-stage + knockout prediction game with unique names, private leagues, a
global leaderboard, a live tournament tracker, and optional auto-sync of results.

This is the Claude artifact converted into a normal Vite + React app. The only
things that changed from the artifact are the storage layer (now Supabase) and
the auto-sync (now a serverless function with your own API key). All the UI,
scoring, drag-and-drop, and rankings are unchanged.

---

## What you'll set up

1. **Supabase** — a free database that holds the shared pool data.
2. **Vercel** — free hosting for the site + the auto-sync serverless function.
3. (Optional) **Anthropic API key** — only needed if you want auto-sync. Without
   it, the host enters results manually (the app works fully without it).

Total time: ~30–45 minutes. Cost: $0 on free tiers (a custom domain is optional).

---

## 1. Run it locally first

```bash
npm install
cp .env.example .env      # then fill in the two VITE_ values (see step 2)
npm run dev
```

Open the printed localhost URL. Until you add Supabase keys you'll see a banner
saying shared data isn't connected — that's expected.

## 2. Create the Supabase database

1. Make a free project at https://supabase.com.
2. In the dashboard go to **SQL Editor**, paste the contents of `supabase.sql`,
   and run it. This creates the `kv` and `profiles` tables and their policies.
3. Enable accounts: **Authentication → Providers → Email** (on by default). For
   the lowest-friction setup, turn **"Confirm email" OFF** so people can sign up
   and play immediately. If you leave it ON, new users must click an email link
   before their first sign-in (the app will tell them to check their email).
4. Go to **Project Settings → API** and copy:
   - **Project URL** → `VITE_SUPABASE_URL` (and `SUPABASE_URL`)
   - **anon public** key → `VITE_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (keep this secret)
5. Put the two `VITE_` values in your local `.env`, then restart `npm run dev`.
   The banner disappears and you can create an account and predict.

> Accounts & names: players sign in with email + password. Display names are
> globally unique (enforced by the database) and tied to the account, so anyone
> can sign in from any device and edit their own picks. Per-row security: a user
> can only write their own profile; signed-in users can read/write pool data
> (fine for a friends pool — tighten the `kv` policy in `supabase.sql` if you
> want stricter control).

## 3. Push to GitHub

```bash
git init && git add . && git commit -m "World Cup Predictor"
# create an empty repo on github.com, then:
git remote add origin https://github.com/YOU/worldcup-predictor.git
git push -u origin main
```

## 4. Deploy on Vercel

1. At https://vercel.com, **Add New → Project**, and import your GitHub repo.
2. Vercel auto-detects Vite (build `npm run build`, output `dist`). Accept defaults.
3. Under **Settings → Environment Variables**, add all of these
   (see `.env.example`):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `ANTHROPIC_API_KEY`  *(only if using auto-sync)*
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Deploy. You'll get a public URL like `your-app.vercel.app` — share it with
   friends. Add a custom domain under **Settings → Domains** if you like.

The `/api/sync` function deploys automatically from the `api/` folder.

## 5. Auto-sync (optional)

- **Manual / on open:** the host opens the **Results** tab and the app calls
  `/api/sync` (also a "Sync now" button). The function uses the Anthropic API
  with web search to fetch current standings/knockout results and writes them to
  Supabase for everyone.
- **Fully automatic:** `vercel.json` includes an hourly cron hitting `/api/sync`
  so results update with nobody's browser open. Note: Vercel's Hobby plan limits
  cron frequency — for match-day updates every few minutes, either upgrade, or
  use a free external scheduler (e.g. cron-job.org) pointed at
  `https://your-app.vercel.app/api/sync`.
- If you don't want auto-sync at all, delete `vercel.json` and `api/sync.js` and
  skip the Anthropic env var. The host can enter results by hand.

---

## How the pieces map

| Concern              | Where it lives                                  |
|----------------------|-------------------------------------------------|
| UI / scoring / game  | `src/App.jsx`                                   |
| Accounts & names     | Supabase Auth + `profiles` table                |
| Shared data          | Supabase `kv` table via `src/store.js`          |
| Live result sync     | `api/sync.js` (Anthropic + web search → Supabase) |

**Tabs:** Predict (rank groups + pick the knockout), Board (league/global
leaderboard + tournament tracker), **Bracket** (visual round-by-round bracket —
toggle between the live actual results and your own predicted run), Results
(host area: auto-sync or manual entry).

The app reads/writes a handful of keys: `wc26:pred:<name>`, `wc26:results`,
`wc26:knockout`, `wc26:group:<code>`. Nothing else to manage.

## Common gotchas

- **Banner won't go away:** the `VITE_` vars must be set at build time. After
  adding them on Vercel, redeploy.
- **Sync returns an error:** check the three server env vars are set and that you
  ran `supabase.sql`. The function returns `{ ok:false, error:... }` to help.
- **Names:** display names are globally unique and tied to the account, so sign
  in with the same email on any device to edit your picks. If sign-up seems to
  hang, check whether "Confirm email" is on (users must click the email link
  first) — turn it off in Supabase for instant access.
