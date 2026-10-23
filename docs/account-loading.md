# Account data and auth loading

## Published database connection — 23 October 2026

[strideeco.vercel.app](https://strideeco.vercel.app) serves READY deployment `dpl_8Dy6uJeXc1F1zWQWRQwTSdPerYF6`, application source `d676bb0a3c56f69ce20bac8fdf7e78295202d6ec` on `fix/account-data-loading`. Deployment metadata and the public alias were independently verified. [Draft PR #4](https://github.com/adamhaqeem12345-alt/strideeco/pull/4) preserves the changes without merging main.

The reported account-data error followed successful Clerk authentication: Vercel had no application database. After the retained human receipt confirmed personal terms acceptance, the dedicated free `strideeco-demo` Turso Starter database was provisioned in `iad1`, connected only to the existing project in production/development. All four migrations, stored checksums and an unchanged rerun pass. Existing Clerk configuration and the laptop's local environment were preserved. No customer records or wallet balances were copied or seeded. See `remote-storage-verification.json`.

The staged deployment passes visible signup/test OTP, real account API `200` with zero initial points, route saving/sharing and two labelled demo walks earning 142 points. A chilled-water voucher uses manual entry and a refill voucher uses the independently decoded QR. Each deducts 60 points once, releases its reservation and rejects an opposite-method replay with `409`. Known-position nearest/type matching is checked. Sign-out returns `401`, password sign-in restores the records, and a fresh 390 px mobile session restores the same 22-point balance after the explicit new-device email verification.

The public alias independently passes signup, real account API `200`, route saving/sharing, one labelled demo walk earning 71 points, sign-out/password sign-in and fresh mobile persistence. Both hosted runs have no browser errors and confirm deletion of the exact temporary Clerk identity and only its application records. The live run completed at `2026-10-23T08:36:58.144Z`. See `account-ready-hosted-verification.json`.

Authentication still uses the existing Clerk development instance and test email OTP; real email delivery and GitHub OAuth are untested. Machine locations and dispensing remain explicitly mock.

## Earlier loading/failure-handling release

The first UI correction was published as `dpl_Dh8jSEGHM2iYep92DeAwLnXvTSmX`, source `c11d229c546522a9b864a6752e4836c71ec3593f`, before the database variables existed. Its staged/live runs each passed 14 checks covering five auth entry points, delayed Clerk forms, actual storage-unavailable `503`, unknown balances, disabled writes, retry and sign-out with cleared private state. No application POSTs or browser errors occurred; exact temporary-user cleanup was confirmed. That historical result is retained in `account-loading-hosted-verification.json`; it does not describe the current connected release.

## Interface and API correction

- Next links show an accessible pending indicator when opening sign-in or account creation. Programmatic sign-in navigation has the same feedback. Auth route boundaries and Clerk's supported fallback show a branded loading card until the form is ready.
- Signed-in account data has explicit loading, ready and unavailable states. Unknown balances are shown as unavailable; a failed refresh preserves and labels previously verified data. Public planning remains usable.
- A persistent notice offers retry. Failed background refreshes no longer generate repeated error toasts or live announcements. Saving, activity submission, consent changes and voucher simulation are blocked until account data is ready.
- Missing storage configuration returns a safe `503` and `ACCOUNT_STORAGE_NOT_CONFIGURED`. Other account failures use `ACCOUNT_DATA_UNAVAILABLE`; unconfirmed writes instruct the client to refresh before retrying. The server still enforces identity ownership and atomic accounting.

These states handle temporary storage failures while the connected database supplies persistent account data. Wallet balances are derived from server accounting; no wallet is seeded by this fix.

## Local verification

`work/next-account-loading-2` passes the production webpack build and TypeScript. All 28 domain, ownership, configuration, migration, machine and voucher tests pass, including missing storage and forbidden hosted file-database checks.

The focused real-Clerk development browser suite passes 19 checks at 1440×1000 and 390×844: delayed initial account data, unknown balances, real route saving and demo credit, simulated outages, preserved state and real retry recovery; all five public auth entry points with delayed routes; delayed Clerk SDK fallback and usable forms. Browser errors are empty and exact temporary-user deletion is confirmed. The API `200` responses and saved data are real in the isolated local database; only transport delays and explicit `503` outages are simulated. See `account-loading-browser-verification.json`.

```powershell
$env:STRIDEECO_BUILD_DIR = 'work/next-account-loading-2'
node scripts/verify-clerk.mjs --account-loading-only
```

This opt-in mode uses the existing isolated fixture/database lifecycle. It does not repeat password signup or GitHub OAuth, and does not establish hosted persistence. Hosted evidence is recorded separately above.
