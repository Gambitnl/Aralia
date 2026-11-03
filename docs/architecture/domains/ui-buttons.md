# UI buttons and control roles

Verified: 2026-11-03 against the working tree after the GG-378 migration (button audit debt list at 22 paths with group 4 in progress).

Aralia has one shared button style. Every clickable control in a production
screen uses it, or the audit lists the file as debt. This page tells you which
part of the style to use for a new control.

## Owners

- `src/components/ui/Button.tsx` is the shared action button. It is a
  framer-motion `motion.button` with variants (`primary`, `action`, `success`,
  `danger`, `secondary`, `ghost`) and sizes (`sm`, `md`, `lg`). It forwards refs.
  It wraps its children in a `<span>`.
- `src/styles/buttonStyles.ts` holds the class constants. `BTN_BASE`, the
  sizes and the color variants build `<Button>`. The "Control roles (GG-378)"
  section holds the constants for controls that are not action buttons.
- `src/styles/__tests__/buttonAudit.test.ts` is the guard. It fails on a
  `.tsx` file that has a raw `<button>` or `<motion.button>` and has no
  `BTN_*` reference and no `<Button>`. `buttonAuditDebt.json` beside it lists
  the reviewed debt. A new path fails, and a fixed path must leave the list.

## Which part to use

1. Use `<Button>` for an action: Close, Confirm, Cancel, Buy, Save, Next.
   Keep layout classes (`w-full`, `flex-1`, `min-h-11`) in `className`.
   Set `type="button"` unless the control submits a form.
2. Use a role constant for a control that is not an action button. Put it
   first in `className`, then add only the position and state colors:
   - `BTN_TAB` with `BTN_TAB_IDLE`, or `BTN_TAB_UNDERLINE`: a tab in a tab bar.
   - `BTN_CHIP` with `BTN_CHIP_IDLE`: a filter chip.
   - `BTN_CLEAR_INPUT`: the mark that clears a text field.
   - `BTN_TERM_LINK`: a chip that opens a glossary term.
   - `BTN_TEXT_LINK`: a control that reads as a text link.
   - `BTN_ICON`: an icon-only control. Give it an `aria-label`.
   - `BTN_ROW`: a list or tree row, or a pick card, that selects its item.
   - `BTN_MEDIA`: an image or card wrapper that opens a larger view.
3. Use `BTN_FOCUS_VISIBLE` alone when a role constant fights the control's own
   classes: `rounded-full`, `transition-transform`, `transition-all`, a class
   from a screen CSS file, or an inline `style` object (HUD and map overlays).
4. A bespoke control (map token, drag handle, dice face, portrait button) can
   stay raw. If its file then has no `<Button>` and no `BTN_*` reference, add
   the file to `EXEMPT_FILES` in the audit with a written reason.

Every role constant carries `BTN_FOCUS_VISIBLE`, so every control shows the
same 2 px sky ring for keyboard focus only. A control that shows on hover only
(`opacity-0 group-hover:opacity-100`) must also show on keyboard focus
(`focus-visible:opacity-100`).

## Test effects

- A test that mocks `framer-motion` with only `motion.div` renders `<Button>`
  as undefined. Add a `button` entry that drops `whileTap`, `whileHover` and
  `transition`.
- `getByText('Label')` finds the inner `<span>` of a `<Button>`. Use
  `getByRole('button', { name: 'Label' })`.
- A lazy modal chunk that newly imports `<Button>` also loads framer-motion.
  Its first load in jsdom can pass the 1 s default of `findByRole`.

## Open items

GG-378 in `docs/projects/GLOBAL_GAPS.md` holds the paths that are still on the
debt list and the reason for each.
