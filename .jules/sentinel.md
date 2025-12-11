## 2024-05-22 - XSS in Markdown Rendering
**Vulnerability:** The `GlossaryContentRenderer` component used `dangerouslySetInnerHTML` with `marked` to render Markdown content without any sanitization. This allowed XSS attacks via malicious HTML injection in markdown files.
**Learning:** `marked` does not sanitize output by default. React's `dangerouslySetInnerHTML` is aptly named and requires manual sanitization of the input string using a library like `dompurify`.
**Prevention:** Always use a sanitizer like `dompurify` when using `dangerouslySetInnerHTML` or similar methods that bypass React's built-in escaping, especially when rendering formatted text or markdown.
