/**
 * @file audit_and_wire_images.ts
 * Scans for race images and ensures they are wired up in both:
 * 1. src/data/races/*.ts (Character Creator)
 * 2. public/data/glossary/entries/races/*.json (Glossary)
 *
 * MIGRATION (2026-01-21): This script RENAMES files to a hierarchical format (Parent_Subrace_Gender).
 * e.g. wood_elf_male.png -> Elf_Wood_Male.png
 */
export {};
