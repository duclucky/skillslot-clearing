# Overview Landing & Navigation Design

## Goal

Make the Overview destination a true landing page for SkillSlot Clearing. It
should introduce the product, explain the validator-cleared mechanism, and
show a first-time user how to try it without presenting the workspace
navigation as a dashboard control.

## Scope

- Hide `.primary-nav` only while `destination === "overview"`.
- Keep the existing topbar brand and wallet control available on Overview.
- Keep the workspace nav unchanged on Rounds, Create round, and My activity.
- Keep the existing hero, “Why GenLayer”, and “How SkillSlot clears access”
  sections; do not add unsourced activity or proof metrics.
- Add a “How to use SkillSlot” section with three user-facing steps:
  browse an open round, offer/request access, and review the finalized result.
- End the landing content with the existing Browse rounds/Create a round CTAs
  so the landing page has a clear conversion path.

## Visual and accessibility decisions

- Preserve the current dark immersive video background, Swiss-style spacing,
  semantic color tokens, and existing typography hierarchy.
- Use a single responsive explainer grid that stacks on narrow viewports.
- Keep body text at readable sizes, maintain visible focus states, and use the
  existing SVG icon family; no emoji or new decorative metrics.
- Navigation remains keyboard reachable on operational destinations. The
  landing page relies on labeled buttons for its two primary actions.
- Respect the existing reduced-motion rules and avoid adding layout-shifting
  animation.

## Interaction and verification

- Overview renders without the workspace-destination nav.
- Clicking Browse rounds and Create a round still changes destination exactly as
  before.
- Rounds/Create round/My activity still render the nav with the active state.
- The new usage section is visible while canonical reads are loading and does
  not depend on wallet state.
- Add React tests for the hidden Overview nav, preserved operational nav, and
  the three usage steps. Run `npm run check` and verify the production page in
  Chrome at desktop and narrow viewport widths.
