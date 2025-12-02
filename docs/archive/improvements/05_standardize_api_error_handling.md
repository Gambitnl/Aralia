
- [x] Plan Completed

# Plan: Standardize API Error Handling

## 1. Purpose

The goal of this improvement is to refactor the functions within `src/services/geminiService.ts` to provide a consistent and robust error handling mechanism. Currently, some functions throw an `Error` on failure, while others return an error message within the success object's `text` property. This inconsistency makes error handling in the calling hooks (`useGameActions`, etc.) complex and prone to bugs.

This plan will standardize all public-facing functions in `geminiService.ts` to return a predictable result object: `{ data: T | null, error: string | null }`.

## 2. Key Rules

-   All plans will be written in a checklist format.
-   All phases of the plan will be detailed, including envisioned file/folder structures and general code direction.
-   When code is envisioned, it will be heavily accompanied by comments explaining its function and dependencies.

---

## 3. Implementation Plan

### Phase 1: Define Standardized Result Types

-   [x] **Modify File**: `src/services/geminiService.ts` (or potentially `src/types.ts` if these types are needed elsewhere).
-   **File and Folder Structure**: For now, these types can be defined locally within `geminiService.ts`.
-   **Envisioned Code Content**:
    ```typescript
    // src/services/geminiService.ts at the top of the file

    // Generic result type for simple text generation
    export interface GeminiTextResult {
      text: string;
      promptSent: string;
      rawResponse: string;
    }
    export interface StandardizedTextResult {
      data: GeminiTextResult | null;
      error: string | null;
    }

    // Specific result type for custom actions
    export interface GeminiCustomActionResult {
      actions: Action[]; // Assuming Action is imported from ../types
      text: string;
      promptSent: string;
      rawResponse: string;
    }
    export interface StandardizedCustomActionResult {
        data: GeminiCustomActionResult | null;
        error: string | null;
    }

    // Add other specific result types as needed (e.g., for social checks)
    ```

### Phase 2: Refactor `geminiService.ts` Functions

-   [x] **Modify File**: `src/services/geminiService.ts`
-   **Code Direction**: Refactor every exported function (`generateLocationDescription`, `generateNPCResponse`, `generateCustomActions`, `generateSocialCheckOutcome`, etc.) to adhere to the new pattern. The internal `generateText` helper should be the primary focus.

-   **Envisioned Refactor of `generateText`**:
    ```typescript
    // src/services/geminiService.ts

    // The internal helper function is refactored to handle the try/catch
    // and return the standardized result object.
    async function generateText(
      promptContent: string,
      systemInstruction?: string,
      expectJson: boolean = false,
      functionName: string = 'generateText'
    ): Promise<StandardizedTextResult> { // <--- CHANGE: Returns the new result type
      const fullPromptForLogging = `...`;
      try {
        const response: GenerateContentResponse = await ai.models.generateContent({
          // ... API call parameters ...
        });
        const responseText = response.text.trim();

        // On success, wrap the data in the result object
        return {
          data: {
            text: responseText,
            promptSent: fullPromptForLogging,
            rawResponse: JSON.stringify(response)
          },
          error: null
        };
      } catch (error) {
        console.error(`Gemini API error in ${functionName}:`, error);
        const errorMessage = error instanceof Error ? error.message : String(error);

        // On failure, return the error message in the result object
        return {
          data: null,
          error: `Gemini API error in ${functionName}: ${errorMessage}`
        };
      }
    }
    ```

-   [x] **Refactor Public Functions**: Update all public functions to use the new `generateText` and correctly handle its return type, wrapping their specific data shapes as needed.
    ```typescript
    // Example refactor for generateCustomActions
    export async function generateCustomActions(
        sceneDescription: string,
        context: string,
    ): Promise<StandardizedCustomActionResult> { // <--- CHANGE: Returns the new result type
        // ... prompt setup ...
        const result = await generateText(prompt, systemInstruction, true, 'generateCustomActions');

        if (result.error) {
            // Pass the error up
            return { data: null, error: result.error };
        }
        if (!result.data) {
            return { data: null, error: 'No data returned from generateText' };
        }

        let actions: Action[] = [];
        try {
            // Parse actions from result.data.text
            // ...
        } catch(e) {
            return { data: null, error: 'Failed to parse JSON from generateCustomActions' };
        }

        return {
            data: {
                actions,
                text: result.data.text,
                promptSent: result.data.promptSent,
                rawResponse: result.data.rawResponse
            },
            error: null
        };
    }
    ```

### Phase 3: Refactor Calling Hooks and Components

-   [x] **Modify Files**: `src/hooks/actions/*.ts` (e.g., `handleMovement.ts`, `handleNpcInteraction.ts`, etc.).
-   **Code Direction**: This is the most extensive part of the refactor. Every place a `geminiService` function is called must be updated to handle the new return signature. `try/catch` blocks around these calls can be replaced with a simple `if (result.error)` check.

-   **Envisioned Refactor in `handleMovement.ts`**:
    ```typescript
    // src/hooks/actions/handleMovement.ts

    // ... inside handleMovement function ...

    if (descriptionGenerationFn) {
        // OLD WAY:
        // try {
        //   const newDescriptionResult = await descriptionGenerationFn();
        //   newDescription = newDescriptionResult.text;
        // } catch (e) { /* ... */ }

        // NEW WAY:
        const result = await descriptionGenerationFn();
        // Log the interaction regardless of success or failure (if the service returns prompt info on error)
        addGeminiLog(geminiFunctionName, result.data?.promptSent || 'Prompt not available on error', result.data?.rawResponse || result.error || 'Raw response not available');

        if (result.error) {
            addMessage("There was an issue describing your new surroundings.", 'system');
            console.error("Gemini Error during movement description:", result.error);
            // newDescription will remain the fallback description
        } else if (result.data) {
            newDescription = result.data.text;
        }
    }

    // ... rest of the function ...
    ```

### Phase 4: Verification

-   [ ] **Test All AI Interactions**: Systematically test every feature that calls the `geminiService` to ensure that both success and failure paths are handled gracefully by the new standardized result object. This includes looking around, talking to NPCs, asking the oracle, inspecting tiles, etc.
