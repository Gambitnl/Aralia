import { useEffect, useRef, useState } from 'react';
import { TownDirection, TownPosition } from '../../../types/town';
import { easeOutCubic, lerp, MOVEMENT_DURATION_MS } from '../townUtils';

export const useTownAnimation = (effectivePlayerPosition: TownPosition | null) => {
    const [animatedPosition, setAnimatedPosition] = useState<TownPosition | null>(null);
    const [isAnimating, setIsAnimating] = useState(false);
    const [playerFacing, setPlayerFacing] = useState<TownDirection>('south');
    const previousPositionRef = useRef<TownPosition | null>(null);
    const animationStartTimeRef = useRef<number>(0);
    const animationFrameRef = useRef<number | null>(null);

    // Initialize animated position when effectivePlayerPosition first becomes available
    useEffect(() => {
        if (effectivePlayerPosition && !animatedPosition) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setAnimatedPosition(effectivePlayerPosition);
            previousPositionRef.current = effectivePlayerPosition;
        }
    }, [effectivePlayerPosition, animatedPosition]);

    // Animation effect - triggered when effectivePlayerPosition changes
    useEffect(() => {
        if (!effectivePlayerPosition || !previousPositionRef.current) return;

        // Check if position actually changed
        const prevPos = previousPositionRef.current;
        if (prevPos.x === effectivePlayerPosition.x && prevPos.y === effectivePlayerPosition.y) return;

        // Determine facing direction based on movement
        const dx = effectivePlayerPosition.x - prevPos.x;
        const dy = effectivePlayerPosition.y - prevPos.y;

        let newFacing: TownDirection = 'south';
        if (dx > 0 && dy < 0) newFacing = 'northeast';
        else if (dx > 0 && dy > 0) newFacing = 'southeast';
        else if (dx < 0 && dy < 0) newFacing = 'northwest';
        else if (dx < 0 && dy > 0) newFacing = 'southwest';
        else if (dx > 0) newFacing = 'east';
        else if (dx < 0) newFacing = 'west';
        else if (dy < 0) newFacing = 'north';
        else if (dy > 0) newFacing = 'south';

        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPlayerFacing(newFacing);

        // Start animation
        setIsAnimating(true);
        animationStartTimeRef.current = performance.now();

        const animate = (currentTime: number) => {
            const elapsed = currentTime - animationStartTimeRef.current;
            const progress = Math.min(elapsed / MOVEMENT_DURATION_MS, 1);
            const easedProgress = easeOutCubic(progress);

            // Interpolate position
            const newX = lerp(prevPos.x, effectivePlayerPosition.x, easedProgress);
            const newY = lerp(prevPos.y, effectivePlayerPosition.y, easedProgress);

            setAnimatedPosition({ x: newX, y: newY });

            if (progress < 1) {
                animationFrameRef.current = requestAnimationFrame(animate);
            } else {
                // Animation complete
                setAnimatedPosition(effectivePlayerPosition);
                setIsAnimating(false);
                previousPositionRef.current = effectivePlayerPosition;
            }
        };

        // Cancel any existing animation
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }

        animationFrameRef.current = requestAnimationFrame(animate);

        // Cleanup on unmount
        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [effectivePlayerPosition]);

    return { animatedPosition, isAnimating, playerFacing };
};
