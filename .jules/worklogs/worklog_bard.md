## 2025-12-25 - Immersive Text Standards

**Learning:**
Replacing technical terms like "Stats" and "Recommendation" with high-fantasy alternatives ("Archetype", "Channel", "Ancestral Traits") significantly improves immersion without sacrificing clarity. This confirms the Bard persona's directive that "Words create worlds."

**Action:**
Future UI updates should audit terminology for "developer-speak" (e.g., "Confirm", "Select", "Error") and replace them with diegetic equivalents where appropriate, provided usability is maintained.

**Verification Pattern:**
When verifying UI text changes in a multi-step flow (like Character Creation), it is crucial to handle dynamic navigation states (e.g., "Next" button vs. specific selection buttons) robustly in Playwright scripts. Using specific aria-labels (e.g., `aria-label="View details for Human"`) proved more reliable than generic text selectors.
