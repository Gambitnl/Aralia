import React from 'react';

interface SplitPaneLayoutProps {
  controls: React.ReactNode;
  preview: React.ReactNode;
  className?: string;
}

/**
 * Split layout for selection steps.
 * - Desktop: Controls (List) on Left (1/3), Preview (Details) on Right (2/3).
 * - Mobile: Stacked vertically.
 */
export const SplitPaneLayout: React.FC<SplitPaneLayoutProps> = ({ 
  controls, 
  preview,
  className = ''
}) => {
  return (
    <div className={`flex flex-col md:flex-row gap-6 h-full min-h-0 p-1 sm:p-4 ${className}`}>
      {/* Left Pane: Controls/List */}
      <div className="w-full md:w-1/3 lg:w-1/4 bg-gray-900/50 border border-gray-700 rounded-xl p-4 overflow-y-auto flex-shrink-0 shadow-inner h-full min-h-0 max-h-full flex flex-col">
        {controls}
      </div>

      {/* Right Pane: Preview/Details */}
      <div className="w-full md:w-2/3 lg:w-3/4 bg-gray-800 rounded-xl border border-gray-700 p-6 overflow-y-auto shadow-xl relative h-full min-h-0 flex flex-col">
        {preview}
      </div>
    </div>
  );
};
