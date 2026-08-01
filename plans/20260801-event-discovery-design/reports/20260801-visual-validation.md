# Event discovery visual validation

## Scope

Validated the selected Stitch-derived public discovery composition in the
running Eventory web app. All review media is local and temporary; no Stitch
mockup or temporary screenshot was added to the repository.

## Automated gates

- `pnpm --filter @eventory/web typecheck` — passed.
- `pnpm --filter @eventory/web lint` — passed.
- `pnpm --filter @eventory/web test` — exited 0 with zero discovered tests.
- `pnpm --filter @eventory/web build` — production build passed.
- `git diff --check` — passed.

## Browser evidence

- `/`, `/events`, `/login`, and `/organizer` were checked at 375px, 768px,
  1024px, and 1440px. Each route returned `scrollWidth === clientWidth`.
- At 375px, the first Tab reached `#main-content`; the native Menu opened with
  Enter and exposed Discover, Tickets, Organizer studio, and Sign in.
- With `prefers-reduced-motion: reduce`, the UI button transition duration was
  `0.00001s`.
- A duplicate query (`/events?search=first&search=second`) rendered normally,
  used the first value, and returned no application-error marker.
- An unreachable API base rendered “Discovery needs a moment.” and a `Try
again` link to `/events`.
- A local empty-list API fixture rendered “No public events yet.” on both home
  and directory routes with truthful next actions.

## Temporary screenshots

- `C:\Users\Admin\AppData\Local\Temp\eventory-phase2-desktop.png`
- `C:\Users\Admin\AppData\Local\Temp\eventory-phase2-mobile.png`
- `C:\Users\Admin\AppData\Local\Temp\eventory-phase2-empty-mobile-final.png`
- `C:\Users\Admin\AppData\Local\Temp\eventory-phase2-unavailable-mobile.png`
- `C:\Users\Admin\AppData\Local\Temp\eventory-phase3-mobile-final.png`

These files are review evidence only. Future README media must be captured
again from a reproducibly seeded running product.

## Review outcome

- CK edge scout found misleading empty-query wording, long-footer overflow
  risk, premature phase closure, and selector scope risk. All were fixed.
- CK Stage 2 review found duplicate-query reliability and 44px text-link gaps.
  Both were fixed and re-reviewed.
- CK adversarial review found no remaining issue in the scoped UI diff.

## Docs impact

Minor. `docs/design-guidelines.md` now records anchor CTA semantics, native
mobile disclosure, the empty-versus-unavailable distinction, and the
decorative-only public-art rule.

## Unresolved questions

None for this frontend scope.
