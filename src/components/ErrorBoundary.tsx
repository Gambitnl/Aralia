/**
 * @file ErrorBoundary.tsx
 * This component catches JavaScript errors anywhere in its child component tree,
 * logs those errors, and displays a fallback UI.
 */
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallbackMessage?: string; // Optional custom message for specific boundaries
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // You can also log the error to an error reporting service
    console.error("Uncaught error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    // Potentially, you could try to re-render children or navigate,
    // but a refresh is often safer for unhandled errors.
    // For now, this reset is local to the boundary. A full page refresh might still be needed by the user.
  };

  public render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        <div className="bg-gray-800 text-red-400 p-6 rounded-lg shadow-xl border border-red-600 text-center m-4">
          <h2 className="text-2xl font-bold text-red-300 mb-4 font-cinzel">
            Oops! Something went wrong.
          </h2>
          <p className="mb-2">
            {this.props.fallbackMessage || "An unexpected error occurred in this part of Aralia."}
          </p>
          <p className="text-sm text-gray-400 mb-4">
            Please try refreshing the page. If the problem persists, the adventure might need to restart.
          </p>
          {this.state.error && (
            <details className="text-left text-xs text-gray-500 bg-gray-700 p-2 rounded mt-2">
              <summary className="cursor-pointer hover:text-gray-300">Error Details</summary>
              <pre className="mt-1 whitespace-pre-wrap break-all">
                {this.state.error.toString()}
                {this.state.errorInfo && `\nComponent Stack:\n${this.state.errorInfo.componentStack}`}
              </pre>
            </details>
          )}
          {/* 
            A reset button could be added, but it's tricky to guarantee a safe state recovery.
            <button
              onClick={this.handleReset}
              className="mt-4 bg-amber-500 hover:bg-amber-600 text-gray-900 font-semibold py-2 px-4 rounded-lg"
            >
              Try to recover
            </button> 
          */}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;