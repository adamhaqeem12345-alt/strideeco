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

The current Vercel release publishes the mock machine map and voucher interface at [strideeco.vercel.app](https://strideeco.vercel.app/) using source `41e1f23b2100bb2b4cf7b8a76ba292e709a0709a`, deployment `dpl_BXqkriDNSDyhgHyUc1WAks7ZqntQ`. Hosted map/filter/layout and Clerk development UI auth checks pass, including exact test fixture cleanup. It has no remote application database. The user previously deferred setup after Turso required personal terms acceptance. A live, shared wallet and global one-use validation require the dedicated remote database; a local file is explicitly refused on Vercel. Local passing tests do not establish hosted persistence.

The required personal step, if setup is resumed, is:

```powershell
npx vercel --scope adam-haqeems-projects integration accept-terms tursocloud
```

Only the dedicated free `strideeco-demo` resource may then be provisioned. Preserve the existing Clerk application, avoid unrelated databases and paid plans, configure database credentials privately, apply all four migrations and verify the hosted authenticated journey before claiming live points or vouchers work.

## Verification

`npm test` passes 26 tests, including nearest/type selection, catalog provenance, legacy migration preservation, credential parsing, owner/machine/type binding, expiry/failure release and concurrent mixed manual/QR attempts with exactly one winner and one ledger deduction.

The production HTTP suite is `node scripts/verify-local.mjs`. The combined real-development-instance browser suite is `node scripts/verify-clerk.mjs`; `--vouchers-only` isolates the new desktop/mobile story. Browser checks independently decode screenshots and downloaded QR PNGs, exercise manual and QR consumption, wrong-machine attempts, cross-session visibility and opposite-method replays. The final `work/next-water-vouchers-final` artifact passes the production HTTP suite, signed-out responsive checks and combined real-development-instance auth + PACE + voucher browser run. Temporary Clerk fixture deletion is confirmed and browser errors are empty. The dated `water-*-report.json` files in this folder record these results. Two migration-runner tests also verify safe LF/CRLF checkout changes and rejection of substantive SQL changes without rewriting the ledger.

All dispensing is simulated, and GPS/browser viewport checks do not establish physical handset or vending-machine operation.
