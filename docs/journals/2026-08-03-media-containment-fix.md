# Media Containment Fix

**Date**: 2026-08-03 00:00

**Severity**: Medium

**Component**: Local demo media layout

**Status**: Resolved

## What Happened

Three layout bugs were fixed in the local demo view: the rotated poster panel was overlapping the title, the QR loading state was not staying within its container width, and the Next dev indicator was sitting on top of the demo surface during local runs. The result was a broken-looking preview that made the demo harder to trust than the code deserved.

## The Brutal Truth

This was a geometry problem, not a mysterious rendering bug. We let fixed-size media components drift into the surrounding layout, then paid for it with overlap and clipping. It is annoying because the failure was visible immediately in the browser and should have been caught by a basic visual pass.

## Technical Details

- Poster title stayed inside its measured safe boundary at both `390px` and `1440px` after the fixed rotated panel was replaced with an in-frame percentage composition.
- QR loading state was contained at `280/320`, so the placeholder no longer spills outside the card during load.
- Manual browser geometry checks were used as evidence; no Playwright dependency was added just to prove a layout fix.
- Validation passed: `10` tests plus lint, typecheck, and build all passed.

## What We Tried

- Switched the poster panel to responsive percentage-based sizing instead of a hard fixed width.
- Tightened the QR loading container so the skeleton respects the card width during async load.
- Disabled the Next dev indicator so local demo captures are not covered by framework chrome.

## Root Cause Analysis

The root cause was rigid layout assumptions in a responsive page. The rotated poster kept its own size logic, the QR loading state ignored containment, and the dev overlay was treated as harmless until it landed on top of the demo. We built a layout that looked fine in the happy path and fell apart under real browser geometry.

## Lessons Learned

Responsive media needs explicit containment, not optimism. If a panel rotates, loads asynchronously, or shares space with a dev overlay, its width and stacking behavior need to be treated as first-class constraints.

## Next Steps

Commit and release only when requested. Owner: repo maintainer. Timeline: no further action unless the user asks for packaging or shipping.

Status: DONE
Changed file: `docs/journals/2026-08-03-media-containment-fix.md`
