# StrideEco prototype

A mobile-first, responsive PACE experience: plan a route, record or demonstrate a walk, collect prototype points, and try a drinking-water redemption. Planning, saving, sharing, wallet and redemption work on both phone-sized and desktop layouts.

## Open the prepared workspace

Double-click `Start_StrideEco.cmd`, or run `npm run dev`. The launcher opens the local browser after the server is ready. The local URL is normally http://127.0.0.1:5173/.

This workspace already has its dependencies and local database prepared. No GitHub repository has been created.

## Set up a fresh source download

Requires Node.js 22.13+ and npm. Run from the project directory:

```powershell
npm install
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_condemned_firestar.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_wallet_accounting.sql
npm run dev
```

Apply each migration once, in order, to a fresh database. The source archive intentionally excludes installed dependencies, build output, local accounts, cookies and database files. The provided scripts retain the Sites portable execution profile and are compatible with the supported Sites workflow when a future hosting project is registered.

The loopback development sign-in uses the starter's local preview account. It is not production authentication. Hosted sign-in remains owned by the Sites platform. Browser-local storage is not used as the account database.

## Review the journey

1. Plan a round trip or choose a destination. Change distance, date, departure time or start location. Select a route, save it or share its link.
2. Enable the optional building-height scenario to compare modelled building shadows. The assumed height is explicit. Tree shade is unavailable in the public snapshot.
3. Sign in, choose a longer route if needed, and open My activity. Try the labelled demo walk, or use foreground location recording.
4. Open Water rewards. Prototype rules currently use 50 m per point and 60 points per bottle. Pending rewards reserve points; confirmation deducts once; failure or expiry releases the reservation.
5. Open another browser session and sign into the same local preview account. Saved routes, wallet and pending codes come from the same database. A future HTTPS deployment is needed to test separate physical devices.

All dispensing is simulated. No machine location, stock, funding agreement or operator integration is claimed as live. Illustrative limits are four water redemptions per calendar month; changing this cap requires a new accounting migration as well as updating displayed rules.

## Data

`elmina-osm.xml` is the single public OSM snapshot used by `scripts/prepare-map.py`. `lib/elmina-map.json` is the derived basemap and walking graph. The public provenance record is `public/data/map-provenance.json`.

The snapshot contains 88 eligible walkable ways and 582 building footprints, with zero building-height or tree-canopy features. Those omissions are visible in the application. Assumed-height shadows are scenarios, not measured shade coverage, thermal comfort or a temperature forecast.

Map data © OpenStreetMap contributors, under ODbL: https://www.openstreetmap.org/copyright. See `docs/data-sources.md` and `docs/verification.md`.

## Checks

```powershell
npm run check
npm test
npm run build
```

The six domain tests cover connected routes, destination paths, scenario bounds, duplicate activity credit, reservation accounting and monthly limits. Browser/API/database verification is documented in `docs/verification.md`; screenshots and the test report are in the review bundle.

`tests/browser-flow.cjs` preserves the browser journey. It requires a running local server, Chrome and Playwright tooling. Set `STRIDEECO_PLAYWRIGHT` to an existing Playwright module path if it is not installed in the project; Playwright is not a production dependency.

## Main code

- `lib/geo.ts`: graph routing, distance, solar position and explicit building-height scenarios.
- `components/stride-app.tsx`: responsive PACE screens and product interactions.
- `components/route-map.tsx`: interactive basemap drawn from the real snapshot; no tile key needed.
- `app/api/pilot/route.ts`: authenticated saved routes, activity checks, wallet and redemption endpoints.
- `db/schema.ts` and `drizzle/`: persistent records and atomic accounting triggers.
- `docs/`: product scope, data provenance and verification limits.

## Windows execution note

The managed tool environment's quoted npm shim failed, while invoking npm's JavaScript entrypoint worked. For that environment, equivalent framework commands are `node scripts/run-framework.mjs dev` and `node scripts/run-framework.mjs build`. The final dependency install, typecheck, domain tests and browser journey completed successfully.
