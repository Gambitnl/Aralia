/**
 * Glossary compiler CLI — the build gate.
 *
 * Compiles every non-spell glossary entry's markdown into the typed content
 * model, validates it, builds the cross-reference graph, and emits:
 *   public/data/glossary_bundle.v2.json   (compiled docs)
 *   public/data/glossary_graph.json       (bidirectional reference graph)
 *
 * Any compile error or validation issue fails the run (exit 1) — no
 * grandfathered baseline. Run with --report to see the full issue inventory
 * without writing outputs.
 *
 * Usage: tsx scripts/glossary/compile-glossary.ts [--report]
 * Spec: docs/superpowers/specs/2026-07-06-glossary-structured-content-design.md
 */
export {};
