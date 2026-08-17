# Navigation

A responsive, site-wide nav (desktop inline row / mobile drawer), smart
back-navigation on the truck detail page, and breadcrumbs in the operator
dashboard. Closes `future-plans/roadmap.md` section 6, flagged during a
2026-08-04 walkthrough as the last unscoped item on the roadmap. Chomp is
used primarily on a phone while out and about, so this was designed
mobile-first per that walkthrough's standing direction — desktop is the
secondary breakpoint, not the primary target.

Replaces the ad hoc header that lived directly in `app/layout.tsx` (a
right-aligned sign-in button / Account + Dashboard links / avatar row, added
incrementally across earlier sessions — see `/docs/features/account.md`'s
now-superseded "Navigation" section). That header had no mobile treatment,
no logo/home link, no way back from a truck page to the map or feed, no
breadcrumbs in the operator dashboard, and a role bug: "Dashboard" showed to
every signed-in user, not just operators.

## Nav-link resolution

`packages/utils/src/nav-links.ts#getNavLinksForUser(user, isOperator)` — a
pure, framework-agnostic resolver (lives in `@chomp/utils`, not
`apps/web/lib/`, per the roadmap's direction to keep nav-adjacent business
logic shared for the eventual React Native client). Base links (Map, Feed)
are always present; Dashboard is appended only when `isOperator` is true,
Admin only when `user.role === 'admin'`, Account only when signed in at all.

`isOperator` isn't a property on the user row — the caller resolves it via
`getOperatedTrucks(user.id).length > 0` (`lib/operators.ts`, already the
canonical "does this user operate any truck" check used by the dashboard).
This is also the fix for the pre-existing bug: `apps/web/app/layout.tsx` is
now `async`, calls `getCurrentUser()` and (if signed in) `getOperatedTrucks`
server-side, and passes the resolved link list into the client nav as a
prop — no client-side role fetch, no waterfall.

## Responsive strategy

One `navLinks` array, two Tailwind-breakpoint-gated renders inside
`components/nav/primary-nav.tsx` (`'use client'`, owns the drawer's open
state and `usePathname()` for active-link styling):

- Desktop (`md:` and up): `hidden md:flex` inline horizontal list.
- Mobile: a hamburger button (`md:hidden`) opening a shadcn `Sheet` drawer
  containing the same links vertically, closing on link tap.

Both trees always exist in the DOM; Tailwind classes (not JS media-query
detection) decide which is visible, so there's no hydration flicker or
layout-shift on first paint.

### shadcn/ui

Installed for this feature — `docs/architecture/stack.md` already committed
to "Tailwind CSS + shadcn/ui" but nothing had actually run the CLI yet. Used
narrowly: `Sheet` (mobile drawer container) and `Button` (hamburger
trigger) only — the nav is a flat link list, so `NavigationMenu` (built for
multi-level hover/dropdown nav) would be a mismatched, heavier primitive.

Touched shared infra beyond the nav itself: `apps/web/components.json` (CLI
config), `apps/web/components/ui/{button,sheet}.tsx`, and an expanded
`apps/web/app/globals.css` (shadcn's full CSS variable set + a Tailwind v4
`@theme inline` block).

**Dark mode, hand-adjusted**: shadcn's CLI defaults `dark:` to a `.dark`
class toggle (meant to pair with a JS theme provider like `next-themes`).
Nothing in this app ever adds that class, so installing it as-is would have
silently broken dark mode (the app would render light-only). Fixed by
removing the generated `@custom-variant dark (&:is(.dark *));` override and
converting the `.dark { ... }` variable block to
`@media (prefers-color-scheme: dark) { :root { ... } }` — Tailwind v4's
built-in default is already `prefers-color-scheme`-based, matching the
app's pre-existing automatic (OS-driven) dark mode exactly, just with
shadcn's fuller variable set. No theme provider or manual toggle was added.

## Smart back-nav (truck detail page)

`components/nav/smart-back-link.tsx` on `/trucks/[slug]`: `router.back()`
when the visitor arrived via in-app navigation, else a fixed link to
`/feed`.

**Why not `document.referrer`**: the two real arrival paths behave
differently. `/feed`'s truck links use `next/link` (client-side/soft
navigation, which never updates `document.referrer`). The map's popup links
(`components/truck-map.tsx#buildPopupContent`) are raw DOM `<a href>`
elements (hard navigation, since Mapbox popups aren't React-rendered) —
those *do* update the referrer. A referrer check would silently work for
Map but fail for Feed, the more common path. **Do not "simplify" this back
to a referrer check** — it would reintroduce that asymmetry.

**Mechanism instead**: a `sessionStorage`-backed stack of visited in-app
pathnames.

- `packages/utils/src/nav-history.ts` — pure transforms:
  `appendToNavHistory` (dedupes a consecutive repeat, caps at
  `MAX_NAV_HISTORY = 20`) and `hasInAppHistory` (`stack.length > 1`).
- `apps/web/lib/nav-history-storage.ts` — the only code that actually
  touches `sessionStorage` (`readNavHistory`/`writeNavHistory`, SSR-guarded).
  Deliberately thin and untested by Vitest — `apps/web/vitest.config.ts`
  runs with `environment: 'node'` (no `window`), so this wrapper is covered
  by Playwright instead.
- `components/nav/nav-history-tracker.tsx` — renders `null`, mounted once
  in `app/layout.tsx` (before `{children}`) so every page visited grows the
  stack regardless of which page the user lands on first.
- `components/nav/smart-back-link.tsx` — renders the fallback link on first
  render (matches SSR exactly, no hydration mismatch), then swaps to a
  `router.back()` button post-mount if `hasInAppHistory` is true.

Tab-scoped by design: a brand-new tab (direct link, a link shared outside
the app) starts with empty `sessionStorage`, which is exactly the signal
`SmartBackLink` needs to correctly fall back to `/feed` instead of calling
`router.back()` into nothing. A refresh mid-session doesn't lose the stack
(`sessionStorage` survives reloads in the same tab).

## Dashboard breadcrumbs

`packages/utils/src/dashboard-tabs.ts` is now the single source for both
the tab row and the breadcrumb trail in `app/dashboard/[truckId]/layout.tsx`
— previously the five tabs were hardcoded `<Link>`s with no shared source
at all. `components/dashboard/dashboard-breadcrumbs.tsx` renders
`Dashboard > {truckName}` on the Profile tab (no redundant third segment,
since Profile is the truck's landing page) or
`Dashboard > {truckName} > {tabLabel}` elsewhere, via the generic, reusable
`components/nav/breadcrumbs.tsx`.

## Scope cuts (not built this pass)

- **No global nav search box** — explicitly excluded, still true after
  roadmap item 7e added search (see `/docs/features/search.md`): that
  search lives inside the discovery page's own controls
  (`TruckListControls`), not the site-wide nav, and there's still no
  `/search` route.
- **No real-browser role-matrix e2e** (operator sees Dashboard, admin sees
  Admin, in an actual signed-in session) — this repo has no Clerk
  signed-in-test-user fixtures yet (`@clerk/testing`'s sign-in helper isn't
  wired up anywhere). Fully covered at the unit level instead
  (`nav-links.test.ts`'s 4-role matrix); Playwright stays signed-out-only
  for nav. Flagged as a follow-up, same prerequisite gap noted in
  `/docs/features/account.md`'s Testing section for other Clerk-dependent
  flows.
- **No manual dark-mode toggle** — kept automatic/OS-driven, see above.

## Testing

- Vitest (`packages/utils/src/*.test.ts`): `getNavLinksForUser` across all
  4 role states (signed-out, customer, operator, admin, and
  operator+admin); `nav-history.ts`'s append/dedupe/cap and
  `hasInAppHistory` threshold; `getActiveDashboardTab`'s path matching for
  every tab plus unrelated paths.
- Playwright (`apps/web/e2e/nav.spec.ts`, `truck-back-nav.spec.ts`,
  signed-out only): Home/Feed links navigate; mobile viewport shows the
  hamburger and hides the inline row (and vice versa on desktop); the
  drawer opens, navigates, and closes; active-link `aria-current`; smart
  back-nav in all three arrival modes (via Feed, via Map, direct
  navigation with no in-app history).
- `apps/web/e2e/truck-detail.spec.ts`'s existing heading assertions don't
  collide with the new back-link markup (verified — it's a button/link, not
  a heading).
