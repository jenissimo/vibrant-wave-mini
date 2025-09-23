import { useEffect, useState } from 'react';

export type HotkeyHandler = (e: KeyboardEvent) => void;

export interface HotkeyBinding {
  /** e.key, case-sensitive as in KeyboardEvent.key, e.g. 'z', 'Z', 'Delete' */
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  /** prevent default when matched, defaults to true */
  preventDefault?: boolean;
  handler: HotkeyHandler;
}

function isTextInput(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName?.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || el.isContentEditable) return true;
  return false;
}

export function useHotkeys(bindings: HotkeyBinding[], enabled: boolean = true) {
  useEffect(() => {
    if (!enabled) return;
    function onKeyDown(e: KeyboardEvent) {
      // ignore when user is typing in inputs
      if (isTextInput(e.target)) return;
      for (const b of bindings) {
        if (
          e.key === b.key &&
          (!!b.ctrl === !!e.ctrlKey || b.ctrl === undefined) &&
          (!!b.meta === !!e.metaKey || b.meta === undefined) &&
          (!!b.shift === !!e.shiftKey || b.shift === undefined) &&
          (!!b.alt === !!e.altKey || b.alt === undefined)
        ) {
          if (b.preventDefault !== false) e.preventDefault();
          b.handler(e);
          break;
        }
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [bindings, enabled]);
}

// Hook for tracking key state (pressed/released)
export function useKeyState(key: string, enabled: boolean = true) {
  const [isPressed, setIsPressed] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === key) setIsPressed(true);
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === key) setIsPressed(false);
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [key, enabled]);

  return isPressed;
}


