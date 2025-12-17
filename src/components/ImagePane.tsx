/**
 * @file ImagePane.tsx
 * THIS ENTIRE FILE IS OBSOLETE but will be picked up someday.
 * The scene visual feature is currently inactive and this component is no longer used actively in App.tsx.
 */
// TODO(FEATURES): Re-enable scene visuals (wire ImagePane + image generation back into layout) when API quotas allow (see docs/FEATURES_TODO.md; if this block is moved/refactored/modularized, update the FEATURES_TODO entry path).
/*
import React from 'react';

interface ImagePaneProps {
  imageUrl: string | null;
  isLoading: boolean;
}

const ImagePane: React.FC<ImagePaneProps> = ({ imageUrl, isLoading }) => {
  return (
    <div 
        className="w-full aspect-[16/9] max-h-72 bg-gray-700 rounded-lg shadow-xl border border-gray-600 overflow-hidden flex items-center justify-center"
        aria-live="polite" // Announces changes to assistive technologies
        aria-busy={isLoading} // Informs assistive technologies that the pane is busy loading
    >
      {isLoading && (
        <div className="text-center p-4" role="status" aria-label="Loading visual content">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-500 mx-auto mb-2" aria-hidden="true"></div>
          <p className="text-gray-300 text-lg">Generating visual...</p>
        </div>
      )}
      {!isLoading && imageUrl && (
        <img 
            src={imageUrl} 
            alt="Current game scene visual" 
            className="w-full h-full object-contain" // Changed from object-cover
        />
      )}
      {!isLoading && !imageUrl && (
        <div className="text-center p-4">
          <svg aria-hidden="true" className="w-16 h-16 text-gray-500 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
          </svg>
          <p className="text-gray-400 text-lg">No visual for this scene.</p>
        </div>
      )}
    </div>
  );
};

export default ImagePane;
*/
