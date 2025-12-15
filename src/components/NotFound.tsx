import React from 'react';
import { Button } from './ui/Button';

interface NotFoundProps {
  onReturnToMainMenu: () => void;
}

/**
 * A dedicated 404 Not Found component.
 * Displays an immersive "Lost in the Mists" message with navigation options.
 */
const NotFound: React.FC<NotFoundProps> = ({ onReturnToMainMenu }) => {
  const handleGoBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      onReturnToMainMenu();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-amber-100 font-serif p-8 text-center">
      <h1 className="text-8xl mb-6 font-cinzel text-red-900/80 drop-shadow-md">404</h1>
      <h2 className="text-3xl mb-4 text-amber-500 font-cinzel">Lost in the Mists</h2>
      <p className="text-xl mb-12 max-w-lg text-gray-400">
        The path you seek is obscured by thick fog. No destination exists at these coordinates.
      </p>

      <div className="flex gap-4">
        <Button
          variant="secondary"
          size="lg"
          onClick={handleGoBack}
          aria-label="Go back to previous page"
        >
          Turn Back
        </Button>
        <Button
          variant="primary"
          size="lg"
          onClick={onReturnToMainMenu}
          aria-label="Return to Main Menu"
        >
          Return to Safety
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
