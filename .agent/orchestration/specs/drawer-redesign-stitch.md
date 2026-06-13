# Spec: Agent Reference Drawer redesign (Stitch generation)

Use the Stitch MCP (your /stitch-ui-generation capability) to generate a redesigned
slide-over drawer panel for the Agent Matrix dashboard (`misc/agent_matrix.html`).
If the Stitch MCP is unavailable/not logged in, generate the HTML+CSS yourself
in the same spirit and SAY SO in your reply.

## What the drawer shows today (too plain)
A right slide-over (~50% width) that dumps the agent's full reference section:
badge, title, description, "Start Commands" table (command chip + description),
"Optional Parameters" table, slash-command chip groups, usage-limits paragraph.
Problems: long single column, tables waste horizontal space in the narrow drawer,
no internal navigation, wall-of-text limits paragraphs.

## Design requirements
- Dark theme, must harmonize with: bg #0f172a, panel rgba(13,20,36,.6) + blur,
  accent gold #fbbf24, per-agent accent (emerald/sky/rose/violet/teal), fonts:
  'Cinzel Decorative' display, Roboto body, Roboto Mono code.
- Drawer-internal STICKY TAB BAR: Commands | Flags | In-TUI | Limits & Safety.
  Tabs scroll-spy or switch panes — your call, but state the choice.
- Commands as full-width "command cards": big copyable command line on top,
  one-line description under it (NOT a 2-col table).
- Compact header: agent name + version pill + plan pill + live usage line
  (placeholder slot `<div data-slot="live-usage">`).
- Safety verdict badges (SAFE/CAUTION/DANGER) styled prominently.
- 2026 polish: subtle glass layers, micro-hover states, reduced-motion safe.

## Output
Write a single self-contained HTML file (inline CSS, no JS needed; demo content
for ONE agent = Claude) to `.agent/orchestration/stitch-drawer-redesign.html`.
Then reply with exactly: DONE_STITCH
