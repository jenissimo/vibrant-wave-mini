import { useHotkeys } from '@/lib/useHotkeys';
import { useEffect } from 'react';
import { CanvasElementData, InteractionMode } from '@/components/Canvas';
import { clipboardManager } from './clipboardManager';
import { AddElementCommand } from './commands/AddElementCommand';
import { RemoveElementCommand } from './commands/RemoveElementCommand';
import { CompositeCommand } from './commands/CompositeCommand';
import { commandManager } from './commandManager';
import { exportSliceAsImage, isSlice } from './sliceUtils';
import { insertImageToCanvas, getImageFromFile, isImageFile } from './imageUtils';
import type { Command } from './types';

export function useGlobalHotkeys(args: {
  enabled: boolean;
  selectedElementIds: string[];
  elements: CanvasElementData[];
  removeElement: (id: string) => void;
  addElement: (element: CanvasElementData) => Promise<string>;
  addReference: (dataUrl: string) => void;
  setSelectedElementIds: (ids: string[]) => void;
  undo: () => void;
  redo: () => void;
  activeFocus: 'canvas' | 'prompt' | null;
  interactionMode: InteractionMode;
  setInteractionMode: (mode: InteractionMode) => void;
  brushSize: number;
  setBrushSize: (size: number) => void;
}) {
  const { enabled, selectedElementIds, elements, removeElement, addElement, addReference, setSelectedElementIds, undo, redo, activeFocus, interactionMode, setInteractionMode, brushSize, setBrushSize } = args;

  const deleteSelected = () => {
    const ids = selectedElementIds.filter(id => id !== 'generation-area');
    if (ids.length === 0) return;
    if (ids.length === 1) {
      removeElement(ids[0]);
    } else {
      commandManager.execute(new CompositeCommand(ids.map(id => new RemoveElementCommand(id))));
    }
    setSelectedElementIds([]);
  };

  // Keydown hotkeys
  useHotkeys([
    { key: 'Delete', handler: deleteSelected },
    { key: 'Backspace', handler: deleteSelected },
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
    { key: 'a', ctrl: true, handler: () => {
      if (activeFocus === 'canvas') {
        setSelectedElementIds(elements.map(e => e.id));
      }
    }},
    { key: 'a', meta: true, handler: () => {
      if (activeFocus === 'canvas') {
        setSelectedElementIds(elements.map(e => e.id));
      }
    }},
    { key: 'Escape', handler: () => {
      if (interactionMode !== 'select') setInteractionMode('select');
      else setSelectedElementIds([]);
    }},
    { key: 'v', handler: () => setInteractionMode('select') },
    { key: 'h', handler: () => setInteractionMode('pan') },
    { key: 'b', handler: () => setInteractionMode('brush') },
    { key: 't', handler: () => setInteractionMode('text') },
    { key: '[', handler: () => setBrushSize(Math.max(1, brushSize - (brushSize > 10 ? 5 : 1))) },
    { key: ']', handler: () => setBrushSize(Math.min(50, brushSize + (brushSize >= 10 ? 5 : 1))) },
  ], enabled);

  // Copy-paste events
  useEffect(() => {
    if (!enabled) return;

    const handleCopy = async (e: ClipboardEvent) => {
      if (activeFocus !== 'canvas' || selectedElementIds.length === 0) return;

      const selectedElements = elements.filter(el => selectedElementIds.includes(el.id));
      if (selectedElements.length > 0) {
        // 1. Internal clipboard (all selected elements)
        clipboardManager.copyMany(selectedElements);

        // 2. System clipboard (first image element only) - but mark as internal copy
        const firstImage = selectedElements.find(el => el.type === 'image' && el.src);
        if (firstImage && firstImage.src) {
          try {
            e.preventDefault();

            let imageSrc: string;
            if (isSlice(firstImage)) {
              imageSrc = await exportSliceAsImage(firstImage);
            } else {
              imageSrc = firstImage.src;
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
        const internalElements = clipboardManager.pasteMany();

        // If we have internal elements and it's from our copy, prioritize it
        if (isInternalCopy && internalElements.length > 0) {
          const newIds: string[] = [];
          const commands: Command[] = [];
          for (const el of internalElements) {
            const id = `el_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
            commands.push(new AddElementCommand({
              ...el,
              id,
              x: el.x + 16,
              y: el.y + 16,
            } as CanvasElementData));
            newIds.push(id);
          }
          if (commands.length === 1) {
            commandManager.execute(commands[0]);
          } else {
            commandManager.execute(new CompositeCommand(commands));
          }
          setSelectedElementIds(newIds);
          clipboardManager.clear();
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
                  setSelectedElementIds([element.id]);
                });
              }).catch(err => {
                console.error('Failed to process clipboard image:', err);
              });
            }
            break; // only paste one image
          }
        }

        // If no system image found, try internal clipboard as fallback
        if (!hasSystemImage && internalElements.length > 0) {
          const newIds: string[] = [];
          const commands: Command[] = [];
          for (const el of internalElements) {
            const id = `el_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
            commands.push(new AddElementCommand({
              ...el,
              id,
              x: el.x + 16,
              y: el.y + 16,
            } as CanvasElementData));
            newIds.push(id);
          }
          if (commands.length === 1) {
            commandManager.execute(commands[0]);
          } else {
            commandManager.execute(new CompositeCommand(commands));
          }
          setSelectedElementIds(newIds);
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
  }, [enabled, activeFocus, selectedElementIds, elements, addElement, addReference, setSelectedElementIds]);
}
