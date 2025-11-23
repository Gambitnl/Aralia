# Guide: Creating Tables in Glossary Entries

This guide outlines the two primary methods for creating tables in Aralia RPG glossary entries, ensuring they are styled correctly and consistently.

## Method 1: Standard Markdown Tables (For Most Content)

For most data, like class feature progressions, spell lists, or simple data comparisons, you should use standard GitHub Flavored Markdown (GFM) table syntax. These tables are automatically styled by the application's global `.prose table` CSS rules, giving them a consistent, themed look.

### Syntax

```markdown
| Header 1          | Header 2            | Header 3      |
|-------------------|---------------------|---------------|
| Row 1, Cell 1     | Row 1, Cell 2       | Row 1, Cell 3 |
| Row 2, Cell 1     | Row 2, Cell 2       | Row 2, Cell 3 |
| A longer entry... | And another one...  | And a third.  |
```

### Example: Barbarian Class Features Table

The main features table for the Barbarian class is a perfect example of a standard Markdown table:

```markdown
| Level | Proficiency Bonus | Class Features                               | Rages | Rage Damage | Weapon Mastery |
|-------|-------------------|----------------------------------------------|-------|-------------|----------------|
| 1     | +2                | Rage, Unarmored Defense, Weapon Mastery      | 2     | +2          | 2              |
| 2     | +2                | Danger Sense, Reckless Attack                | 2     | +2          | 2              |
```

This table will automatically receive the dark theme, borders, and hover effects defined in `index.html`.

## Method 2: Custom HTML Tables (For "At a Glance" Summaries)

For special cases, like the "At a Glance" summary table at the top of a class entry, you might need more control over styling than the default `.prose` rules allow. In these cases, you can use a raw HTML `<table>` wrapped in a `<div class="not-prose">`.

### `not-prose` Wrapper

The `.not-prose` class from Tailwind's Typography plugin tells the browser to *not* apply the default prose styles to the elements inside it. This allows you to use standard Tailwind utility classes for custom styling.

### Syntax

```html
<div class="not-prose my-6">
  <table class="min-w-full divide-y divide-gray-600 border border-gray-600 rounded-lg shadow-md">
    <thead class="bg-gray-700/50">
      <tr>
        <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-sky-300 uppercase tracking-wider border-b border-gray-600">Trait</th>
        <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-sky-300 uppercase tracking-wider border-b border-gray-600">Details</th>
      </tr>
    </thead>
    <tbody class="bg-gray-800/50 divide-y divide-gray-700">
      <tr class="hover:bg-gray-700/40 transition-colors duration-150">
        <td class="px-4 py-3 text-sm font-medium text-amber-300 align-top">Primary Ability</td>
        <td class="px-4 py-3 text-sm text-gray-300 align-top">Strength</td>
      </tr>
      <!-- ... other rows ... -->
    </tbody>
  </table>
</div>
```

This gives you full control over borders, backgrounds, padding, and text styles using Tailwind classes.

---

## Case Study: The Circle of the Land Druid Problem

A common pitfall is mixing Markdown table syntax inside of HTML elements. **This will not work with our current setup.**

### The Problem

In a previous version of the `circle_of_the_land.md` entry, we attempted to place Markdown tables inside a `<details>` HTML element, like this:

```html
<!-- INCORRECT - WILL NOT RENDER TABLES -->
<details markdown="1">
  <summary>Circle of the Land Spells</summary>
  <div>
    <h4>Arid Land</h4>
    | Druid Level | Circle Spells |
    |---|---|
    | 3 | Blur, Burning Hands, Fire Bolt |

    <h4>Polar Land</h4>
    | Druid Level | Circle Spells |
    |---|---|
    | 3 | Fog Cloud, Hold Person, Ray of Frost |
  </div>
</details>
```

The `marked.js` library, which we use for parsing, sees the `<details>` tag and treats everything inside it as literal HTML. It **does not parse Markdown syntax within HTML blocks** by default. The `markdown="1"` attribute is a convention for other parsers and has no effect here. The result was that the table syntax (`| --- |`) was rendered as plain text.

### The Solution

The solution was to separate the content (Markdown) from the structure (HTML).

1.  **Simplify the Markdown**: The `.md` file was changed to contain *only* Markdown headings and tables, with no surrounding `<details>` tags.

    **Correct Markdown (`circle_of_the_land.md`):**
    ```markdown
    ### Level 3: Circle of the Land Spells
    ...
    #### Arid Land
    | Druid Level | Circle Spells                 |
    |-------------|-------------------------------|
    | 3           | Blur, Burning Hands, Fire Bolt|
    
    #### Polar Land
    | Druid Level | Circle Spells                  |
    |-------------|--------------------------------|
    | 3           | Fog Cloud, Hold Person, Ray of Frost |
    ```
    This allows `marked.js` to correctly parse the Markdown and convert it into proper `<table>` HTML.

2.  **Add Structure in React**: The `GlossaryContentRenderer.tsx` component was enhanced to take the parsed HTML and programmatically wrap the content following an `<h3>` heading into a `<details>` element. This ensures the structure is applied *after* the content has been correctly parsed.

**Key Takeaway**: For tables to render correctly, they must be written in one of the two formats above and **must not** be nested inside HTML block elements within your Markdown file. If you need a collapsible section containing tables, the structure must be applied programmatically in the React component, not in the source `.md` file.