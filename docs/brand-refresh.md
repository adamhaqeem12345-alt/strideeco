# StrideEco brand refresh

The supplied logo and palette replace the earlier sage/cream identity. This is the owner's explicitly requested branding change.

| Role | Color |
| --- | --- |
| Aqua canvas | `#CFFFFD` |
| Brand teal | `#34AFAB` |
| Green accent | `#81FF7D` |
| Yellow accent | `#FFE165` |
| Coral accent | `#FE7F82` |
| Sky accent | `#42C3FE` |
| Text and navigation | `#0C343C` |
| Primary action | `#087C80` |
| Primary hover / focus | `#055A61` |
| Secondary text | `#456A70` |

The six bright colors were sampled from the owner's reference image. Darker text/action colors provide readable contrast; white is reserved for dark teal controls and navigation.

## Supplied artwork

`public/strideeco-logo.svg` preserves the supplied vector letters and textured artwork, with the unused canvas cropped. It is transparent, 1049×211, approximately 134 KB. The original source file is unchanged. A shared Brand component places it in desktop navigation, the mobile header and account pages without distorting its aspect ratio.

The favicon uses the original smiling water-drop detail so the artwork remains recognizable at tab size. The SVG is 256×256, PNG is 32×32, and Apple touch icon is 180×180. The SVG assets contain no scripts, event handlers or external references. Favicon metadata uses a version query to refresh older cached icons.

## Interface

The refresh covers the main canvas, navigation, headings, controls, route cards, map styling and machine markers, activity, rewards/wallet, vouchers, dialogs, status messages and Clerk account screens. Machine colors retain letter labels, and the QR keeps a white quiet zone with dark teal modules.

The route planner, authentication configuration, account ownership, point accounting, machine catalog and voucher lifecycle are unchanged. Existing persistence and physical-vending limitations remain documented in [water-vouchers.md](water-vouchers.md).

## Verification

Run the opt-in visual journey with a finished production build:

```powershell
$env:STRIDEECO_BUILD_DIR = 'work/next-brand-aqua-release'
node scripts/verify-clerk.mjs --branding-only
```

It uses one temporary Clerk development fixture and an isolated local database, tests public desktop/mobile planner/rewards/account screens, actual logo/icon requests and dimensions, key text contrast, keyboard focus, responsive fit and a rendered voucher QR decoded independently. The runner verifies exact fixture deletion. It does not repeat signup/password/OAuth or assert remote database persistence.

The 26 domain, ownership, migration, machine and voucher tests remain available through `npm test`. Dated verification reports record actual results; test existence alone does not establish a pass.

Final local result: `work/next-brand-aqua-release` passes the production build and TypeScript checks, the 26 domain/ownership tests, and the opt-in branding journey. Screens at 320, 390, 768, 1024 and 1440 pixels fit without horizontal overflow. The key text samples are at least 4.99:1; desktop/mobile voucher QR pixels decode independently. Versioned icon requests load and decode at their declared sizes, keyboard focus is visible, browser errors are empty and exact fixture cleanup is confirmed. See `brand-browser-verification.json` and `brand-asset-verification.json`.
