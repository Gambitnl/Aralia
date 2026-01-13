import type { MutableRefObject } from 'react';
import { useEffect, useRef } from 'react';

export type KeySetRef = MutableRefObject<Set<string>>;

export const useKeyInput = (): KeySetRef => {
  const pressedKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      pressedKeysRef.current.add(event.code);
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      pressedKeysRef.current.delete(event.code);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      pressedKeysRef.current.clear();
    };
  }, []);

  return pressedKeysRef;
};
