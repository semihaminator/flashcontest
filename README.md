# Salsa Flash — referral flash contest for agents

Public page (RU / UA / EN) with countdown, prizes, rules and a live leaderboard, plus a password-protected admin panel at `/admin`.

No framework and no npm dependencies: static files in `public/`, two Vercel serverless functions in `api/`, data stored in Upstash Redis.

## Deploy (one time, ~5 minutes)

1. **GitHub:** create a new repository and upload the contents of this folder (or `git push` it).
2. **Vercel:** Add New → Project → import that repository. Framework preset: **Other**. Leave build settings empty → Deploy.
3. **Database:** in the Vercel project open **Storage → Create / Connect → Upstash (Redis)** → connect it to the project (free plan is enough). This adds the `KV_REST_API_URL` and `KV_REST_API_TOKEN` variables automatically.
4. **Admin password:** Settings → Environment Variables → add `ADMIN_PASSWORD` = a strong password.
5. **Redeploy** (Deployments → ⋯ → Redeploy) so the new variables are picked up.

Open `https://<your-project>.vercel.app/admin`, sign in, add agencies, press **Save & publish**.

## Admin panel

- Each agency has: **name**, **number of streamers**, **total coins**, **number of streamers with 9 750+ coins**, and **last invite** time (the "Now" button fills in the current time).
- Totals accept `500000`, `500 000` or `500k`.
- **Bulk import:** paste rows `agency name, streamers, total coins, streamers 9 750+, last invite` from a spreadsheet. Same name → updated, new name → added.
- **Hide** keeps an agency in the admin but removes it from the public page. **Export CSV** downloads everything.
- Nothing goes live until you press **Save & publish**. The public page refreshes every minute (cached up to 30 s).
- Data saved by the earlier version (streamer lists + agency IDs) is converted automatically.

## Ranking logic (`api/_lib/store.js`)

An agency qualifies when it has ≥ 10 streamers, ≥ 500 000 coins total and ≥ 6 streamers with ≥ 9 750 coins.
Qualified agencies are ranked by total coins and get places 1, 2, 3…; non-qualified agencies are shown below with progress bars and no place.

## Editing

- Dates: `public/i18n.js` → `CONTEST` (start / end, currently +03:00).
- Texts in all three languages: `public/i18n.js`.
- Thresholds: `RULES` in `api/_lib/store.js` (and the same numbers at the top of `public/admin.html`).

## Local preview

`node dev-server.mjs` → http://localhost:3000 (admin password `test`, data saved to `.data.json`).
