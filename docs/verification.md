# Verification record

2026-10-22, local prototype.

## Passed

- TypeScript strict typecheck.
- Production build completed successfully for the app and API route.
- Six domain tests: connected sourced routes; point-to-point routing; bounded daytime shade scenarios; duplicate-credit protection; reservation/confirmation/failure/expiry accounting; monthly allocation enforcement.
- Chromium rendered the desktop (1440 px) and phone (390 px) layouts with no page errors or horizontal overflow.
- End-to-end browser/API/database journey: anonymous API protection; desktop route saving; explicit height scenario; labelled simulated activity and single credit on replay; saved routes and balances shared across independent signed-in browser contexts; mobile planning and saving; mobile and desktop water reservation; same pending code visible on either; failure release; single deduction on repeated confirmation.

## Practical limits

- Phone verification used a mobile browser viewport, not a physical handset run.
- The prototype records foreground browser geolocation. Background/screen-off tracking is not promised. GPS plausibility checks do not prove that a device location is authentic.
- Water dispensing is an operator simulator. No physical machine, location, stock or partnership is represented as confirmed.
- Account synchronisation was verified locally using the starter's mock sign-in. Hosted sign-in and remote device access need a future deployment.
- All map features come from the attributed OSM snapshot. Building heights and canopy are missing; the shade scenario uses an explicit assumed height, convex shadow envelopes and a 120 m projection cap. It excludes trees, clouds and roof overhangs. Below 5 degrees solar elevation, estimates are unavailable.
- Demonstration walks are labelled and excluded from real participation evidence. Configurable illustrative rules: 50 m per point, 60 points per simulated bottle, four rewards per calendar month.

No GitHub repository was created or published during this local baseline build.
