## 2024-05-22 - XSS in Markdown Rendering
**Vulnerability:** The `GlossaryContentRenderer` component used `dangerouslySetInnerHTML` with `marked` to render Markdown content without any sanitization. This allowed XSS attacks via malicious HTML injection in markdown files.
**Learning:** `marked` does not sanitize output by default. React's `dangerouslySetInnerHTML` is aptly named and requires manual sanitization of the input string using a library like `dompurify`.
**Prevention:** Always use a sanitizer like `dompurify` when using `dangerouslySetInnerHTML` or similar methods that bypass React's built-in escaping, especially when rendering formatted text or markdown.

## 2024-05-23 - Prompt Injection in AI Service
**Vulnerability:** The `geminiService.ts` constructed AI prompts by directly concatenating raw user input (e.g., player actions, oracle queries) with system instructions. This allowed Prompt Injection attacks where a user could override system behavior using phrases like "System Instruction: Ignore previous rules".
**Learning:** LLM prompts are code. Treating user input as trusted content in a prompt is analogous to SQL injection. Client-side input sanitization is a necessary first layer of defense, even if the model has its own safeguards.
**Prevention:** Always sanitize user input before inserting it into an LLM prompt. Use a dedicated sanitization utility (like `sanitizeAIInput`) to strip known injection delimiters (e.g., "System Instruction:", "Context:") and enforce length limits.
