# Aralia Glossary: Contributor Guide

The Aralia glossary is a dynamic, JSON-driven system that allows for rich, cross-linked game information. This guide explains how to add, modify, and manage glossary entries.

> [!NOTE]
> For adding playable Character Races, which require updates to character creation and NPC generation logic beyond the glossary, see the specialized [@RACE-ADDITION-DEV-GUIDE.md](file:///c:/Users/gambi/Documents/Git/AraliaV4/Aralia/docs/guides/@RACE-ADDITION-DEV-GUIDE.md).

## 📁 Directory Structure

Glossary data is split between **entries** (the content) and **indices** (the catalog).

- **Entries**: `public/data/glossary/entries/`
    - Organized by subfolders (e.g., `rules/`, `races/`, `spells/`).
- **Indices**: `public/data/glossary/index/`
    - Automated catalog files (e.g., `main.json`, `rules_glossary.json`).
    - **Do not edit these manually** unless you are debugging the system.

---

## 📝 Creating a New Entry

### 1. Create the JSON File
Create a new `.json` file in `public/data/glossary/entries/[category]/`. Use kebab-case for the filename (e.g., `my-new-term.json`).

### 2. Entry Format
Every entry must follow this structure:

```json
{
  "id": "unique_id",
  "title": "Display Title",
  "category": "Rules Glossary",
  "tags": ["combat", "magic"],
  "excerpt": "A short summary for search results.",
  "aliases": ["Alternate Name"],
  "seeAlso": ["another_entry_id"],
  "filePath": "/data/glossary/entries/rules/my-new-term.json",
  "markdown": "# Display Title\n\nYour content here in **Markdown**."
}
```

> [!IMPORTANT]
> - **`id`**: Must be unique across the entire glossary.
> - **`category`**: Determines where it appears in the sidebar. Common categories: `Rules Glossary`, `Character Races`, `Character Classes`, `Spells`, `Magic Items`.
> - **`filePath`**: Must match the actual location of the file relative to the `public/` folder.

---

## 🔗 Advanced Features

### Tooltip Links
To create a link that opens a tooltip when hovered (and navigates on click), use a `<span>` with the `glossary-term-link-from-markdown` class:

```html
See the <span data-term-id="advantage" class="glossary-term-link-from-markdown">Advantage</span> rule for more details.
```

### Tables & Icons
For complex entries like Races or Classes, you can embed HTML tables and inline SVG icons within the `markdown` field.

> [!TIP]
> Use the `not-prose` class on a wrapper `div` to prevent Tailwind CSS Typography from overriding your custom table styles.

Example Table (Simplified):
```html
<div class="not-prose my-6">
  <table class="min-w-full divide-y divide-gray-600 border border-gray-600 rounded-lg">
    <tr class="hover:bg-gray-700/40">
      <td class="px-4 py-3 text-amber-300 font-medium">Trait</td>
      <td class="px-4 py-3 text-gray-300">Description</td>
    </tr>
  </table>
</div>
```

---

## 🚀 Updating the Index

After adding or moving files, you **must** regenerate the glossary index for the changes to show up in the app:

```bash
node scripts/generateGlossaryIndex.js
```

The app will automatically reload the new index on the next startup or when the Glossary component is next mounted.
