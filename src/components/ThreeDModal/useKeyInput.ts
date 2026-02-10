import type { MutableRefObject } from 'react';
import { useEffect, useRef } from 'react';

export type KeySetRef = MutableRefObject<Set<string>>;

const isEditableTarget = (target: EventTarget | null): boolean => {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
};

export const useKeyInput = (): KeySetRef => {
  const pressedKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const pressedKeys = pressedKeysRef.current;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
      pressedKeys.add(event.code);
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
      pressedKeys.delete(event.code);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      pressedKeys.clear();
    };
  }, []);

  return pressedKeysRef;
};
