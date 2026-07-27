/**
 * One-shot, idempotent codemod: rewrite legacy HTML-in-markdown glossary
 * entries into the pure-markdown dialect the build-time compiler accepts
 * (src/systems/glossary/compile/compileEntry.ts).
 *
 * It rewrites the `markdown` field of checked-in entry JSON files under
 * public/data/glossary/entries/**. It is safe to run repeatedly: entries that
 * are already clean markdown pass through unchanged.
 *
 * Transformations (never deletes visible content):
 *   - <span data-term-id="X" class="glossary-term-link-from-markdown">D</span>
 *       -> [[X|D]]          (term link shorthand the compiler understands)
 *   - <span class="glossary-term-link-from-markdown">D</span> (no id)
 *       -> D                (plain text; nothing to link to)
 *   - <details><summary>Title</summary><div>body</div></details>
 *       -> "### Title" heading + body as markdown (H3 becomes a collapsible
 *          section in the compiler, mirroring the old <details> card)
 *   - <div class="not-prose ..."><table>...</table></div> and bare <table>
 *       -> GFM pipe table
 *   - <p class="glossary-intro-quote">text</p> / <p>text</p>  -> paragraph
 *   - <div class="glossary-callout"> / <div class="glossary-example*">
 *       -> markdown blockquote (compiler renders blockquote as a callout)
 *   - <ul>/<ol>/<li> -> markdown list
 *   - <strong>/<b> -> **..**, <em>/<i> -> *..*, <br> -> newline
 *   - <caption> -> a bold line above the table
 *
 * Usage: npx tsx scripts/glossary/fix-legacy-entry-markup.ts [--dry] [--only=<id>]
 */
export {};
