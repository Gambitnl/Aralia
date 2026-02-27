// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * CRITICAL CORE SYSTEM: Changes here ripple across the entire city.
 *
 * Last Sync: 27/02/2026, 09:28:03
 * Dependents: CharacterOverview.tsx, CoinDisplay.tsx, CompassPane/index.tsx, DiscoveryLogPane.tsx, EquipmentMannequin.tsx, InventoryList.tsx, NameAndReview.tsx, PartyMemberCard.tsx, PartyOverlay.tsx, SkillDetailDisplay.tsx, SkillSelection.tsx, SkillsTab.tsx, SubmapTile.tsx, TempleModal.tsx, TimeWidget.tsx, Tooltip.tsx, WindowFrame.tsx, WorldPane.tsx
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file Tooltip.tsx
 * This component displays a small pop-up with information when a user hovers over or focuses its trigger element.
 * It uses React Portals to render the tooltip into document.body, allowing it to escape parent clipping.
 * Position is calculated dynamically using JavaScript to stay within viewport bounds.
 * 
 * CHANGE LOG:
 * 2026-02-27 09:24:00: [Preservationist] Added 'data-testid="tooltip"' to 
 * the portal container to enable reliable element selection in 
 * automated tests.
 */
import React, { useState, useRef, useEffect, useCallback, ReactElement, HTMLAttributes, useId } from 'react';
import ReactDOM from 'react-dom';
import { Z_INDEX } from '../../styles/zIndex';

interface TooltipProps {
  children: ReactElement<HTMLAttributes<HTMLElement>>; // Ensures children accept HTML event attributes
  content: string | React.ReactNode; // The content to display inside the tooltip
}

const Tooltip: React.FC<TooltipProps> = ({
  children,
  content,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const ARROW_HEIGHT = 0; 
  const TOOLTIP_MARGIN = 8;

  const tooltipId = useId();

  // TODO(QOL): Exercise extreme edge/corner placements and refine margin/flip rules if any clipping persists (see docs/QOL_TODO.md; if this block is moved/refactored/modularized, update the QOL_TODO entry path).
  const calculateAndSetPosition = useCallback(() => {
    if (!triggerRef.current || !tooltipRef.current) {
      setIsVisible(false);
      return;
    }

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipElem = tooltipRef.current;
    const tooltipRect = tooltipElem.getBoundingClientRect();

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Decide whether to place the tooltip above or below based on available space.
    const spaceAbove = triggerRect.top - TOOLTIP_MARGIN;
    const spaceBelow = viewportHeight - triggerRect.bottom - TOOLTIP_MARGIN;
    const preferAbove = spaceAbove > spaceBelow;

    let newTop = preferAbove
      ? triggerRect.top - tooltipRect.height - ARROW_HEIGHT - TOOLTIP_MARGIN
      : triggerRect.bottom + ARROW_HEIGHT + TOOLTIP_MARGIN;

    // Clamp vertically to viewport to avoid clipping if both spaces are tight.
    if (preferAbove && newTop < TOOLTIP_MARGIN) {
      newTop = Math.max(TOOLTIP_MARGIN, triggerRect.bottom + ARROW_HEIGHT + TOOLTIP_MARGIN);
    }
    if (!preferAbove && newTop + tooltipRect.height > viewportHeight - TOOLTIP_MARGIN) {
      const fallBackTop = triggerRect.top - tooltipRect.height - ARROW_HEIGHT - TOOLTIP_MARGIN;
      newTop = Math.max(TOOLTIP_MARGIN, Math.min(fallBackTop, viewportHeight - tooltipRect.height - TOOLTIP_MARGIN));
    }

    // Horizontal centering with clamping ensures long tooltips do not overflow left/right edges.
    const triggerCenter = triggerRect.left + triggerRect.width / 2;
    const unclampedLeft = triggerCenter - tooltipRect.width / 2;
    const maxLeft = viewportWidth - tooltipRect.width - TOOLTIP_MARGIN;
    const newLeft = Math.min(Math.max(TOOLTIP_MARGIN, unclampedLeft), Math.max(TOOLTIP_MARGIN, maxLeft));

    // For fixed positioning, we use viewport coordinates directly.
    setCoords({ top: newTop, left: newLeft });

  }, []);

  useEffect(() => {
    if (isVisible) {
      const animationFrameId = requestAnimationFrame(() => {
        if (tooltipRef.current && triggerRef.current) {
            calculateAndSetPosition();
        }
      });

      // Keep the tooltip anchored on viewport resizes/scrolls to avoid clipping on edges.
      const handleViewportChange = () => calculateAndSetPosition();
      window.addEventListener('resize', handleViewportChange);
      window.addEventListener('scroll', handleViewportChange, true);

      // Provide an escape hatch for keyboard users who want to dismiss the tooltip without moving focus.
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          setIsVisible(false);
        }
      };
      document.addEventListener('keydown', handleKeyDown);

      return () => {
        cancelAnimationFrame(animationFrameId);
        window.removeEventListener('resize', handleViewportChange);
        window.removeEventListener('scroll', handleViewportChange, true);
        document.removeEventListener('keydown', handleKeyDown);
      };
    } else {
      setCoords(null);
    }
  }, [isVisible, calculateAndSetPosition]);


  const showTooltip = (e: React.MouseEvent<HTMLElement>) => {
    children.props.onMouseEnter?.(e); // Call original handler from children if it exists
    setIsVisible(true);
  };
  const hideTooltip = (e: React.MouseEvent<HTMLElement>) => {
    children.props.onMouseLeave?.(e); // Call original handler from children if it exists
    setIsVisible(false);
  };
   const showTooltipFocus = (e: React.FocusEvent<HTMLElement>) => {
    children.props.onFocus?.(e); // Call original handler from children if it exists
    setIsVisible(true);
  };
  const hideTooltipBlur = (e: React.FocusEvent<HTMLElement>) => {
    children.props.onBlur?.(e); // Call original handler from children if it exists
    setIsVisible(false);
  };
  
  const tooltipElementPortal = isVisible && (
      ReactDOM.createPortal(
        <div
          ref={tooltipRef}
          id={tooltipId}
          data-testid="tooltip"
          role="tooltip"
          className={`fixed z-[${Z_INDEX.TOOLTIP}] px-3 py-2 text-sm font-normal text-white bg-gray-700 rounded-lg shadow-xl transition-opacity duration-150 max-w-sm max-h-60 overflow-y-auto scrollable-content`}
          style={{
            top: coords?.top ? `${coords.top}px` : '-9999px',
            left: coords?.left ? `${coords.left}px` : '-9999px',
            opacity: coords ? 1 : 0,
            visibility: coords ? 'visible' : 'hidden',
          }}
        >
          {content}
        </div>,
        document.body
      )
  );

  const propsForClonedElement = {
    ref: triggerRef,
    onMouseEnter: showTooltip,
    onMouseLeave: hideTooltip,
    onFocus: showTooltipFocus,
    onBlur: hideTooltipBlur,
    'aria-describedby': isVisible && coords ? tooltipId : undefined,
  };

  // Type of children now ensures it can accept these props, so 'as any' is removed.
  // eslint-disable-next-line react-hooks/refs
  const triggerElement = React.cloneElement(children, propsForClonedElement);

  return (
    <>
      {triggerElement}
      {tooltipElementPortal}
    </>
  );
};

export default Tooltip;
