import { useRef } from 'react';
import type { CanvasElementData } from '@/components/Canvas';
import { MIN_ELEMENT_SIZE } from '@/lib/canvasDefaults';
import { commandManager } from '@/lib/commandManager';
import { TransformElementCommand } from './commands/TransformElementCommand';
import { CompositeCommand } from './commands/CompositeCommand';
import { AddElementCommand } from './commands/AddElementCommand';
import { RemoveElementCommand } from './commands/RemoveElementCommand';
import { ZOrderCommand } from './commands/ZOrderCommand';
import { Command } from './types';

export function useElementHistoryOps() {
  const transformInitialStates = useRef<Map<string, CanvasElementData>>(new Map());

  const onElementTransformStart = (id: string, elements: CanvasElementData[]) => {
    const element = elements.find(el => el.id === id);
    if (element) {
      transformInitialStates.current.set(id, element);
    }
  };

  const onElementTransformEnd = (id: string, finalRect: { x: number; y: number; width: number; height: number; rotation?: number; points?: number[] }) => {
    const initial = transformInitialStates.current.get(id);
    if (initial) {
      const oldProps = {
        x: initial.x, y: initial.y, width: initial.width, height: initial.height,
        rotation: initial.rotation,
        ...(initial.points ? { points: initial.points } : {}),
      };

      const w = Math.max(MIN_ELEMENT_SIZE, finalRect.width);
      const h = Math.max(MIN_ELEMENT_SIZE, finalRect.height);
      const newProps = { ...finalRect, width: w, height: h };

      const command = new TransformElementCommand(id, oldProps, newProps);
      commandManager.execute(command);

      transformInitialStates.current.delete(id);
    }
  };

  const onElementDragStart = (id: string, elements: CanvasElementData[]) => {
    const element = elements.find(el => el.id === id);
    if (element) {
      transformInitialStates.current.set(id, element);
    }
  };

  const onElementDragEnd = (id: string, finalPosition: { x: number; y: number }) => {
    const initial = transformInitialStates.current.get(id);
    if (initial) {
      const { x: oldX, y: oldY, width, height, rotation } = initial;
      const oldProps = { x: oldX, y: oldY, width, height, rotation };
      const newProps = { ...finalPosition, width, height, rotation };

      const command = new TransformElementCommand(id, oldProps, newProps);
      commandManager.execute(command);

      transformInitialStates.current.delete(id);
    }
  };

  const onMultiDragStart = (ids: string[], elements: CanvasElementData[]) => {
    transformInitialStates.current.clear();
    ids.forEach(id => {
      const el = elements.find(e => e.id === id);
      if (el) transformInitialStates.current.set(id, el);
    });
  };

  const onMultiDragEnd = (positions: { id: string; x: number; y: number }[]) => {
    const commands: Command[] = [];
    for (const pos of positions) {
      const initial = transformInitialStates.current.get(pos.id);
      if (initial) {
        commands.push(new TransformElementCommand(pos.id,
          { x: initial.x, y: initial.y, width: initial.width, height: initial.height, rotation: initial.rotation },
          { x: pos.x, y: pos.y, width: initial.width, height: initial.height, rotation: initial.rotation }
        ));
      }
    }
    if (commands.length > 0) commandManager.execute(new CompositeCommand(commands));
    transformInitialStates.current.clear();
  };

  const zOrder = {
    moveUp: (id: string) => commandManager.execute(new ZOrderCommand(id, 'moveUp')),
    moveDown: (id: string) => commandManager.execute(new ZOrderCommand(id, 'moveDown')),
    bringToFront: (id: string) => commandManager.execute(new ZOrderCommand(id, 'bringToFront')),
    sendToBack: (id: string) => commandManager.execute(new ZOrderCommand(id, 'sendToBack')),
  };

  const addElementFromRef = async (src: string, generationArea: { x: number; y: number; width: number; height: number }) => {
    const id = crypto.randomUUID();
    
    // Load image to get original dimensions
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = src;
    });
    
    const ratio = Math.min(
      generationArea.width / Math.max(1, img.width),
      generationArea.height / Math.max(1, img.height),
      1
    );
    const w = Math.max(1, img.width * ratio);
    const h = Math.max(1, img.height * ratio);
    const x = (generationArea.width - w) / 2;
    const y = (generationArea.height - h) / 2;
    
    const newElement: CanvasElementData = { 
      id, 
      type: 'image', 
      src, 
      x, 
      y, 
      width: w, 
      height: h, 
      originalWidth: img.width,
      originalHeight: img.height,
      visible: true, 
      locked: false 
    };
    commandManager.execute(new AddElementCommand(newElement));
    return id;
  };

  const removeElement = (id: string) => {
    commandManager.execute(new RemoveElementCommand(id));
  };
  
  return {
    onElementTransformStart,
    onElementTransformEnd,
    onElementDragStart,
    onElementDragEnd,
    onMultiDragStart,
    onMultiDragEnd,
    zOrder,
    addElementFromRef,
    removeElement,
  } as const;
}


