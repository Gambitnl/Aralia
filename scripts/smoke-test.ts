// scripts/smoke-test.ts

// Purpose: This script performs a lightweight smoke test to ensure that the main application module can be imported without critical errors.
// Why: A smoke test is a quick and simple way to verify the most basic functionality of the application, such as ensuring all dependencies are correctly resolved and that there are no syntax errors.

try {
  // We are dynamically importing the main App component of the application.
  // This is a better target for a smoke test in a Node environment because it's less likely to have direct DOM side-effects upon import,
  // unlike the main entry point 'index.tsx' which tries to render to the DOM.
  await import('../src/App.tsx');
  console.log('Smoke test passed: Application imported successfully.');
  process.exit(0); // Exit with a success code
} catch (error) {
  // If the import fails, we log the error and exit with a failure code.
  // This will signal to any automated scripts that the smoke test has failed.
  console.error('Smoke test failed:', error);
  process.exit(1); // Exit with a failure code
}
