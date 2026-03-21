# Guide: Creating Tables in Glossary Entries

Last Updated: 2026-03-11
Purpose: Describe the current table-authoring rules for glossary content without relying on stale renderer-path or styling assumptions.

## Current Context

Verified anchors in this pass:
- public/data/glossary/entries/
- src/components/Glossary/GlossaryContentRenderer.tsx
- docs/guides/GLOSSARY_ENTRY_DESIGN_GUIDE.md

Important current-state rule:
- glossary source entries are JSON files that contain markdown content
- when this guide talks about writing tables, it is talking about the markdown field inside those JSON entries

## Method 1: Standard Markdown Tables

Use standard markdown tables for most glossary content.

This is the default choice for:
- feature progressions
- rule comparisons
- class or race summaries that do not need custom layout
- straightforward reference tables

## Method 2: Custom HTML Tables

Use custom HTML tables only when the content genuinely needs tighter visual control than a standard markdown table can provide.

If you use custom HTML tables, keep them intentional and localized rather than turning whole entries into HTML-heavy layouts.

## Current Renderer Note

The current glossary renderer lives at src/components/Glossary/GlossaryContentRenderer.tsx.

This matters because older versions of the guide pointed at outdated renderer paths or older styling assumptions.

The verified current renderer still contains logic that programmatically wraps certain h3-led sections into details-style feature cards.

## Practical Rule For Collapsible Sections

Do not assume raw markdown inside arbitrary HTML blocks will always be interpreted the way an older guide expected.

Current safe rule:
- keep ordinary table content in normal markdown flow whenever possible
- let the renderer handle the structural presentation it already knows about
- only mix HTML and markdown when the entry truly needs it and you have checked the rendered result

## Checklist

- [ ] Put the table content in the JSON entry's markdown body
- [ ] Use a normal markdown table unless custom layout is truly required
- [ ] Prefer renderer-friendly markdown structure before falling back to HTML wrappers
- [ ] Re-check the rendered glossary result after changing complex tables

## Common Drift To Avoid

Do not assume:
- that index.html is the right current reference for glossary table rendering
- that older markdown-inside-HTML examples are still the safest default pattern
- that a custom HTML table is automatically better than a standard markdown table
