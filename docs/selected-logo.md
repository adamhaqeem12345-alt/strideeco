# Selected StrideEco wordmark and SE icon

The owner selected the Playful Wordmark concept on 23 October 2026: a teal/sky-blue path inside the S, teal Stride lettering, a green E, yellow c and coral o with a green leaf. The small SE monogram is the browser icon.

The built-in image generation tool produced transparent wordmark and monogram exports from the selected artwork. Technical exports trim transparent canvas and resize proportionally; the logo remains a raster asset, not a claimed vector trace. `selected-logo-assets.json` records output dimensions, alpha and SHA-256 hashes.

- `public/strideeco-wordmark.png` is used by the shared Brand component in desktop navigation, the phone header and both authentication pages. Its intrinsic dimensions preserve proportions without changing collaborator layout CSS.
- `public/strideeco-monogram.png` is the transparent 512 px SE mark. `favicon.png` is 32 px, and `favicon.ico` includes 16/32/48 px PNG entries for browser fallback.
- `apple-touch-icon.png` is 180 px on an opaque aqua background. All active icon links and the wordmark use the new `se-wordmark-20261023` version token to refresh older cached branding.
- The earlier SVG artwork stays in repository history and as an unused asset; the active metadata no longer selects the previous SVG water-drop favicon.

This change is limited to brand assets, metadata, intrinsic image dimensions and the existing branding check's asset expectations. The palette, collaborator UI, authentication, account storage, machine catalog and points/voucher behavior retain their existing implementation. Release verification checks the actual asset hashes and decoded sizes, proportional logos, header/Clerk-page fit and footer reachability without creating any account or data records.

The production webpack build and strict TypeScript pass. The read-only local browser run passes at 320×568, 390×844, 768×700 and 1366×768, including all five asset hashes/decodes, favicon metadata, all four views, mobile/desktop footers and both Clerk forms. Browser errors and account writes are zero; see `selected-logo-browser-verification.json`.

## Image export prompts

Both prompts used the built-in image generation tool with the approved concept as the reference and `transparent_background: true`. Subsequent PNG/ICO sizing is a technical export, not a new logo design.

**Wordmark:** Use case: background-extraction / production logo asset. Extract ONLY the large upper horizontal "StrideEco" wordmark from this approved artwork onto a genuinely transparent background. Remove the small SE monogram underneath and all surrounding white canvas. Preserve the exact approved lettering, exact spelling StrideEco, proportions, teal/sky-blue Stride, green E, yellow c, coral o and green leaf. Preserve the blue walking-path detail inside the capital S, the blue dot over i, and the delicate intentional white separator/leaf details. Do not invent or redesign any letter or recolor anything. Output a clean high-resolution horizontal logo asset with tightly fitting bounds and a small even transparent margin around the entire wordmark; no extra symbol, no duplicated logo, no checkerboard baked in, no shadows, no presentation board. The wordmark should fill the available width and remain completely visible. True alpha transparency.

**SE mark:** Use case: background-extraction / production app icon asset. Extract ONLY the small standalone "SE" monogram at the bottom of this approved logo artwork. Remove the large wordmark and all white surrounding canvas. Preserve the precise approved S shape in deep teal with its curved sky-blue path and delicate white separator, and the bright green E to its right. The monogram must read SE in that order. Keep the same geometry and colors; do not redraw into a different design or add any border, letters, badge, slogan, decoration or shadow. Export as a large clean centered symbol on a SQUARE genuinely transparent canvas, with a modest even safety margin around the mark, suitable for downscaling into browser favicons. Preserve intentional white details, remove exterior background only. No baked-in checkerboard.
