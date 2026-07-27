/**
 * @file ImageModal.tsx
 * A component for displaying a large image in a full-screen modal overlay.
 *
 * @component-owner UI Team / Core UI
 */
import React from 'react';
interface ImageModalProps {
    src: string;
    alt: string;
    onClose: () => void;
}
declare const ImageModal: React.FC<ImageModalProps>;
export default ImageModal;
