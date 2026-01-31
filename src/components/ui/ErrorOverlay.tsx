import React from 'react';

interface ErrorOverlayProps {
  message: string;
}

export const ErrorOverlay: React.FC<ErrorOverlayProps> = ({ message }) => {
  return (
    <div className="fixed inset-0 bg-red-900 text-white flex items-center justify-center p-4 z-[var(--z-index-modal-background)]">
      Error loading data: {message}
    </div>
  );
};
