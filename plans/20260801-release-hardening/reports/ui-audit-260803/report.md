# Responsive UI audit — 2026-08-03

## Scope

Authenticated production-image audit against an isolated seeded Compose stack. Checked discovery, event directory, organizer studio, seat selection, checkout, and ticket wallet at 320, 390, 768, and 1440 px.

## Fixed defects

| Surface        | Reproduction                             | Root cause                                                                | Resolution                                            |
| -------------- | ---------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------- |
| Organizer      | 325 px document width at 320 px viewport | `1fr` retained a min-content floor from the inline workspace form         | Use `minmax(0, 1fr)` and stack narrow inline forms    |
| Seat selection | 379 px document width at 320 px viewport | 440 px seat row enlarged its grid item and hold actions extended the card | Constrain the scroll container and stack hold actions |
| Checkout       | 335 px document width at 320 px viewport | Booking code and payment total competed in one flex row                   | Stack the summary on narrow screens                   |

## Evidence

| Surface        | Before                                                  | After                                                        |
| -------------- | ------------------------------------------------------- | ------------------------------------------------------------ |
| Organizer      | [320 px before](./screenshots/organizer-320-before.png) | [320 px after](./screenshots/organizer-320-after.png)        |
| Seat selection | [320 px before](./screenshots/seats-320-before.png)     | [320 px after](./screenshots/seats-320-after.png)            |
| Checkout       | [320 px before](./screenshots/checkout-320-before.png)  | [320 px after](./screenshots/checkout-320-after-booking.png) |

## Verification

- Regression test first failed against the old responsive rules, then passed after the fix.
- Web tests: 3 passed, 0 failed.
- Web TypeScript check and ESLint: passed.
- Production web Docker build: passed.
- Browser console and page errors: none after the fix.
- Keyboard entry point: first Tab focuses `Skip to content`.
- All six audited routes matched document width to viewport width at 320, 390, 768, and 1440 px.

## Notes

- Seat rows intentionally remain horizontally scrollable on very narrow screens so seat ordering and usable target sizes are preserved.
- Audit account, bookings, and screenshots came from the isolated `eventory-ui-audit` stack; no default project volume was reset.

## Unresolved questions

None.
