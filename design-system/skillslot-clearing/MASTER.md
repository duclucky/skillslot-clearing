# SkillSlot Clearing — Design System

> Generated from the offline engine, then deliberately overridden where the generic marketplace preset conflicted with the project taste brief. Page-specific files under `pages/` may override this file.

**Product:** validator-cleared access-slot exchange for technical operators

**Design read:** premium utilitarian, calm and evidentiary rather than promotional

**Dials:** variance 6/10 · motion 3/10 · density 7/10

**Theme lock:** warm light only for v1

## Product shape

This is not a browse-first consumer marketplace. It is a two-role operational workspace with a canonical round state, one primary action at a time, and explicit transaction/finality feedback. The most important visual is the actual clearing state, not a decorative hero, search box, compatibility matrix, validator transcript, or fake market inventory.

## Tokens

### Color

| Role | Value | Use |
|---|---:|---|
| `--canvas` | `#F4F0E6` | warm page ground |
| `--surface` | `#FCFAF4` | primary panels |
| `--surface-strong` | `#EAE5D8` | selected/raised regions without shadow |
| `--ink` | `#18201B` | primary text and dark actions |
| `--ink-muted` | `#59625C` | secondary text |
| `--line` | `#CBC6B8` | structural borders |
| `--line-strong` | `#8B928B` | emphasized boundaries |
| `--signal` | `#176B4D` | the single product accent; progress/positive action |
| `--signal-soft` | `#DCEBE3` | accent tint |
| `--warning` | `#8A5700` | retryable/pending warning |
| `--warning-soft` | `#F3E5C3` | warning tint |
| `--danger` | `#A33A32` | destructive/failure |
| `--danger-soft` | `#F3DEDA` | danger tint |
| `--focus` | `#0C5E8A` | keyboard focus ring |

No purple, blue-purple gradient, pure white, or pure black. Status must always include text or an icon; color is never the only signal.

### Typography

- Display/identity: `Newsreader`, Georgia, serif. Use only for the product name and major workspace title.
- UI/body: `Public Sans`, `Aptos`, `Segoe UI`, sans-serif.
- Data: `IBM Plex Mono`, `Cascadia Mono`, monospace; tabular figures enabled.
- Scale: 12 / 14 / 16 / 20 / 28 / 40 px. Body is 16px on mobile, 15–16px desktop.
- Body line-height 1.55; long explanations max 68ch.
- No Inter, Roboto, giant marketing headline, excessive all-caps, or decorative italics.

The two web fonts may use Google Fonts with `display=swap`; system fallbacks keep the interface usable if fonts fail.

### Geometry and depth

- 4px base spacing; primary rhythm 8 / 12 / 16 / 24 / 32 / 48.
- Page max width 1240px; content aligned left, not centered as a hero.
- Panels: 10px radius; controls: 6px radius; pills/status chips: 999px.
- Depth is expressed by borders and surface contrast. No card drop shadows, neumorphism, glass, blur, or gradient.
- Z-index scale: 0 / 10 sticky header / 40 dialogs / 100 notifications.

## Layout

- Persistent top bar: identity, network/contract state, wallet control.
- Two top-level destinations only: **Clearing floor** and **My access & credits**. Both use icon + text and have a visible active state.
- Desktop clearing floor: 7/5 split between canonical round and the current role/action rail.
- Mobile: canonical state first, then the available action. No horizontal scrolling; tables collapse to labeled rows.
- Keep reviewer-only details, prompts, raw storage, validator internals, attempt IDs, and full compatibility matrices out of the primary product surface.
- Empty/unconfigured/error states explain why the action is unavailable and what the operator can do next.

## Components

### Buttons

- One primary CTA per view: 48px min height, dark ink or signal background, high-contrast label.
- Secondary actions are bordered; tertiary actions are text-only.
- Destructive actions are spatially separated and require confirmation.
- All interactive targets are at least 44×44px, use `cursor: pointer`, and expose pressed/loading/disabled states.
- Never animate layout. Hover may change color/line and translate by at most 1px.

### Forms

- Controlled inputs with persistent visible labels and helper text.
- Validate on blur or submit; errors sit next to the affected field and state both cause and recovery.
- Use native input/select/textarea semantics, `inputmode` where relevant, and 48px control height.
- Transaction submit shows: awaiting signature → submitted → accepted → finalized, or failed/retryable.
- During an async write, disable duplicate submission without hiding the canonical state.

### Canonical state

- Round phase is a compact text badge plus icon.
- State cards have an eyebrow label only when it materially aids scanning; never stack multiple tiny labels.
- Addresses and IDs use mono text, wrapping or middle ellipsis with an accessible full value.
- Monetary values are displayed in GEN, never raw base units.
- A route grant is shown as an access right with consumed/available text—not as proof of service quality.

## Motion

- 160ms color/border feedback and 220ms opacity/transform for state replacement.
- At most one purposeful entrance transition per view; no GSAP dependency for v1.
- No scroll reveal, parallax, pulsing decoration, or infinite motion.
- `prefers-reduced-motion: reduce` removes nonessential transitions and smooth scrolling.

## Accessibility and responsive lock

- Text contrast ≥4.5:1, large/UI graphic contrast ≥3:1.
- Visible 3px focus ring with 2px offset on every interactive control.
- Skip link to the main workspace; sequential headings; tab order follows visual order.
- Icon-only controls require accessible labels; use one icon family (Phosphor).
- Live transaction/status feedback uses a polite live region; field errors use `role="alert"`.
- Verify at 375, 768, 1024, and 1440px; zoom remains enabled.
- No fixed element may cover content or the mobile safe area.

## Explicit anti-patterns

- No AI-purple palette, dark mesh, centered hero, bento showcase, glassmorphism, or generic SaaS dashboard tiles.
- No Inter + slate default, emoji icons, Lucide-by-habit, fake charts, fake balances, fake wallets, or sample transactions presented as canonical.
- No search-first consumer marketplace pattern: supply/demand is bounded by the open round.
- No keyword-match score, opaque “AI score,” raw validator output, or rationale as a contractual field.
- No claim that a match proves agent quality, fulfillment, or safety.

## Pre-flight

- [ ] One primary CTA per state and role.
- [ ] Canonical state precedes action; unavailable actions explain why.
- [ ] Submitted, accepted, finalized, failed, and retryable are represented.
- [ ] No fake chain/wallet/finality data and no raw base-unit GEN display.
- [ ] Keyboard, focus, screen-reader labels, reduced motion, and 44px targets pass.
- [ ] Contrast and mobile widths 375/768/1024/1440 pass without horizontal scroll.
- [ ] Accent, theme, radius, typography, and icon-family locks are respected.
- [ ] Copy says “access reservation,” never implies performance assurance.
