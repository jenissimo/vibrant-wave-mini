import { useHotkeys } from '@/lib/useHotkeys';
import { useEffect } from 'react';
import { CanvasElementData } from '@/components/Canvas';
import { clipboardManager } from './clipboardManager';
import { AddElementCommand } from './commands/AddElementCommand';
import { commandManager } from './commandManager';

export function useGlobalHotkeys(args: {
  enabled: boolean;
  selectedElementId: string | null;
  elements: CanvasElementData[];
  removeElement: (id: string) => void;
  addElement: (element: CanvasElementData) => string;
  addReference: (dataUrl: string) => void;
  setSelectedElementId: (id: string | null) => void;
  undo: () => void;
  redo: () => void;
  activeFocus: 'canvas' | 'prompt' | null;
}) {
  const { enabled, selectedElementId, elements, removeElement, addElement, addReference, setSelectedElementId, undo, redo, activeFocus } = args;

  // Keydown hotkeys
  useHotkeys([
    { key: 'Delete', handler: () => {
      if (!selectedElementId || selectedElementId === 'generation-area') return;
      removeElement(selectedElementId);
    }},
    { key: 'Backspace', handler: () => {
      if (!selectedElementId || selectedElementId === 'generation-area') return;
      removeElement(selectedElementId);
    }},
    { key: 'z', ctrl: true, handler: undo },
    { key: 'z', meta: true, handler: undo },
    { key: 'y', ctrl: true, handler: redo },
    { key: 'y', meta: true, handler: redo },
    { key: 'Z', ctrl: true, shift: true, handler: redo },
    { key: 'Z', meta: true, shift: true, handler: redo },
  ], enabled);

  // Copy-paste events
  useEffect(() => {
    if (!enabled) return;

    const handleCopy = async (e: ClipboardEvent) => {
      if (activeFocus !== 'canvas' || !selectedElementId) return;

      const selectedElement = elements.find(el => el.id === selectedElementId);
      if (selectedElement) {
        // 1. Internal clipboard
        clipboardManager.copy(selectedElement);
        
        // 2. System clipboard (if it's an image)
        if (selectedElement.type === 'image') {
          try {
            e.preventDefault();
            const response = await fetch(selectedElement.src);
            const blob = await response.blob();
            const clipboardItem = new ClipboardItem({ [blob.type]: blob });
            await navigator.clipboard.write([clipboardItem]);
          } catch (err) {
            console.error('Failed to copy image to system clipboard:', err);
          }
        }
      }
    };
    
    const handlePaste = async (e: ClipboardEvent) => {
      if (!activeFocus) return;
      
      const items = e.clipboardData?.items;
      if (!items) return;
      
      // Handle canvas paste
      if (activeFocus === 'canvas') {
        e.preventDefault();
        const internalElement = clipboardManager.paste();
        if (internalElement) {
          const id = `el_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
          const newElement: CanvasElementData = {
            ...internalElement,
            id,
            x: internalElement.x + 16,
            y: internalElement.y + 16,
          };
          commandManager.execute(new AddElementCommand(newElement));
          setSelectedElementId(newElement.id);
          return;
        }
      }
      
      // Look for images in clipboard for both canvas and prompt
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          e.preventDefault();
          const file = items[i].getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
              const src = event.target?.result as string;
              if (src) {
                if (activeFocus === 'canvas') {
                  const img = new Image();
                  img.onload = () => {
                    const newElement: CanvasElementData = {
                      id: `el_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
                      type: 'image',
                      src,
                      x: 100, // Placeholder
                      y: 100,
                      width: img.width,
                      height: img.height,
                      visible: true,
                      locked: false,
                    };
                    commandManager.execute(new AddElementCommand(newElement));
                    setSelectedElementId(newElement.id);
                  };
                  img.src = src;
                } else if (activeFocus === 'prompt') {
                  addReference(src);
                }
              }
            };
            reader.readAsDataURL(file);
          }
          break; // only paste one image
        }
      }
    };

    document.addEventListener('copy', handleCopy);
    document.addEventListener('paste', handlePaste);

    return () => {
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('paste', handlePaste);
    };
  }, [enabled, activeFocus, selectedElementId, elements, addElement, addReference, setSelectedElementId]);
}


