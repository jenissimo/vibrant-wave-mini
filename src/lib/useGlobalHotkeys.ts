import { useHotkeys } from '@/lib/useHotkeys';
import { useEffect } from 'react';
import { CanvasElementData } from '@/components/Canvas';
import { clipboardManager } from './clipboardManager';
import { AddElementCommand } from './commands/AddElementCommand';
import { commandManager } from './commandManager';
import { exportSliceAsImage, isSlice } from './sliceUtils';
import { insertImageToCanvas, getImageFromFile, isImageFile } from './imageUtils';

export function useGlobalHotkeys(args: {
  enabled: boolean;
  selectedElementId: string | null;
  elements: CanvasElementData[];
  removeElement: (id: string) => void;
  addElement: (element: CanvasElementData) => Promise<string>;
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
    { key: 'z', ctrl: true, handler: () => {
      if (activeFocus === 'canvas') undo();
    }},
    { key: 'z', meta: true, handler: () => {
      if (activeFocus === 'canvas') undo();
    }},
    { key: 'y', ctrl: true, handler: () => {
      if (activeFocus === 'canvas') redo();
    }},
    { key: 'y', meta: true, handler: () => {
      if (activeFocus === 'canvas') redo();
    }},
    { key: 'Z', ctrl: true, shift: true, handler: () => {
      if (activeFocus === 'canvas') redo();
    }},
    { key: 'Z', meta: true, shift: true, handler: () => {
      if (activeFocus === 'canvas') redo();
    }},
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
        
        // 2. System clipboard (if it's an image) - but mark as internal copy
        if (selectedElement.type === 'image') {
          try {
            e.preventDefault();
            
            let imageSrc: string;
            if (isSlice(selectedElement)) {
              // Export slice as separate image
              imageSrc = await exportSliceAsImage(selectedElement);
            } else {
              // Use original image
              imageSrc = selectedElement.src;
            }
            
            const response = await fetch(imageSrc);
            const blob = await response.blob();
            const clipboardItem = new ClipboardItem({ [blob.type]: blob });
            await navigator.clipboard.write([clipboardItem]);
            
            // Mark that we just copied from canvas
            clipboardManager.markAsInternalCopy();
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
      
      // Handle canvas paste - smart priority logic
      if (activeFocus === 'canvas') {
        e.preventDefault();
        
        // Check if we just copied from canvas (internal copy)
        const isInternalCopy = clipboardManager.isFromInternalCopy();
        const internalElement = clipboardManager.paste();
        
        // If we have internal element and it's from our copy, prioritize it
        if (isInternalCopy && internalElement) {
          const id = `el_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
          const newElement: CanvasElementData = {
            ...internalElement,
            id,
            x: internalElement.x + 16,
            y: internalElement.y + 16,
          };
          commandManager.execute(new AddElementCommand(newElement));
          setSelectedElementId(newElement.id);
          clipboardManager.clear(); // Reset internal copy flag
          return;
        }
        
        // Otherwise, check system clipboard for images
        let hasSystemImage = false;
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf('image') !== -1) {
            hasSystemImage = true;
            const file = items[i].getAsFile();
            if (file) {
              getImageFromFile(file).then(src => {
                insertImageToCanvas({
                  src,
                  targetArea: { width: 200, height: 200, x: 100, y: 100 },
                  maxSize: { width: 200, height: 200 }
                }, (element) => {
                  setSelectedElementId(element.id);
                });
              }).catch(err => {
                console.error('Failed to process clipboard image:', err);
              });
            }
            break; // only paste one image
          }
        }
        
        // If no system image found, try internal clipboard as fallback
        if (!hasSystemImage && internalElement) {
          const id = `el_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
          const newElement: CanvasElementData = {
            ...internalElement,
            id,
            x: internalElement.x + 16,
            y: internalElement.y + 16,
          };
          commandManager.execute(new AddElementCommand(newElement));
          setSelectedElementId(newElement.id);
        }
        return;
      }
      
      // Handle prompt paste - only system clipboard
      if (activeFocus === 'prompt') {
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf('image') !== -1) {
            e.preventDefault();
            const file = items[i].getAsFile();
            if (file) {
              getImageFromFile(file).then(src => {
                addReference(src);
              }).catch(err => {
                console.error('Failed to process clipboard image for prompt:', err);
              });
            }
            break; // only paste one image
          }
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


