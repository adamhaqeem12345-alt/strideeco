# StrideEco

Plan a walk through Elmina, compare explicitly labelled building-shadow scenarios, record an activity and try a drinking-water reward. Responsive planning, route saving/sharing, wallet and water redemption work on phone and desktop layouts.

## Deploy to Vercel

Import this repository's **main** branch into Vercel. Use the repository root, **Next.js**, the default `.next` output and the included `vercel.json`. The standard commands are `npm ci` and `npm run build`. No Cloudflare account or Sites runtime is required by the active app.

**The public route planner deploys without credentials.** Persistent account features require these server-only environment variables:

| Variable | Purpose |
| --- | --- |
| `AUTH_SECRET` | A private random value of at least 32 characters for Auth.js sessions |
| `AUTH_GITHUB_ID` | GitHub OAuth application client ID |
| `AUTH_GITHUB_SECRET` | GitHub OAuth application client secret |
| `TURSO_DATABASE_URL` | URL of a persistent remote **libSQL** database |
| `TURSO_AUTH_TOKEN` | Database access token |

Create a GitHub OAuth application with callback `https://YOUR-PRODUCTION-DOMAIN/api/auth/callback/github`. This is for StrideEco user sign-in; it is separate from Vercel's GitHub repository connection. Only profile access is requested. Register a separate OAuth app for local testing with callback `http://localhost:5173/api/auth/callback/github`.

Optionally set `AUTH_URL` to the canonical production origin. Use separate credentials and a separate database for preview deployments. Do not prefix secrets with `NEXT_PUBLIC_` or commit `.env.local`.

Apply the database migrations once from a trusted local terminal using the target deployment's database environment variables:

```sh
npm ci
npm run db:migrate
```

The migration runner records checksums and safely skips files already applied. Migrations are intentionally separate from builds. After configuring the environment, redeploy in Vercel. Before those settings are ready, sign-in explains that account features are unavailable while the planner remains usable.

Vercel local files are not used for account persistence. The application rejects `file:` database URLs when running on Vercel. This repository does not provision a database or create paid services automatically.

## Run locally

Requires Node.js 22.13+ and npm:

```sh
npm ci
npm run dev
```

Open http://localhost:5173. For account features, copy `.env.example` to `.env.local`, set the Auth.js/GitHub settings and a database URL, then run `npm run db:migrate`. For a local SQLite-compatible test database use `TURSO_DATABASE_URL=file:.data/strideeco.db` and leave `TURSO_AUTH_TOKEN` empty. The migration runner creates the directory. The Windows launcher is `Start_StrideEco.cmd`.

## PACE journey

1. **Plan:** choose a loop or destination, distance, departure time and start point. Compare, save or share routes on either layout.
2. **Act:** foreground browser location recording, or a clearly labelled demo walk. Background/screen-off tracking is not promised.
3. **Collect:** the server validates submitted activity and credits points once. Demo activities are separately labelled and excluded from real participation evidence.
4. **Exchange:** reserve a water code and simulate successful or failed dispensing. Confirmation deducts points once; failure/expiry releases the reservation.

Illustrative rules: **50 metres per point · 60 points per bottle · four rewards per calendar month · 15-minute code reservation**. These are prototype assumptions. The monthly cap also lives in the accounting migration, so changing it requires a new migration.

**All dispensing is simulated.** No physical machine, stock, funding agreement or operator participation is represented as confirmed. GPS plausibility checks do not prove that device coordinates are authentic. No real resident statistics or live heatmap is claimed.

## Public data and shade limits

`elmina-osm.xml` is the attributed public OpenStreetMap snapshot. `scripts/prepare-map.py` derives `lib/elmina-map.json`; `public/data/map-provenance.json` records its source and retrieval date.

The snapshot has **88 eligible walking ways and 582 building footprints**, with no building-height tags or tree-canopy features. Shade is unavailable by default. The optional scenario uses a visibly chosen assumed height, approximate solar position and convex building-shadow envelopes capped at 120 metres. Trees, clouds and roof overhangs are excluded; estimates are unavailable below 5° solar elevation. It is not measured shade, thermal comfort or a temperature forecast.

Map data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), under ODbL. See `docs/data-sources.md`.

## Verification

```sh
npm run check
npm test
npm run build
```

The six domain tests cover connected graph routes, destination endpoints, shade-scenario bounds, duplicate credits, reservation accounting and monthly limits. With Playwright and its Chromium browser installed, `node scripts/verify-local.mjs` runs the browser/API/database journey against a temporary database and local production server after a build. Set `STRIDEECO_PLAYWRIGHT` to an existing Playwright module path if needed. The harness uses signed test sessions; it does not add a production authentication bypass.

See `docs/verification.md` for the scope and remaining checks. Live GitHub OAuth, remote database access, physical handset GPS and actual vending hardware require their respective configured environments.

Without a browser installation, `node scripts/verify-local.mjs --api-only` checks the production-server API and libSQL accounting using an isolated temporary database and signed test sessions. Run `npm test` first to prepare the test graph bundle.

## Source branches and main code

- **main:** Vercel-compatible Next.js app, Auth.js sessions and libSQL persistence.
- **sites-local:** preserved Cloudflare/Sites baseline from the earlier local prototype; its original setup instructions apply only on that branch.
- `components/stride-app.tsx`: responsive PACE screens.
- `components/route-map.tsx`, `lib/geo.ts`: map interactions, sourced graph routing and shadow scenarios.
- `auth.ts`, `app/api/auth/`: signed sessions and GitHub OAuth.
- `lib/database.ts`, `app/api/pilot/route.ts`: authenticated account operations and parameterised SQLite statements.
- `drizzle/`: original schema and atomic points-accounting triggers, unchanged by the hosting port.

Legacy Sites tooling remains in the source for reference, but the active Next.js build does not import its Cloudflare worker or header-based sign-in implementation.
