# Scribe's Journal

## 2024-05-23 - Undocumented Command Classes
**Learning:** Complex Command classes (like `ReactiveEffectCommand`) often lack file-level and class-level JSDoc, making it hard to understand their role in the Command/Event architecture, specifically the distinction between immediate execution and listener registration.
**Action:** When adding or reviewing Command classes, always explain *when* they execute (immediate vs delayed) and *what* external systems they interact with (e.g. Event Emitters, SustainSystem) in the class-level TSDoc.
