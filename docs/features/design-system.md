# Design system — "Order Window"

Chomp had zero visual identity through 2026-08-17: `globals.css` was the
unmodified shadcn/ui scaffold (pure grayscale oklch tokens), Geist was the
only font, and there was no brand palette, logo, or favicon anywhere in the
repo. This is phase 1 of giving it one.

Grounded in the physical objects of a food truck transaction — the paper
order ticket, hand-painted/stenciled signage, the parchment-paper menu —
rather than a generic app palette. Light-mode-primary is a deliberate
choice, not a default: food photography (menu items, review photos) reads
best against a light neutral, and this is a mobile, outdoor, daytime app.

## Tokens (`apps/web/app/globals.css`)

Named brand colors, fixed regardless of light/dark mode (they're the brand
itself, not a surface/text role):

| Token | Hex | Role |
|---|---|---|
| `--color-griddle` | `#1e1b16` | ink — text, headlines |
| `--color-butcher` | `#f5f0e6` | parchment — page background (light mode) |
| `--color-paper` | `#faf6ec` | card/surface background (light mode) |
| `--color-marigold` | `#e8a23a` | primary accent — CTAs, ratings, active nav |
| `--color-salsa` | `#d6472b` | sparing — live/active signals, action links |
| `--color-basil` | `#52725a` | verified/success signals |
| `--color-char` | `#8a8074` | borders, secondary text, decorative dots |

These generate ordinary Tailwind utilities (`bg-marigold`, `text-salsa`,
`border-char`, etc). The semantic shadcn tokens (`--background`,
`--foreground`, `--primary`, ...) are mapped onto this palette and still
flip between the light `:root` block and the `@media (prefers-color-scheme:
dark)` block, same mechanism as before — only the values changed.

**Type**: Geist stays the body/UI workhorse. **Anton** (`--font-display`,
`font-display` utility) is new — an ultra-bold condensed grotesk used only
for the wordmark and page headlines, never body text or buttons. **Geist
Mono** (`--font-mono`) is wired but not yet used anywhere; reserved for
prices/timestamps in a later pass.

## Signature element — the ticket-stub card

`.ticket-card` / `.ticket-card__perforation` (in `globals.css`) plus the
React wrapper `components/ui/ticket-card.tsx`. A dotted "perforation" line
stands in for a literal torn edge: a true CSS mask cutout would need to
know the color behind the card to look right, which can't be guaranteed
here — most visibly, the map popup sits over live Mapbox tiles, not a
fixed color. Dots read as "order ticket" without that dependency.

Colors are hardcoded to Griddle-on-Paper rather than the theme's
`--card`/`--foreground` tokens on purpose, since this card has to stay
legible against an unpredictable background, not just flip with
light/dark mode like an ordinary surface. This is also the direct fix for
the reported map-popup bug: Mapbox's vendored CSS hardcodes
`.mapboxgl-popup-content`'s background to white with no text color set, so
popup text fell back to inheriting `--foreground`, which flips to
near-white in dark mode — white text on a white card.
`.mapboxgl-popup-content`/`.mapboxgl-popup-tip` are now stripped down to
just positioning (see the bottom of `globals.css`) and handed off entirely
to `.ticket-card`.

Applied to: the map popup (`truck-map.tsx` — built via raw DOM, so it uses
the two CSS classes directly rather than the React component), feed cards
(`app/feed/page.tsx`), and truck-list rows (`components/truck-list.tsx`).
**Deliberately not** applied to dashboard tables, forms, or admin screens —
those keep the same color tokens but stay plain/functional, so the motif
doesn't turn into a gimmick applied everywhere.

## `StarRating` (`components/ui/star-rating.tsx`)

Bug fix, not just styling: every rating display in the app (feed, truck
detail's summary + list, account "my reviews", admin review queue)
previously printed a plain `"{rating} ★"` string — one static glyph next to
a number, never a loop over 5 stars, so a 4-star review looked identical to
a 1-star one. `StarRating` renders all 5, filled up to the rating, via a
pure `getFilledStarCount` (unit-tested in `star-rating.test.tsx`) that
rounds to the nearest whole star — every review rating in this app is
already an integer 1-5 (`isValidRating`), so only a truck-level average can
be fractional, and a half-star render wasn't asked for.

Swapped into all 5 call sites. Only the 3 phase-1 surfaces above (feed,
truck detail, truck-list) also got the `TicketCard` visual treatment;
account and admin got the bug fix only, consistent with the phased scope
below.

## Testing

`@testing-library/react` + `jsdom` + `@testing-library/jest-dom` were added
this pass — the repo previously only had `vitest` in `node` environment for
server-side logic. Component tests opt into `jsdom` per-file via a
`// @vitest-environment jsdom` docblock rather than flipping the global
config, so the existing node-environment tests are untouched. jest-dom
matchers are loaded globally via `vitest.setup.ts`.

## Scope — what's phase 2

This pass covered: tokens, fonts, `StarRating`, `TicketCard`, the map
popup, feed, truck-list, truck detail page, nav wordmark, and the
discovery page's Map/List toggle + filter controls. **Not yet touched**:
dashboard, admin screens (beyond the `StarRating` bug fix), account page
layout, forms, empty/error states, the menu-item filter-tag pills (still
plain gray), favicon/OG image (still none — no `apps/web/public/`
directory exists at all).
