# Design system

Every screen in the frontend must look like the **design reference**: the clickable GaŤe Parking prototype the team agreed on (ask the project lead for the link). This page turns that reference into rules you can follow without opening it.

The code lives in `frontend/src/styles/`:

| File                    | What it is                                                                       |
| ----------------------- | -------------------------------------------------------------------------------- |
| `tokens.css`            | All design tokens (colours, type, spacing, radius, sizes). The only raw colours. |
| `components.css`        | Shared classes ported from the reference: buttons, forms, pills, tiles, modals.  |
| `design-tokens.test.ts` | Fails `npm run check` if a raw colour appears anywhere else.                     |

Both stylesheets are loaded once in `src/main.tsx`. You never import them again.

## The look in one paragraph

White ground, dark navy text, **one** blue accent. Flat: no gradients, no coloured cards, almost no shadows (only menus, modals and toasts float). Sections are separated by thin grey lines, not boxes. Inter for text, JetBrains Mono only for licence plates and codes. A single centred column, 880px wide. Numbers that matter (spot number, free spots, timer) are big and bold; everything else is quiet.

## Hard rules

1. **No raw colours outside `tokens.css`.** No `#hex`, `rgb()`, `hsl()` or named colours (`red`, `white`) in CSS or TSX. Use `var(--token)`. The test enforces this.
2. **Use the shared classes first.** A button is `className="btn btn-primary"`, not a new `.my-page__submit`. Write new CSS only for layout that no shared class covers, and build it from tokens (`var(--space-4)`, `var(--r)`, `var(--text-sm)`).
3. **No inline `style={{ … }}` for colour, font or spacing.** Inline styles are only for truly dynamic values (e.g. a bar's `width: 40%`).
4. **One accent.** Blue (`--blue`) means "do this / selected / EV". Green, amber and red only carry status meaning (see below), never decoration.
5. **One primary button per screen area.** Other actions are default (`btn`) or `btn-ghost`. Destructive actions use `btn-danger`, usually inside a confirm modal.
6. **Every screen works at 360px wide**: 16px side gutter, no horizontal page scroll. Wide tables go in `.tbl-wrap`.
7. **Accessible by default**: every input has a `<label>`, icon-only buttons have `aria-label`, focus stays visible (do not remove the outline), text contrast stays as the tokens give it.
8. **No new UI libraries** (Tailwind, MUI, Bootstrap, styled-components…) without team agreement. Plain CSS + these tokens.
9. **Need a new colour or component?** Talk to the team first, then add it to `tokens.css` / `components.css` and this page in the same PR.

## Tokens

### Colour

| Token                      | Use                                                     |
| -------------------------- | ------------------------------------------------------- |
| `--bg`                     | Page and card background (white)                        |
| `--surface`                | Hover fill, disabled fill, auth screen background       |
| `--line` / `--line-strong` | Dividers and card edges / input and button borders      |
| `--ink`                    | Headings and body text                                  |
| `--ink-2`                  | Secondary text, subtitles, inactive tabs                |
| `--ink-3`                  | Labels, hints, table headers, eyebrows                  |
| `--on-accent`              | Text on blue, red or dark fills                         |
| `--blue`                   | Primary buttons, focus outline, selection, EV highlight |
| `--blue-600`               | Hover on blue, active tab, blue text on `--blue-50`     |
| `--blue-50` / `--blue-100` | Selected / reserved background; focus ring, avatar      |
| `--green`, `--green-50`    | Success: parked, free, approved                         |
| `--amber`, `--amber-50`    | Warning: pending, payment due                           |
| `--red`, `--red-50`        | Errors and destructive actions                          |
| `--slate`, `--slate-50`    | Neutral status: done, cancelled, occupied               |
| `--shadow`                 | Menus, modals, toasts only                              |

### Status → colour mapping

Use these everywhere so a status always looks the same:

| Status                                | Label                                                  | Pill class   |
| ------------------------------------- | ------------------------------------------------------ | ------------ |
| Reservation `reserved`                | Booked                                                 | `pill blue`  |
| Reservation `active`                  | Parked                                                 | `pill green` |
| Reservation `completed`               | Done                                                   | `pill gray`  |
| Reservation `cancelled`               | Cancelled                                              | `pill gray`  |
| Account `pending`                     | Pending                                                | `pill amber` |
| Account `active`                      | Active                                                 | `pill green` |
| Account `disabled`                    | Disabled                                               | `pill gray`  |
| Spot `free` / `reserved` / `occupied` | tile default / `tile st-reserved` / `tile st-occupied` |              |

EV spots and electric vehicles get the `.ev` tag (bolt icon + "EV") and, for the big spot number, `.hero-num.is-ev`.

### Typography

Font `--font` (Inter); `--mono` (JetBrains Mono) only for plates, codes, tokens. Body is `--text-base` (15px), line height 1.5. Headings use `--tracking-tight`.

| Role                        | Size token                                       | Weight token        |
| --------------------------- | ------------------------------------------------ | ------------------- |
| Page title (`.head h1`)     | `--text-2xl` (mobile 23px), `--text-3xl` desktop | `--weight-strong`   |
| Modal title                 | `--text-lg`                                      | `--weight-strong`   |
| Section title               | `--text-md`; desktop: 13px uppercase `--ink-3`   | `--weight-semibold` |
| Labels, buttons             | 14px                                             | `--weight-medium`   |
| Hints, pills, table headers | `--text-xs`                                      | medium / semibold   |
| Big figures                 | `--text-figure`, hero `--text-hero`              | strong / bold       |

Numbers in tables, timers and counts use `font-variant-numeric: tabular-nums` (class `.tabular`; `td` has it already). Write sentence case ("Book a spot"), not Title Case.

### Spacing, radius, sizes

- Spacing is a 4px grid: `--space-1` (4) … `--space-16` (64). Do not use other values.
- Radius: `--r` (8px) for buttons, inputs and notes; `--r-md` tiles and menus; `--r-lg` auth card; `--r-xl` modals; `--r-pill` pills and avatars.
- Control heights: `--control-sm` 32, `--control` 40 (default), `--control-input` 42, `--control-lg` 48 (main action on a page).
- Layout: `--page-max` 880px column, `--gutter` 16px, auth card `--auth-max` 400px, modal `--modal-max` 460px. Breakpoint 720px: above it the top bar shows tabs, below it a bottom tab bar.

## Components

Use these class names exactly. Examples are JSX.

**Page**

```tsx
<main className="page">
  <div className="head">
    <div>
      <h1>My bookings</h1>
      <p>Upcoming and past parking.</p>
    </div>
    <a className="btn btn-primary" href="/book">
      Book a spot
    </a>
  </div>
  <h2 className="section-title">Upcoming</h2>
  <section className="card">…</section>
</main>
```

**Buttons**: `btn` + one of `btn-primary`, `btn-danger`, `btn-ghost`; size `btn-sm` / `btn-lg`; `btn-block` for full width. Disable with the `disabled` attribute.

**Forms**

```tsx
<form className="form">
  {error && <div className="err">{error}</div>}
  <div className="field">
    <label htmlFor="plate">Licence plate</label>
    <input id="plate" className="input" aria-invalid={!!plateErr} />
    {plateErr ? (
      <span className="field-err">{plateErr}</span>
    ) : (
      <span className="hint">For example 1AB 2345.</span>
    )}
  </div>
  <div className="row">{/* fields side by side, wraps on phones */}</div>
  <button className="btn btn-primary btn-lg btn-block">Save</button>
</form>
```

Other form pieces: `select` for `<select>`, `seg` (segmented control, active button `on` or `aria-pressed`), `choice` (radio cards), `switch` (toggle rows), `note` (blue info), `ok-note` (green success), `err` (red error).

**Lists and tables**: a list is a `card` of `item` rows (`item-t` title, `item-s` subtitle, `grow` for the flexible middle, actions on the right). Tables use `<table className="tbl">` inside `tbl-wrap`, actions in a right-aligned `acts` cell.

**Domain pieces**

- Licence plate: `<span className="plate"><span className="plate-eu">CZ</span><span className="plate-n">1AB 2345</span></span>`. Always show plates this way.
- Spot map: `tiles` grid of `<button className="tile">` with `tile-n` (number) and `tile-m` (status line); states `sel`, `st-reserved`, `st-occupied`, or `disabled`.
- Big numbers: `hero` + `hero-num` for the user's spot; `figures` for KPI numbers; `bar` for availability; `eyebrow` for the small uppercase label above.
- Empty state: `<div className="empty"><h3>No vehicles yet</h3><p>…</p><button className="btn btn-primary">Add a vehicle</button></div>`.

**Overlays**: modal = `backdrop` > `modal` > `modal-h` / `modal-b` / `modal-f` (buttons right-aligned, primary last). Details inside modals use `kv` (`<dl>`). Short confirmations use a `toast` (dark, bottom centre, optional undo button). Account menu = `menu`.

**Shell**: top bar = `top` > `top-in` > `brand` (`brand-mark` "P" + "GaŤe Parking"), `tabs` (links get class `on` or `active`), `top-right` (`bell`, `avatar`). On phones the same links go in `bottom-tabs`. Sign in / activate screens use `auth` > `auth-card`.

**Icons**: 24×24 stroke SVGs with class `i` (or `i i-sm`), `stroke="currentColor"`, no fill. Pair with text; icon-only buttons need `aria-label`.

## Before you open a PR with UI changes

- [ ] Compared the screen side by side with the design reference.
- [ ] Only shared classes and `var(--token)` values; no raw colours, no inline styling.
- [ ] Checked at 360px and at desktop width.
- [ ] Keyboard: every control reachable with Tab, focus visible.
- [ ] `npm run check` passes (includes the design token test).
