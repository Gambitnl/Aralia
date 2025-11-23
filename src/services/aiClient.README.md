
# AI Client Service (`src/services/aiClient.ts`)

## Purpose

The `aiClient.ts` service module plays a critical role in the Aralia RPG application by centralizing the initialization of the Google Gemini API client (`GoogleGenAI`). Its primary responsibilities are:

1.  **API Key Validation**: It ensures that the `API_KEY` environment variable is set. If the key is missing, it throws an error and halts further script execution, preventing the application from attempting to use AI features without proper authentication.
2.  **Client Initialization**: It creates a single, shared instance of the `GoogleGenAI` client using the validated API key.
3.  **Exporting Shared Client**: It exports this initialized `ai` client instance for use by other services that interact with the Gemini API (currently `geminiService.ts` and `ttsService.ts`).

## Core Functionality

*   **API Key Check**:
    *   On module load, it immediately checks `process.env.API_KEY`.
    *   If `process.env.API_KEY` is falsy (not set or empty), an error message is logged to the console, and an `Error` is thrown. This is a hard stop to ensure the application doesn't proceed with AI features disabled or misconfigured.

*   **Client Instantiation**:
    *   If the API key is present, it initializes the `GoogleGenAI` client:
        ```typescript
        export const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        ```
    *   The `apiKey` is passed as a named parameter within an object, adhering to the correct initialization signature for `@google/genai`.

*   **Shared Instance**:
    *   The initialized `ai` object is exported as a constant. This means that any module importing `ai` from `aiClient.ts` will receive the same instance, promoting consistency and efficient resource use.

## Benefits of Centralization

*   **DRY (Don't Repeat Yourself)**: API key validation and client setup logic exist in only one place.
*   **Maintainability**: If client initialization parameters or error handling needs to change, updates are confined to this single file.
*   **Consistency**: Ensures all services use the exact same configured client instance.
*   **Clear Error Handling**: Provides a single, clear point of failure if the essential API key is missing, making debugging easier.

## Data Dependencies

*   **`process.env.API_KEY`**: This environment variable **must** be configured in the execution environment for the application to function correctly. The `aiClient.ts` module relies exclusively on this for obtaining the API key.

## Usage

Other services, like `geminiService.ts` and `ttsService.ts`, import the `ai` client as follows:

```typescript
import { ai } from './aiClient'; // Adjust path as necessary

// Then use the client:
// async function someGeminiCall() {
//   const response = await ai.models.generateContent(...);
//   // ...
// }
```

This approach removes the need for individual services to check for the API key or initialize their own `GoogleGenAI` instances.
