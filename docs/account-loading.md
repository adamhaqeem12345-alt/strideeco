# Account loading and availability

The reported message appeared after successful Clerk authentication: resolving the application account then required the dedicated database that was still unconfigured on Vercel. Fresh checks found only the two Clerk variables, zero Turso installations and zero storage resources. A free installation attempt after the owner's reported terms acceptance still returned `integration_terms_acceptance_required`, before creating a database. No resource, migration or environment change resulted. The exact human-terminal receipt is needed to resolve that installation mismatch; do not repeat acceptance or provision duplicate resources blindly.

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

This opt-in mode uses the existing isolated fixture/database lifecycle. It does not repeat password signup or GitHub OAuth, and does not establish hosted persistence. Hosting results will be recorded after the staged build is verified and published.
