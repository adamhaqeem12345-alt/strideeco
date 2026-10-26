# Prototype walkthrough improvements

The homepage opens directly on route planning and the map, without a permanent PACE guide panel. A first-time signed-out visitor can choose an optional quick tour or skip it. The tour dims the page and highlights the map, planning controls, activity controls, collected progress and mock rewards. The browser remembers skip/completion choices; **Show me around** in the footer and profile reopens it. Signed-in users are never offered the tour automatically.

A brief StrideEco splash uses the existing wordmark, a white disc and the sky-blue brand colour while the app and authentication status initialize. Reduced-motion preferences are respected. A bounded timeout releases the splash if initialization is slow; automatic onboarding still waits for authentication status to be known, so a signed-in user is not mistaken for a new guest.

Finishing an accepted GPS or labelled demo activity opens Collect automatically. Collect explains saved points and links to the existing mock water-reward flow.

The planner keeps date, time and route selection visible while placing the detailed sun chart and assumed-height scenario inside **Shade & sun settings**. Closing that section preserves the current settings; a **Scenario on** label makes an enabled scenario visible while collapsed.

Collect and the reward wallet share an account-aware progress display. It converts missing points to eligible walking distance using the configured prototype rules and excludes reserved points through the available balance. Signed-out, loading and unavailable states do not invent a progress value. Existing ownership, accounting and single-use voucher checks remain in place.

Mock water stops use ambient, chilled and refill icons with a persistent labelled map key. Accessible names, keyboard selection, selected state and public map attribution remain available.

**View sample township insights**, available from the footer and profile, opens an illustrative screen. Its popularity counts and exposure values are invented examples; its path geometry comes from the existing attributed public map. It uses no resident activities, GPS tracks or consent data. It is not a delivered analytics service or evidence of real township usage or measured shade.

## Verification

- Production build and TypeScript checks.
- Anonymous production-rendered browser checks at phone, tablet and desktop widths, including first-visit opt-in/skip, returning and signed-in entry, optional tour navigation, collapsed settings, machine filtering and sample labels.
- Isolated actual-component journey with a temporary local database and SDK-verified synthetic session: saved route, demo points, automatic Collect, simulated QR redemption and a fresh mobile session.
- Progress checks around the reward threshold, reserved balance and unknown account states.

The isolated component journey uses test adapters for Next navigation/dynamic loading and unused account controls. It does not retest the Clerk browser sign-in flow. No live account or wallet data is changed by these checks.

Run the focused isolated journey after a production build:

```sh
npm run build
npm run verify:prototype
```

Browser verification requires Playwright and its Chromium browser. Existing runner overrides `STRIDEECO_PLAYWRIGHT` and `STRIDEECO_BROWSER_EXECUTABLE` can point to an installed runtime. The harness creates its own temporary database and synthetic signing keys; it does not use a real account.
