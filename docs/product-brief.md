# StrideEco

Plan a walk or run, record eligible activity, collect points, and redeem drinking water.

## Product contract

| Capability | Phone | Desktop |
| --- | --- | --- |
| Plan, compare, save and share routes | Yes | Yes |
| Departure date/time and shade information | Yes | Yes |
| View wallet, activity history and rewards | Yes | Yes |
| Initiate and view water redemption | Yes | Yes |
| Foreground location recording while moving | Yes | Supported where the device supplies location; phone is the intended recording device |

## Evidence and prototype states

Geographic features must come from attributed public sources. Incomplete shade inputs produce an explicit unavailable or partial estimate, not an invented percentage. Public paths are map suggestions, not surveyed access or safety guarantees. Machine compatibility and funding are unconfirmed. Simulated vending responses demonstrate product logic and are not evidence of an operator partnership.

## Records

- SavedRoute: owner, route geometry, planning settings, source metadata.
- Activity: owner, timestamped positions, measured distance, validation state.
- PointTransaction: owner, activity/redemption reference, immutable change, idempotency key.
- Redemption: owner, reward, points reservation, token, expiry, simulated/operator confirmation state.

Activity credit and redemption confirmation are idempotent. Concurrent redemption cannot overspend a wallet. Failed/expired reservations restore availability. Aggregated planning insights require separate consent.
