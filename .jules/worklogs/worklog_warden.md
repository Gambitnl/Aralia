### 2025-12-25 - [Save Integrity Validation]
**Learning:** `JSON.parse` is not enough. LocalStorage can contain valid JSON (e.g. `{}`) that causes massive runtime crashes when cast to a complex type like `GameState`. Blind casting `(data as GameState)` is a security vulnerability.
**Action:** Always implement structural validation (e.g. `validateGameState`) after parsing JSON from untrusted sources (Storage/API), checking for critical required fields before returning the object to the app.
