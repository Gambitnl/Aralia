## Architecture & Design History

### Standardized API Error Handling

The services in this directory, particularly `geminiService.ts`, adhere to a standardized error handling pattern for all public-facing functions. This pattern ensures that calling components and hooks can handle both success and failure scenarios in a consistent and predictable manner.

**Pattern:** All asynchronous service functions that interact with external APIs return a result object with the following structure:

```typescript
interface StandardizedResult<T> {
  data: T | null;
  error: string | null;
}
```

-   If the API call is successful, the `data` property will contain the payload, and `error` will be `null`.
-   If the API call fails, `data` will be `null`, and `error` will contain a descriptive error message.

This approach eliminates the need for `try/catch` blocks in the calling code, simplifying error handling to a null check on the `error` property of the returned object.

**Example Implementation:**

```typescript
// Example from a calling hook
const result = await someServiceFunction();

if (result.error) {
    // Handle the error
    console.error("Service Error:", result.error);
    showNotification("An error occurred.");
} else if (result.data) {
    // Process the successful result
    processData(result.data);
}
```
