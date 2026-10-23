# StrideEco

Plan a walk through Elmina, compare explicitly labelled building-shadow scenarios, record an activity and try a simulated drinking-water reward. The PACE interface supports planning, saving, sharing, wallet access and water redemption on phone and desktop layouts; account features also need configured authentication and an application database.

## Account loading and availability

Auth navigation and form mounting now show loading indicators on [strideeco.vercel.app](https://strideeco.vercel.app), initially published as READY deployment `dpl_Dh8jSEGHM2iYep92DeAwLnXvTSmX`, source `c11d229c546522a9b864a6752e4836c71ec3593f`. Account data has loading, ready and unavailable states with retry, unknown balances stay unavailable, and failed refreshes preserve previously verified data while blocking writes. Local checks and 14 staged/live checks pass, including real development-instance sign-in/sign-out and exact fixture cleanup. The dedicated free database is now provisioned and all four migrations verified; a fresh deployment and hosted persistence checks are pending. See [account-loading.md](docs/account-loading.md) and [remote-storage-verification.json](docs/remote-storage-verification.json).

## Brand refresh

The latest footer correction is live at [strideeco.vercel.app](https://strideeco.vercel.app/): READY deployment `dpl_FxqVmhRma8cwZBPW3dVtLYcuZNeX`, application source `f8c439115d32067e08bd69e5745543efe80fdabb`. Reduced sidebar spacing keeps the complete footer visible on shorter laptop/tablet windows; independent sidebar scrolling makes it reachable in very short windows. Staged and live browser checks passed for those cases and all four mobile views. See [sidebar-footer-verification.json](docs/sidebar-footer-verification.json).

The initial owner-requested aqua, teal, green, yellow, coral and sky refresh was published as deployment `dpl_F7oFLPEiSigYreePiV6xec8DnNKW`, source `d1b6ad60d47c463303acc674f95f5d38fb826191` from `feature/brand-refresh`. The supplied SVG wordmark appears in navigation/account pages, with its smiling water drop as the favicon. Darker text and controls keep the bright palette readable.

Staged and live anonymous browser checks passed at 320, 390, 768 and 1440 pixels, including proportional logos, exact logo/icon SHA-256 matches, machine-type filtering, account forms and API 401 protection, with no page errors or account writes. Local checks separately passed the production build, TypeScript, 26 domain/ownership tests, contrast/focus checks and independent voucher QR decoding. Hosted account persistence remains deferred with the remote database. See [brand-refresh.md](docs/brand-refresh.md) and [the live verification report](docs/brand-hosted-verification.json).

## Water vouchers and machine map

The water-only flow adds six clearly labelled mock Elmina machine locations, nearest compatible machine suggestions, type filters and machine-bound vouchers. Each voucher has one code and one downloadable QR for the same single use; the authenticated simulator supports both entry methods. See [water-vouchers.md](docs/water-vouchers.md) for accounting, migration and verification details. Its earlier production release was `dpl_BXqkriDNSDyhgHyUc1WAks7ZqntQ`, source `41e1f23b2100bb2b4cf7b8a76ba292e709a0709a`; the current brand release above retains that functionality. The earlier hosted desktop/mobile map/filter and real development-instance UI signup/signin/signout checks passed, with fixture deletion confirmed. The brand release's hosted checks were anonymous. Live earning, shared wallet data and voucher redemption still require the deferred dedicated remote database. The full authenticated flow passes locally with all four migrations; normal laptop development is available at `http://localhost:5173`. [Draft PR #2](https://github.com/adamhaqeem12345-alt/strideeco/pull/2) preserves the earlier feature work; main is unchanged.

## Integration status

The earlier authentication release implemented Clerk sign-in/sign-up, account controls, sign-out and server-side account ownership. Its fifteen domain/identity tests, TypeScript and webpack build passed. The same `work/next-clerk-pinned-ui` artifact passed the isolated Clerk API suite, signed-out desktop/mobile checks, real development-instance UI sign-up/sign-in/sign-out, and the authenticated desktop/mobile PACE journey. Browser test users were removed and cleanup verified. These tests used isolated local databases; that checkpoint had three migrations, followed by the fourth migration for machine-bound water vouchers.

The [Clerk preview](https://strideeco-p510kznza-adam-haqeems-projects.vercel.app) is READY at application commit `e27731a882ccb25fef7d2794aa827cd84a99bc9a`. Vercel's standard Linux/Turbopack build passed. Desktop/mobile hosted checks confirm public planning, Clerk sign-in/sign-up forms, the GitHub option, the visible Development mode label and anonymous API rejection. A complete authenticated hosted PACE journey has not been verified.

Clerk authentication is now live on [strideeco.vercel.app](https://strideeco.vercel.app/sign-in), explicitly published at the user's request. The earlier production deployment `dpl_Dt9TT6b5zPzn99f9j6SN9Rn54GHP` was READY at application commit `aa4d35f5bf51cbd0b11ceafe66336309f4036ed6`. Real hosted UI signup, test-email verification, password sign-in, account menu and sign-out passed; mobile sign-in/sign-up forms passed with no overflow. The exact temporary user was deleted and cleanup confirmed.

The live site uses the existing Clerk **development** instance and displays Development mode. No production Clerk instance, remote database, database variables or remote migrations are configured; database setup remains deferred. Hosted saved routes, activities, wallet points and redemptions remain unavailable, with signed-in account-data requests returning 503. See `docs/verification.md` for evidence and limits.

Reuse the existing **StrideEco** Clerk application `app_3L3PLlwOzzZZaMzKCu3yv7KjSLe` and development instance `ins_3L3PLmdtUHei2quxSicUcO1ninw`. A fresh `clerk doctor --json` check confirms the saved login, correct application/instance link and local development keys; its remaining warning is that production is not configured. Do not create a replacement application or repeat login unless a safe status check proves the saved session unusable. This checkout uses `CLERK_CONFIG_DIR=C:/Users/User/Documents/Codex/2026-10-07/new-chat-2/work/clerk-cli`.

The development instance's `force_organization_selection` is verified `false`, allowing personal accounts to finish signup without choosing an organization. GitHub sign-in is enabled using Clerk's shared development credentials. Returning legacy users should choose GitHub on their first Clerk sign-in so its verified numeric provider ID can identify their existing records. The real GitHub OAuth round trip has not been exercised. The authentication migration originally preserved the earlier palette; the later owner-requested brand refresh now applies the supplied colors and wordmark to Clerk screens while retaining the CSS reset and authentication configuration.

## Deploy to Vercel

The current brand release was staged, checked and promoted from `feature/brand-refresh` at the user's request. [Draft PR #3](https://github.com/adamhaqeem12345-alt/strideeco/pull/3) retains the release source; GitHub **main** remains unchanged. The earlier authentication work remains in [draft PR #1](https://github.com/adamhaqeem12345-alt/strideeco/pull/1). Use the repository root, **Next.js**, the default `.next` output and the included `vercel.json`. The standard commands are `npm ci` and `npm run build`. `.vercelignore` excludes tests, work files, environment files and local databases from CLI deployment uploads. No Cloudflare account or Sites runtime is required by the active app.

**The public route planner deploys without credentials.** Persistent account features require these environment variables:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Public Clerk key for the selected instance; present at build time |
| `CLERK_SECRET_KEY` | Server-only Clerk secret for the same instance |
| `TURSO_DATABASE_URL` | URL of a persistent remote **libSQL** database |
| `TURSO_AUTH_TOKEN` | Server-only database access token |

Clerk owns the sign-in flow at `/sign-in` and `/sign-up`; StrideEco no longer uses the Auth.js callback or `AUTH_*` settings. Keep secrets out of `NEXT_PUBLIC_*` variables and Git. Use separate application data for preview/testing rather than a production database.

A deployment on `*.vercel.app` can use the existing Clerk **development** instance for a clearly labelled development/demo environment. Clerk production authentication requires an owned domain with editable DNS, a production instance of this same Clerk application, matching production keys, completed DNS/certificate setup, and production OAuth credentials for enabled social providers. No production instance or domain is configured here. Do not register a domain, enable a paid feature or replace the existing app to remove this boundary. See [Clerk on Vercel](https://clerk.com/docs/guides/development/deployment/vercel) and [Clerk production setup](https://clerk.com/docs/guides/development/deployment/production).

### Minimal remote persistence

**Setup was previously deferred and is now blocked on the team's Turso installation.** The current account-data fix request resumes this work. Use one dedicated **free** [Turso Cloud Vercel Marketplace resource](https://vercel.com/marketplace/tursocloud) connected only to the existing `strideeco` project (`prj_FvTRxoEPeOR71PGe4KGLslAaiWVN`, team `team_dkd2AminqynD5q6GdLALg75T`). CLI authentication and the project link work. After reported human acceptance, a fresh authorized free installation attempt still returned `integration_terms_acceptance_required`, before creating a resource. Native acceptance reports: "Term acceptance cannot be performed by an AI agent. Run this command directly in your terminal." The human-run interactive command is:

```powershell
npx vercel --scope adam-haqeems-projects integration accept-terms tursocloud
```

After acceptance is confirmed server-side, verify the `starter` plan remains free, then provision and connect only the dedicated resource:

```powershell
npx vercel --scope adam-haqeems-projects integration add tursocloud --name strideeco-demo --plan starter --metadata region=iad1 --environment production --environment development --no-env-pull
```

Leave paid options and overages disabled; do not reuse another project's database or repeat provisioning after a resource has already been created. The integration supplies `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`. Verify their names without printing values and transfer target credentials privately for migration. Clerk stores identities; it does not store StrideEco routes, activities, wallets or redemptions.

After configuring the target database environment securely, apply the migrations from a trusted terminal:

```sh
npm ci
npm run db:migrate
```

The runner applies `0000_condemned_firestar.sql`, `0001_wallet_accounting.sql`, `0002_clerk_identities.sql` and `0003_machine_water_vouchers.sql`, records checksums and skips unchanged applied files. Never edit an applied migration. Migrations are separate from builds. Verify all four recorded migrations before deploying and rerun the application journey against the remote database after deployment.

Vercel local files are not account persistence: the application rejects `file:` database URLs there. Configure real instance keys in the correct Vercel environments and redeploy after changes. Never upload the isolated harness's synthetic key-shaped placeholders, `CLERK_JWT_KEY` or `STRIDEECO_TEST_PRIVATE_KEY` to Vercel. This repository does not provision a database or create paid services automatically.

## Run locally

Requires Node.js 22.13+ and npm:

```sh
npm ci
npm run dev
```

Open http://localhost:5173. Use `localhost` consistently for Clerk-enabled loopback URLs and server binding; mixing `127.0.0.1` with Next.js's normalized `localhost` caused a proxy rewrite loop in the old verification harness. Preserve `.env.local` with the selected Clerk application's development keys and `TURSO_DATABASE_URL=file:.data/clerk-development.db`; all four migrations have been applied to this laptop-only database. For a fresh checkout, copy `.env.example`, configure the same-instance development keys privately, set a database URL and run `npm run db:migrate`. An isolated local database uses a `file:` URL with an empty `TURSO_AUTH_TOKEN`; the migration runner creates the directory. This demonstrates local persistence only. The Windows launcher is `Start_StrideEco.cmd`.

On this Windows checkout, the default Turbopack build hit a denied junction operation and the existing `.next` output also hit a permission error. The successful checkpoint workaround used webpack and a separate output directory without deleting the old build:

```powershell
$env:STRIDEECO_BUILD_DIR = 'work/next-clerk-pinned-ui'
node node_modules/next/dist/bin/next build --webpack
```

Keep the same `STRIDEECO_BUILD_DIR` when starting that production build or running its verification harness. The default output remains `.next` when unset. These local filesystem errors do not establish that the Vercel build fails.

## Account ownership

`auth_identities` maps each Clerk user to a stable application ID, with uniqueness constraints on both columns. Returning GitHub users retain their original `github:<numeric provider ID>` only when Clerk's server-side identity reports a **verified** GitHub external account with that immutable numeric ID. Email, username, client input and editable metadata are never ownership evidence. New users receive `clerk:user_...` IDs. Conflicting or ambiguous legacy claims fail without moving or combining balances; existing wallets, routes, activities and point events remain under their original IDs.

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

`npm test` runs 26 routing, accounting, identity, machine, voucher and migration tests. The nine identity-ownership tests cover legacy data preservation, rejected unverified/editable claims, canonical numeric provider IDs, stable existing mappings, concurrent duplicate/competing claims, duplicate ownership, ambiguous legacy matches and mismatched server identities.

After a build, `node scripts/verify-local.mjs` runs the isolated API/database harness with a temporary database and ephemeral RSA-signed sessions verified by Clerk's SDK. The corrected harness passes against `work/next-clerk-pinned-ui`, including token/header rejection, account isolation, sharing, replay-safe credits and reservation accounting; `outputs/vercel-api-report.json` records this run. It exercises session verification and data rules, not a real Clerk sign-in round trip. No production bypass endpoint is provided.

For the real development Clerk browser journey, use the dedicated runner with the existing `.env.local` development keys and the built output:

```powershell
$env:STRIDEECO_BUILD_DIR = 'work/next-clerk-pinned-ui'
$env:STRIDEECO_PLAYWRIGHT = 'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'
$env:STRIDEECO_BROWSER_EXECUTABLE = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
node scripts/verify-clerk.mjs
```

The runner refuses production keys, starts a separate server at `http://localhost:5175` (override with `STRIDEECO_CLERK_TEST_PORT`) and migrates a fresh temporary local database. It generates one timestamped `strideeco-e2e+clerk_test_...@example.com` fixture and a random password in process memory. `tests/browser-auth.cjs` creates that development user through the visible signup form, uses Clerk's official bot-bypass testing token and test OTP, checks UI sign-out/sign-in and saved-route recovery, then `tests/browser-flow.cjs` uses the same account through Clerk's official testing helper for desktop/mobile PACE checks. This tests real development sessions, not production auth, real email delivery or GitHub OAuth.

In `finally`, the runner queries only the exact generated email and deletes that one Clerk development user if uniquely matched, then stops its server. Ambiguous identity or unconfirmed cleanup fails the run. Existing users are not selected or deleted; temporary local database files remain local. Reports are `outputs/clerk-browser-auth-report.json` and `outputs/e2e-report.json`. Do not run the child browser tests with a guessed user's email or upload their fixture variables to Vercel.

See `docs/verification.md` for current results. Remote persistence, a complete live Clerk browser round trip, physical handset GPS and actual vending hardware each require their own evidence.

## Source branches and main code

- **Local migration source:** Vercel-compatible Next.js app, Clerk sessions and libSQL persistence; deployment status is recorded above.
- **sites-local:** preserved Cloudflare/Sites baseline from the earlier local prototype; its original setup instructions apply only on that branch.
- `components/stride-app.tsx`: responsive PACE screens.
- `components/route-map.tsx`, `lib/geo.ts`: map interactions, sourced graph routing and shadow scenarios.
- `auth.ts`, `proxy.ts`, `components/auth-page.tsx`: Clerk session verification and sign-in/sign-up UI.
- `lib/account-identity.ts`, `drizzle/0002_clerk_identities.sql`: stable mapping to existing application ownership.
- `lib/database.ts`, `app/api/pilot/route.ts`: authenticated account operations and parameterised SQLite statements.
- `drizzle/`: schema, atomic points-accounting triggers and the additive Clerk identity mapping.

Legacy Sites tooling remains in the source for reference, but the active Next.js build does not import its Cloudflare worker or header-based sign-in implementation.
