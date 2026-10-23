# Account loading and availability

## Database provisioned; activation verification pending

After the retained human receipt confirmed successful terms acceptance, one dedicated free `strideeco-demo` Turso Starter database was created in `iad1`, connected only to the existing StrideEco project in production/development. Vercel now holds the two database variables; Clerk variables and the laptop's local environment were preserved. All four migrations applied, their stored checksums match, and a second run safely skipped each migration. No customer records or demo points were copied or seeded. See `remote-storage-verification.json`.

The UI release recorded below was built before those database variables existed. A new deployment must activate the connection, and real hosted persistence must pass verification before being described as operational.

## Published UI correction — 23 October 2026

[strideeco.vercel.app](https://strideeco.vercel.app) serves READY deployment `dpl_Dh8jSEGHM2iYep92DeAwLnXvTSmX`, source `c11d229c546522a9b864a6752e4836c71ec3593f` on `fix/account-data-loading`. The production build was staged, checked and promoted; the public alias/source were independently verified. [Draft PR #4](https://github.com/adamhaqeem12345-alt/strideeco/pull/4) preserves the changes without merging main.

Both staged and live browser runs pass 14 checks at 1440×1000 and 390×844: all five auth entry points, delayed Clerk form loading, real development-instance sign-in, the actual unconfigured-storage `503`, disabled mutations, unknown balances, retry and UI sign-out with API `401` and cleared private markers. No application POSTs or browser errors occurred. Each run's exact temporary Clerk identity was deleted and cleanup verified. The live run completed at `2026-10-23T08:01:11.465Z` (16:01 MYT). See `account-loading-hosted-verification.json`.

This verifies the initial published loading/failure-handling fix. Its observed storage-unavailable result applies to that deployment; the new database connection is being activated separately.

The reported message appeared after successful Clerk authentication: resolving the application account then required the dedicated database that was unconfigured on Vercel. Initial checks found only the two Clerk variables, zero Turso installations and zero storage resources. An initial free installation attempt returned `integration_terms_acceptance_required` before resource creation. A later retained human-terminal receipt confirmed actual acceptance, allowing the dedicated resource described above to be provisioned. Do not repeat acceptance or create a duplicate database.

## Interface and API correction

- Next links show an accessible pending indicator when opening sign-in or account creation. Programmatic sign-in navigation has the same feedback. Auth route boundaries and Clerk's supported fallback show a branded loading card until the form is ready.
- Signed-in account data has explicit loading, ready and unavailable states. Unknown balances are shown as unavailable; a failed refresh preserves and labels previously verified data. Public planning remains usable.
- A persistent notice offers retry. Failed background refreshes no longer generate repeated error toasts or live announcements. Saving, activity submission, consent changes and voucher simulation are blocked until account data is ready.
- Missing storage configuration returns a safe `503` and `ACCOUNT_STORAGE_NOT_CONFIGURED`. Other account failures use `ACCOUNT_DATA_UNAVAILABLE`; unconfirmed writes instruct the client to refresh before retrying. The server still enforces identity ownership and atomic accounting.

These changes improve loading and failure handling. They do not replace persistent storage with browser data, seed a wallet, or make unavailable hosted earning/redemption operational.

## Local verification

`work/next-account-loading-2` passes the production webpack build and TypeScript. All 28 domain, ownership, configuration, migration, machine and voucher tests pass, including missing storage and forbidden hosted file-database checks.

The focused real-Clerk development browser suite passes 19 checks at 1440×1000 and 390×844: delayed initial account data, unknown balances, real route saving and demo credit, simulated outages, preserved state and real retry recovery; all five public auth entry points with delayed routes; delayed Clerk SDK fallback and usable forms. Browser errors are empty and exact temporary-user deletion is confirmed. The API `200` responses and saved data are real in the isolated local database; only transport delays and explicit `503` outages are simulated. See `account-loading-browser-verification.json`.

```powershell
$env:STRIDEECO_BUILD_DIR = 'work/next-account-loading-2'
node scripts/verify-clerk.mjs --account-loading-only
```

This opt-in mode uses the existing isolated fixture/database lifecycle. It does not repeat password signup or GitHub OAuth, and does not establish hosted persistence. Hosted evidence is recorded separately above.
