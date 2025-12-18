## 2024-05-22 - Dead Code in Commented Files
**Learning:** Commented-out files often contain TODOs that get lost. "Graveyard" files (entirely commented out) should be deleted, and their intent/TODOs moved to a central documentation file like `docs/FEATURES_TODO.md` to prevent code rot and confusion.
**Action:** When finding a file that is 100% commented out, check for TODOs, move them to a central tracker, and delete the file.
