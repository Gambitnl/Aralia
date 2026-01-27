import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css'; // Reuse main styles (Tailwind, etc.)
import { PreviewAgentDocs } from './components/DesignPreview/steps/PreviewAgentDocs';

const rootElement = document.getElementById('root');

// Wrap it in a simple layout to make it feel like a full page
const AgentDocsPage: React.FC = () => {
    return (
        <div className="h-screen w-screen flex flex-col bg-gray-900">
            {/* Header bar to match Dev Hub aesthetic */}
            <header className="flex-shrink-0 bg-gray-800 border-b border-gray-700 p-4 flex items-center justify-between shadow-md">
                <div className="flex items-center gap-4">
                    <a
                        href="/Aralia/misc/dev_hub.html"
                        className="text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-2"
                    >
                        <span className="text-xl">←</span>
                        <span className="font-semibold uppercase tracking-wider text-sm">Hub</span>
                    </a>
                    <div className="h-6 w-px bg-gray-700 mx-1"></div>
                    <h1 className="text-lg font-cinzel font-bold text-gray-200">Agent Documentation</h1>
                </div>
                <div className="text-xs text-gray-500 font-mono">
                    AntiGravity IDE • Local Environment
                </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-grow overflow-hidden p-6 bg-gray-950">
                <div className="h-full max-w-7xl mx-auto border border-gray-800 rounded-xl shadow-2xl overflow-hidden">
                    <PreviewAgentDocs />
                </div>
            </main>
        </div>
    );
};

if (rootElement) {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
        <React.StrictMode>
            <AgentDocsPage />
        </React.StrictMode>
    );
}
