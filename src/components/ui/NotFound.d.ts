/**
 * @file NotFound.tsx
 *
 * @component-owner UI Team / Core UI
 */
import React from 'react';
interface NotFoundProps {
    onReturnToMainMenu: () => void;
}
/**
 * A dedicated 404 Not Found component.
 * Displays an immersive "Lost in the Mists" message with navigation options.
 */
declare const NotFound: React.FC<NotFoundProps>;
export default NotFound;
