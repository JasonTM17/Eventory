# UI/UX audit — Eventory public discovery

## Verdict

Proceed with Stitch direction A. Its asymmetrical ticket-and-seat-map hero gives
the public catalog an ownable, editorial first impression without pretending the
product has event media, categories, attendance, or inventory metrics. Keep B
only as a reference for compact metadata rhythm, never as a photo-card spec.

The project brand wins over generic generator advice: retain paper/ink/lime,
Space Grotesk, and DM Mono. Use lime as a filled signal with ink text; lime text
on paper measures only 1.17:1 contrast, while ink on lime measures 12.66:1.

## Exact visual direction

- **Desktop:** left-aligned display headline and two valid link CTAs; a static,
  decorative ticket/seat-map composition occupies the right column. It should
  read as Eventory's brand artifact, not live availability.
- **Discovery:** retain the real search control, then show a restrained grid of
  data-led cards: status, formatted date, name, venue, and starting price.
  Use dividers and typography before decoration; no image placeholder.
- **375px:** text, CTAs, and artwork stack in reading order; the artwork follows
  the primary CTA and never hides navigation or creates horizontal scroll. Cards
  remain one column, metadata can stack, and all tap targets stay at least 44px.
- **Motion:** static hero art plus existing short hover/press feedback only.
  Preserve the current reduced-motion override.

## Prioritized implementation notes

### P0 — semantics needed before visual polish

- `apps/web/app/page.tsx:29-36` — `next/link` wraps the shared native
  `<button>`, creating nested interactive controls. Render the CTAs as links
  styled with the existing `ui-button` classes; do not add an `onClick` route.
- `apps/web/app/globals.css:59-69` — once CTAs become links, make `.ui-button`
  an inline flex control with `align-items`, `justify-content`, and its existing
  46px minimum height so anchors and buttons share the same hit area.

### P1 — selected design, mobile resilience, and truthful states

- `apps/web/app/page.tsx:20-50` and
  `apps/web/src/components/public-discovery-hero-art.tsx` (new only if used) —
  implement A's ticket/seat-map as CSS/SVG with `aria-hidden="true"` and
  `focusable="false"`. It must contain no dates, seat counts, names, or values
  that could be mistaken for live event data.
- `apps/web/src/components/event-card.tsx:15-17` — remove the invented fallback
  “A carefully produced Eventory experience.” If the API description is null,
  omit that paragraph or state only that no description was provided.
- `apps/web/app/page.tsx:7-12,61-70` and
  `apps/web/app/events/page.tsx:16-21,54-63` — distinguish an unavailable API
  from an empty result. The former needs a truthful retry route; a filtered empty
  result needs a “Clear search” link. Do not present an outage as “no events.”
- `apps/web/src/components/site-header.tsx:8-18` and
  `apps/web/app/globals.css:158-192` — brand and desktop navigation links do not
  yet have a 44px hit area. Give them flex alignment and a 44px minimum height;
  the sign-in chip needs the same guarantee.
- `apps/web/app/globals.css:197-250` — native `<details>/<summary>` is the right
  no-JavaScript mobile menu. Add the same explicit violet `:focus-visible` ring
  used by links/inputs to `summary`; keep its visible “Menu” label.
- `apps/web/app/events/page.tsx:39-52` and
  `apps/web/app/globals.css:612-619,1081-1143` — at 375px, let search collapse
  to a vertical/full-width action if needed and set `min-width: 0` on the input.
  This protects the real search term and button from overflow.
- `apps/web/src/components/event-card.tsx:10-28` and
  `apps/web/app/globals.css:340-369` — protect long event and venue values with
  `overflow-wrap: anywhere`/`min-width: 0`; stack the footer metadata on narrow
  screens rather than clip user-provided content.

### P2 — final professional pass

- `apps/web/app/events/page.tsx:43-48` — use `type="search"`,
  `autoComplete="off"`, and a concrete placeholder ending in `…`. The existing
  screen-reader label and URL-backed search state are correct.
- `apps/web/app/globals.css:270-282,321-325,378-389` — add balanced wrapping to
  public display headings so the 375px composition does not leave an orphaned
  final word.
- `apps/web/app/globals.css:1` and `apps/web/app/layout.tsx:1-13` — keep the
  documented families; optionally move them to `next/font` in a separately
  verified performance pass. Do not swap the brand typography merely because a
  generic design recommendation preferred another pairing.

## Already on the right track

- `apps/web/app/layout.tsx:10-25` has an explicit light color scheme, matching
  theme color, skip link, and focusable main target.
- `apps/web/src/components/site-header.tsx:20-30` uses a semantic native mobile
  disclosure instead of a click-only `div`.
- `apps/web/app/globals.css:65-80,1071-1079` uses explicit transition properties,
  visible focus styling for existing links/inputs, and a reduced-motion path.
- `packages/contracts/src/index.ts:18-35` provides all card data required for
  the refresh; the API already orders ticket types by `priceMinor` ascending in
  `apps/api/src/modules/events/events.service.ts:281-284`.

## Docs impact

**Minor.** After implementation, add only the resulting public-discovery rules
to `docs/design-guidelines.md`: anchor CTA semantics, decorative-only hero art,
mobile disclosure/touch targets, and unavailable-versus-empty treatment. Do not
document Stitch mockups or invent a second design system.

## Unresolved questions

- None for this design scope. Phase 3 must still validate the running product at
  375px, keyboard-only navigation, and reduced motion before merge.
