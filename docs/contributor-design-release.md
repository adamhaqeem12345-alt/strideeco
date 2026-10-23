# Contributor design release — 23 October 2026

The design update is xinbinglim's original commit [`6bf30af`](https://github.com/adamhaqeem12345-alt/strideeco/commit/6bf30afc06a2b2a45e16ec59aef07750b8dd104a), already on GitHub `main`. This owner-reviewed release preserves that commit, its author and all three application files unchanged.

The update increases interface typography, improves phone tap targets and narrow-screen layouts, adds selectable hourly sun-height bars, animates earned points and wallet feedback, keeps errors visible longer, and highlights voucher expiry in its last minute. Sun height remains a model angle, not measured heat or shade.

Pre-release validation on the exact contributor code:

- Strict TypeScript and all 28 domain/identity/migration/machine/voucher tests pass.
- The production webpack build passes using the existing development Clerk instance and an ignored local build directory.
- Read-only browser checks pass at 320×568, 390×844, 768×700 and 1366×768. All four views fit, mobile/sidebar footers remain reachable, all 14 sun-hour controls render and selecting 09:00 updates departure time, machine-type filtering works, and sign-in/sign-up forms fit.
- Anonymous account API requests remain `401`; browser errors and account writes are both zero. No account or remote database record is created by these display checks.
- Account ownership, consent, save/share, readiness and voucher accounting/security code are unchanged. Existing authenticated persistence and voucher evidence remains in `account-ready-hosted-verification.json`; those account mutations are not repeated for this design release.

Vercel blocked the initial Git-triggered deployment before building because the contributor does not have deployment access to this private project. Its normal owner-authenticated redeploy response required a fresh commit. This release records the owner's review through the usual pull-request merge into `main`; it does not rewrite contributor authorship, change deployment permissions or enable a paid plan.

GitHub `main` remains the shared source of truth. Final hosted source, production readiness and layout checks are verified separately during publication.
