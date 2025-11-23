/**
 * @file index.tsx
 * This is the main entry point for the Aralia RPG React application.
 * It renders the root App component into the DOM.
 */
// Core React library - provides JSX syntax and component functionality
import React from 'react';
// ReactDOM client methods - createRoot enables React 19's concurrent features
import ReactDOM from 'react-dom/client';
// Root App component - contains all game logic and UI (next execution point: src/App.tsx)
import App from './src/App';

// Find the <div id="root"></div> element from index.html where React will mount
const rootElement = document.getElementById('root');
// Safety check: ensure the root element exists before trying to mount React
// If missing, this prevents cryptic errors later in the mounting process
if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}

// Create a React 19 concurrent root - this enables features like automatic batching,
// transitions, and improved performance compared to legacy ReactDOM.render()
const root = ReactDOM.createRoot(rootElement);
// Render the App component to the DOM
// StrictMode wrapper enables development checks: detects side effects, warns about deprecated APIs
// Note: StrictMode only runs in development, not production builds
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
