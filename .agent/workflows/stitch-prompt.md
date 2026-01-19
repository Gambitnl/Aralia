---
description: Generate an effective prompt for Google Stitch app design
---

# Google Stitch Prompt Generator

---

## Aralia UI Design System

When prompting Stitch for Aralia-related screens, use these design tokens:

### Color Palette

| Role | Color | Hex | Usage |
|------|-------|-----|-------|
| **Background (Primary)** | Dark Slate | `#111827` | Main app background (gray-900) |
| **Background (Secondary)** | Charcoal | `#1f2937` | Cards, modals, panels (gray-800) |
| **Background (Tertiary)** | Deep Gray | `#1a1d23` | Subtle distinction areas (gray-850) |
| **Text (Primary)** | White | `#ffffff` | Main text |
| **Text (Secondary)** | Light Gray | `#d1d5db` | Body text, descriptions (gray-300) |
| **Accent (Primary)** | Amber | `#fcd34d` | Headings, highlights, borders (amber-300) |
| **Accent (Secondary)** | Yellow | `#fde047` | Links, hover states (yellow-400) |
| **Accent (Bright)** | Light Amber | `#fde68a` | H1/H2 headings (amber-200) |
| **Interactive (Primary)** | Sky Blue | `#0ea5e9` | Primary buttons, links (sky-500) |
| **Interactive (Light)** | Light Sky | `#38bdf8` | Hover states (sky-400) |
| **Interactive (Subtle)** | Pale Sky | `#7dd3fc` | Internal links (sky-300) |
| **Emphasis** | Purple | `#c084fc` | Strong/bold text (purple-400) |
| **Border (Muted)** | Gray | `#4a5568` | Table borders, dividers (gray-600/700) |
| **Callout Border** | Sky | `#0ea5e9` | Callout left-border accent |
| **Quote Border** | Deep Amber | `#a77b00` | Blockquote accents |

### Typography

| Element | Font | Weight | Size | Color |
|---------|------|--------|------|-------|
| **Body** | Roboto, sans-serif | 400 | 0.875rem | gray-300 |
| **Display/Titles** | Cinzel Decorative, cursive | 700 | 1.875rem+ | amber-300 |
| **H1** | System sans-serif | 700 | 2.5rem | amber-200 |
| **H2** | System sans-serif | 600 | 1.75rem | amber-200 |
| **H3** | System sans-serif | 600 | 1.25rem | amber-300 |
| **H4** | System sans-serif | 600 | 1rem | yellow-400 |
| **Code** | Source Code Pro, Menlo, Monaco | 400 | inherit | inherit |

### Borders & Corners

| Element | Style |
|---------|-------|
| **Cards/Modals** | 1px solid gray-600 (`#4b5563`), rounded-lg (0.5rem) |
| **Feature Cards** | 1px solid amber-300/30, rounded-lg, subtle amber left-border |
| **Tables** | 1px solid gray-600, rounded-lg with shadow |
| **Buttons** | rounded-lg (0.5rem), shadow-md |
| **Inputs** | Can use 2px solid black if specified |
| **Scrollbars** | 8px width, gray-700 thumb with 4px radius |

### Shadows & Effects

| Element | Shadow |
|---------|--------|
| **Cards** | `0 4px 6px -1px rgba(0,0,0,0.1)` |
| **Modals** | `0 15px 35px rgba(0,0,0,0.4)` |
| **Hover States** | translateY(-2px) lift effect |
| **Transitions** | 150ms ease-in-out for most interactions |

### Button Variants

| Variant | Background | Hover | Text |
|---------|------------|-------|------|
| Primary | sky-600 | sky-500 | white |
| Success | green-600 | green-500 | white |
| Warning | yellow-500 | yellow-400 | gray-900 |
| Danger | red-600 | red-500 | white |
| Orange | orange-500 | orange-400 | white |
| Purple | purple-600 | purple-500 | white |
| Indigo | indigo-500 | indigo-400 | white |

### UI Component Patterns

#### Modal Windows (WindowFrame)
- **Structure**: Floating window with header, content area, and optional actions
- **Header**: Dark gray bar (`#1f2937`) with amber title text, drag handle for repositioning
- **Controls**: Maximize/restore, reset layout, and close buttons in header right
- **Resize**: All edges and corners are draggable resize handles
- **Border**: 1px gray-700, rounded-xl (0.75rem), heavy shadow
- **State persistence**: Size/position saved to localStorage

#### Two-Panel Layout (Glossary Pattern)
- **Left Panel (Sidebar)**: 1/3 width, scrollable category tree with collapsible sections
- **Right Panel (Content)**: 2/3 width, displays selected item details
- **Divider**: Resizable column separator with amber glow on hover
- **Category Headers**: Colored icons, entry counts, expand/collapse arrows (▶)

#### Sidebar Navigation
- **Collapsible Sections**: `<details>/<summary>` pattern with rotating arrow indicator
- **Category Colors**: Purple for search, varying colors by category type
- **Selected State**: Sky-700 background with white text
- **Hover State**: Gray-700/60 background, text-gray-300
- **Entry Nesting**: Left border (gray-700) for visual hierarchy with indent

#### Search Pattern
- **Collapsed State**: Pinned "🔍 Search" button at top of sidebar
- **Expanded State**: Click to reveal text input with autofocus
- **Active Indicator**: Changes color when search term is active
- **Input Style**: Gray-700 background, gray-600 border, sky-500 focus ring

#### Content Display
- **Prose Styling**: Custom markdown rendering with amber headings
- **Feature Cards**: Semi-transparent backgrounds with amber accent borders
- **Tables**: Sticky headers, alternating row backgrounds, hover highlights
- **Collapsible Sections**: Amber-bordered left accent, expandable details

#### Status Indicators
- **Gate Dots**: Small colored circles (emerald=pass, amber=gap, red=fail)
- **Loading States**: Animated spinner with pulse effect
- **Empty States**: Italic gray-500 centered message

#### Micro-Interactions
- **Hover Lift**: Cards translate Y -2px on hover
- **Transition Duration**: 150ms ease-in-out standard
- **Focus Rings**: 2px ring with color matching the element's accent
- **Smooth Scrolling**: `scroll-behavior: smooth` for navigation

### Overall App Vibe

**Dark Fantasy RPG Character Manager**

The interface evokes a medieval tome or grimoire opened on a desk at night:
- **Dark, immersive backgrounds** that don't strain the eyes
- **Amber/gold accents** like candlelight illuminating important elements  
- **Decorative serif fonts** (Cinzel) for titles give it an ancient, magical feel
- **Clean sans-serif** (Roboto) for body text maintains readability
- **Sky blue interactivity** provides modern usability contrast
- **Purple emphasis** for special or highlighted content
- **Subtle semi-transparency** creates depth and layering
- **Smooth transitions** make interactions feel polished

### Stitch Prompt Template for Aralia

Use these base prompts when starting new Aralia-related screens:

**Full Design Prompt:**
```
A dark fantasy RPG character manager interface with a grimoire/ancient tome aesthetic.
Dark slate background (#111827) with charcoal panels (#1f2937).
Amber/gold accent colors (#fcd34d) for headings, highlights, and decorative borders.
Roboto font for body text, decorative serif (Cinzel Decorative) for titles.
Sky blue (#0ea5e9) for interactive elements, buttons, and links.
Purple (#c084fc) for emphasis and special content.
Cards with subtle gray borders, rounded corners (0.5rem), and lift-on-hover effects.
Two-panel layouts with collapsible sidebar navigation on the left.
Semi-transparent overlays create depth. Smooth 150ms transitions.
```

**Minimal Vibe Prompt:**
```
Dark fantasy RPG app. Dark backgrounds, amber/gold accents, sky blue buttons.
Decorative serif titles, clean sans-serif body. Cards with rounded corners and subtle shadows.
Medieval tome aesthetic - like a grimoire opened at night by candlelight.
```

**For Specific Screens**, start with the base vibe then add specifics:
```
[Base vibe]. This screen is a [SCREEN TYPE] showing [CONTENT].
Key elements: [LIST ELEMENTS].
```

---

Use this workflow when you need help creating prompts for [Google Stitch](https://stitch.withgoogle.com/) to design or refine app UIs.

## 1. Determine Prompt Type

Ask yourself: **What stage am I at?**

| Stage | Prompt Type | When to Use |
|-------|-------------|-------------|
| **Starting** | High-Level | Brainstorming, exploring ideas for complex apps |
| **Starting** | Detailed | You know the core features and want a specific starting point |
| **Refining** | Incremental | Iterating on an existing design, one change at a time |

---

## 2. Build Your Prompt

### For **New App** (Starting Fresh)

Fill in this template:

```
A [ADJECTIVE] [APP TYPE] for [TARGET USERS] to [CORE FUNCTIONALITY].
```

**Examples:**
- High-Level: `"An app for marathon runners."`
- Detailed: `"An app for marathon runners to engage with a community, find partners, get training advice, and find races near them."`
- With Vibe: `"A vibrant and encouraging fitness tracking app."` or `"A minimalist and focused app for meditation."`

**Vibe Adjectives to Consider:**
- Vibrant, Playful, Bold, Energetic
- Minimal, Clean, Focused, Calm
- Warm, Inviting, Cozy
- Dark, Sleek, Professional, Modern
- Elegant, Luxurious, Premium
- Industrial, Rugged, Utilitarian

---

### For **Refining** (Iterating on Existing Design)

> ⚠️ **CRITICAL**: Only make **ONE major change per prompt**. Stitch may reset your design if you combine too many changes!

Use this format:

```
On the [SCREEN NAME], [ACTION] [ELEMENT] [HOW/WHERE].
```

**Examples:**
- `"On the homepage, add a search bar to the header."`
- `"Change the primary call-to-action button on the login screen to be larger and use the brand's primary blue color."`
- `"Product detail page for a Japandi-styled tea store. Neutral, minimal colors, black buttons. Soft, elegant font."`

---

## 3. Theme Control (Optional)

### Colors
- Specific: `"Change primary color to forest green."`
- Mood-based: `"Update theme to a warm, inviting color palette."`

### Fonts
- `"Use a playful sans-serif font."`
- `"Change headings to a serif font."`

### Borders & Buttons
- `"Make all buttons have fully rounded corners."`
- `"Give input fields a 2px solid black border."`

### Combined Theme
- `"Book discovery app: serif font for text, light green brand color for accents."`

---

## 4. Image Guidance (Optional)

Be specific about desired imagery style or content:

```
"[SCREEN NAME] for '[SUBJECT].' [IMAGE DESCRIPTION]. Page background/imagery should reflect this."
```

**Example:**
- `"Music player page for 'Suburban Legends.' Album art is a macro, zoomed-in photo of ocean water. Page background/imagery should reflect this."`

---

## 5. Pro Tips Checklist

Before submitting your prompt, verify:

- [ ] **Clear & Concise** — No ambiguous language
- [ ] **One Major Change** — Not combining multiple features
- [ ] **Using UI/UX Keywords** — "navigation bar", "call-to-action button", "card layout", "hero section"
- [ ] **Referencing Elements Specifically** — "primary button on sign-up form", not just "button"
- [ ] **Screenshot Saved** — Always save your progress before major changes!

---

## 6. Example Workflow for Complex Apps

For industrial/complex apps, use this step-by-step approach:

**Prompt 1 – Create structure:**
```
Create a web dashboard to display a task list for factory operators.
Each task should appear as two rows:
- First row: Task title, Operator name, Sector, Machine, Deadline, and Status — each in its own column.
- Second row: Task description that spans the full width, clearly separated below the first.
Use a clean, modern style suitable for fullscreen display in an industrial setting.
```

**Prompt 2 – Add one feature:**
```
Above the task table, add a horizontal row of filter dropdowns for the following fields:
- Task title, Operator name, Sector, Machine, Deadline, Status
The filters should be evenly spaced and styled minimally.
```

**Prompt 3 – Refine layout details:**
```
Move the page title to the left side of the screen, aligned with the task table.
Add a small gear icon to the top-right corner for admin settings access.
```

---

## Quick Reference

| What You Want | Prompt Pattern |
|---------------|----------------|
| New app | `"A [vibe adjective] [app type] for [users] to [features]."` |
| Add element | `"On [screen], add [element] to [location]."` |
| Change color | `"Change [element/primary] color to [color]."` |
| Change font | `"Use [style] font for [element/all text]."` |
| Change buttons | `"Make [buttons/element] have [style]."` |
| Image style | `"[Screen] with [image description]. Background should reflect this."` |
