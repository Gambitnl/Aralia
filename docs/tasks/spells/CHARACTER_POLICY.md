# Character Encoding Policy

This document defines the allowed character encoding and formatting for various data files in the Aralia repository to prevent "mojibake" (broken character encoding sequences) and ensure consistency across platforms and editors.

## 1. ASCII-Strict Targets
The following directories MUST contain only valid ASCII characters (U+0000 to U+007F):
- `docs/spells/reference/**/*.md`
- `public/data/spells/**/*.json`
- `public/data/glossary/entries/**/*.json`

### Prohibited Characters in Strict Targets
- **Curly Quotes**: Use straight quotes (`'` and `"`) instead of `‘`, `’`, `“`, `”`.
- **Special Dashes**: Use a standard hyphen-minus (`-`) instead of en-dash (`–`) or em-dash (`—`).
- **Ellipses**: Use three literal dots (`...`) instead of the ellipsis character (`…`).
- **Non-breaking Spaces**: Use standard spaces (U+0020).

## 2. Forbidden Everywhere
The following characters are strictly forbidden in ALL files within the repository:

- **Mojibake Markers**:
  - `U+FFFD` (Replacement Character: )
  - Broken UTF-8 sequences (e.g., `Ã` followed by another byte common in Latin-1 mis-decodes)
  - Common triplets like `â‚¬™` (mis-decoded right-quote)
- **Control Characters**:
  - `U+0000` to `U+0008`
  - `U+000B` to `U+000C`
  - `U+000E` to `U+001F`
  - (Tabs `U+0009`, Newlines `U+000A`, and Carriage Returns `U+000D` are allowed where semantic)
- **Zero-Width / Invisible Characters**:
  - Byte Order Mark (BOM): `U+FEFF`
  - Zero-width spaces: `U+200B`, `U+200C`, `U+200D`

## 3. Enforcement
- All pull requests are checked for encoding violations as part of the `npm run validate` suite.
- Use `npm run validate:charset` to scan for issues locally.
- Use `npm run fix:charset` to automatically normalize common violations (like curly quotes) into their ASCII equivalents.
