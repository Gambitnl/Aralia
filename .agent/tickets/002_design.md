---
id: 002_design
title: Design Catalog UI
status: Done
priority: Medium
project: Aralia
created: 2026-01-29
updated: 2026-01-29
links:
  - url: ./parent.md
    title: Parent Ticket
labels: [design, ui]
assignee: Pickle Rick
---

# Description

## Problem to solve
The current UI handles 1 item. It will break with 20.

## Design Spec

### Layout
- **Style**: Dark Mode (Slate-900 background, Slate-800 cards).
- **Structure**:
  - **Header**: Fixed top bar. Title + Search Field + Category Chips.
  - **Grid**: Responsive Grid for cards (`minmax(300px, 1fr)`).

### Components
- **Search**: JavaScript-based filter. Hides cards that don't match text or category.
- **Card**:
  - **Top**: Badge (Category Color) + Title.
  - **Mid**: Description.
  - **Bot**: `<code>` block with "Copy" button (SVG Icon).

### Offline Strategy
- Use internal CSS variables mimicking Tailwind.
- No external fonts (System stack: Segoe UI / Roboto).
- No external JS (Vanilla inline script).
