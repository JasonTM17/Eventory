# Eventory design guidelines

Eventory uses an editorial, high-contrast visual language: warm paper surfaces, ink-black structure, and a lime signal for actions that move a user forward. The interface should feel calm enough for checkout and expressive enough for discovery.

## Tokens

| Token | Value | Use |
| --- | --- | --- |
| Ink | `#162120` | body copy, borders, primary contrast |
| Paper | `#F5F3ED` | page background |
| Surface | `#FFFDF8` | cards and forms |
| Signal | `#B9F36E` | primary actions and positive state |
| Violet | `#6656D8` | keyboard focus ring |
| Muted | `#68736E` | secondary copy and metadata |

## Interaction rules

- Every interactive control has a visible `:focus-visible` treatment and a minimum 44px touch target.
- Forms use native labels, browser input types, and server/API errors in an alert region; validation in the browser is convenience only.
- Loading, empty, forbidden, and unavailable states keep the surrounding layout stable and explain a recovery action.
- The API remains the authorization boundary. Hiding a link or route in the web app never grants access.
- Responsive layouts collapse to one column at 800px, preserve reading order, and never require horizontal scrolling.

## Typography and content

- Space Grotesk carries headlines and UI labels; DM Mono marks status, timestamps, and system metadata.
- Headlines are short, direct, and sentence case. Status labels are uppercase in the UI but preserve the API enum in data.
- Currency and dates are formatted from server values; the browser never derives ticket totals.

## Component boundaries

The shared `@eventory/ui` package contains presentation primitives (`Button`, `Card`, `Field`, `StatusBadge`, and `Container`). Route components own domain composition. Client components are limited to forms and interactive workspace controls; public discovery stays server-rendered.
