# Mock water vouchers and township machines

Implemented 2026-10-23. This extends the existing PACE wallet; it does not connect physical vending hardware.

## Behaviour

- The planner and Water rewards map show six explicitly **mock** stops within the existing Elmina map coverage. These coordinates are an illustrative catalog, separate from sourced OpenStreetMap features. They are not a confirmed machine inventory.
- Ambient bottled water, chilled bottled water and water refills are the only machine types. Each illustrative 500 ml reward costs 60 prototype points.
- The directory ranks compatible enabled machines by Haversine straight-line distance. Its reference is labelled: planned route finish, last recorded/demo position, or an explicitly requested browser location. This is not walking-distance routing to a machine.
- A reservation binds the voucher to one machine, its type and its reward snapshot. Points are reserved for 15 minutes. The existing four-per-month allocation still counts pending and confirmed rewards.
- A cryptographically random 128-bit code and its locally generated QR encode the same voucher. QR generation and decoding do not send the credential to a third-party image service. Downloading a QR does not create another redemption.
- The authenticated mock simulator accepts manual code entry or decodes the displayed QR. Ownership, credential, assigned machine, current machine type, pending status and expiry are checked server-side. One atomic conditional update consumes the voucher, and the original database triggers deduct points exactly once.
- A replay conflicts, an expired voucher cannot spend, and a wrong machine or account cannot consume or release it. Simulated failure or expiry releases the reservation. Neither the code nor QR can be reused after success.

## Database and deployment boundary

`0003_machine_water_vouchers.sql` is additive. It retains earlier wallets, history, applied migration checksums and accounting triggers. Historical vouchers have nullable machine snapshots; an earlier unbound pending voucher cannot dispense and its reservation expires normally. New vouchers require valid immutable machine fields and a 32-hex-character token.

The original water release published the mock machine map and voucher interface at [strideeco.vercel.app](https://strideeco.vercel.app/) using source `41e1f23b2100bb2b4cf7b8a76ba292e709a0709a`, deployment `dpl_BXqkriDNSDyhgHyUc1WAks7ZqntQ`. Its hosted map/filter/layout and Clerk development UI auth checks passed, including exact test fixture cleanup. That deployment had no remote application database; its checks did not establish hosted wallet persistence.

After verified human terms acceptance, the dedicated free `strideeco-demo` Turso Starter database was provisioned in `iad1` and connected only to the existing StrideEco project's production/development environments. Its database variables are configured privately. All four migrations applied with matching stored checksums, and a second run safely skipped unchanged files. The existing Clerk application and laptop environment were preserved. Do not repeat acceptance, create another database, reuse unrelated data or enable paid plans/overages. A local file remains explicitly refused on Vercel. See `remote-storage-verification.json`.

DB-enabled deployment `dpl_8Dy6uJeXc1F1zWQWRQwTSdPerYF6`, application source `d676bb0a3c56f69ce20bac8fdf7e78295202d6ec`, is live on [strideeco.vercel.app](https://strideeco.vercel.app). Its staged checks pass visible signup/test OTP, authenticated API `200`, route saving/sharing, 142 points from labelled demo walks, nearest/type matching, manual code and independently decoded QR use, one deduction per voucher, opposite-method replay rejection, sign-out/password sign-in and fresh mobile persistence. The same public artifact independently passes new-account, saved-route, demo-point and desktop/mobile persistence checks. Each exact test identity and its application records were removed, with cleanup verified and no browser errors. Full voucher accounting was checked on the staged artifact; the public run is a persistence smoke. See `account-ready-hosted-verification.json`.

Hosted authentication still uses the existing Clerk development instance. Real email delivery and the GitHub OAuth round trip are untested. All machine locations and dispensing remain mock demonstrations.

## Verification

The original water-voucher checkpoint passed 26 tests, including nearest/type selection, catalog provenance, legacy migration preservation, credential parsing, owner/machine/type binding, expiry/failure release and concurrent mixed manual/QR attempts with exactly one winner and one ledger deduction.

The production HTTP suite is `node scripts/verify-local.mjs`. The combined real-development-instance browser suite is `node scripts/verify-clerk.mjs`; `--vouchers-only` isolates the new desktop/mobile story. Browser checks independently decode screenshots and downloaded QR PNGs, exercise manual and QR consumption, wrong-machine attempts, cross-session visibility and opposite-method replays. The final `work/next-water-vouchers-final` artifact passes the production HTTP suite, signed-out responsive checks and combined real-development-instance auth + PACE + voucher browser run. Temporary Clerk fixture deletion is confirmed and browser errors are empty. The dated `water-*-report.json` files in this folder record these results. Two migration-runner tests also verify safe LF/CRLF checkout changes and rejection of substantive SQL changes without rewriting the ledger.

All dispensing is simulated, and GPS/browser viewport checks do not establish physical handset or vending-machine operation.
