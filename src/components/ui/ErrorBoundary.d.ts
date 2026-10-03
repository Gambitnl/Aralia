/**
 * @file ErrorBoundary.tsx
 * This component catches JavaScript errors anywhere in its child component tree,
 * logs those errors, and displays a fallback UI.
 * @component-owner UI Team / Core UI
 */
import React, { Component, ErrorInfo, ReactNode } from 'react';
interface Props {
    children: ReactNode;
    fallbackMessage?: string;
}
interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}
declare class ErrorBoundary extends Component<Props, State> {
    state: State;
    static getDerivedStateFromError(error: Error): Partial<State>;
    componentDidCatch(error: Error, errorInfo: ErrorInfo): void;
    private handleReset;
    render(): string | number | bigint | boolean | Iterable<React.ReactNode> | Promise<string | number | bigint | boolean | React.ReactPortal | React.ReactElement<unknown, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode>> | React.JSX.Element;
}
export default ErrorBoundary;
