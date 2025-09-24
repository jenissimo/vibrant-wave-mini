import { useRef } from 'react';
import type { CanvasElementData } from '@/components/Canvas';
import { MIN_ELEMENT_SIZE } from '@/lib/canvasDefaults';
import { commandManager } from '@/lib/commandManager';
import { TransformElementCommand } from './commands/TransformElementCommand';
import { AddElementCommand } from './commands/AddElementCommand';
import { RemoveElementCommand } from './commands/RemoveElementCommand';
import { ZOrderCommand } from './commands/ZOrderCommand';

export function useElementHistoryOps() {
  const transformInitialState = useRef<CanvasElementData | null>(null);

  const onElementTransformStart = (id: string, elements: CanvasElementData[]) => {
    const element = elements.find(el => el.id === id);
    if (element) {
      transformInitialState.current = element;
    }
  };

  const onElementTransformEnd = (id: string, finalRect: { x: number; y: number; width: number; height: number; rotation?: number }) => {
    if (transformInitialState.current) {
      const { x: oldX, y: oldY, width: oldW, height: oldH, rotation: oldRot } = transformInitialState.current;
      const oldProps = { x: oldX, y: oldY, width: oldW, height: oldH, rotation: oldRot };
      
      const w = Math.max(MIN_ELEMENT_SIZE, finalRect.width);
      const h = Math.max(MIN_ELEMENT_SIZE, finalRect.height);
      const newProps = { ...finalRect, width: w, height: h };
      
      const command = new TransformElementCommand(id, oldProps, newProps);
      commandManager.execute(command);
      
      transformInitialState.current = null;
    }
  };

  const onElementDragStart = (id: string, elements: CanvasElementData[]) => {
    const element = elements.find(el => el.id === id);
    if (element) {
      transformInitialState.current = element;
    }
  };

  const onElementDragEnd = (id: string, finalPosition: { x: number; y: number }) => {
    if (transformInitialState.current) {
      const { x: oldX, y: oldY, width, height, rotation } = transformInitialState.current;
      const oldProps = { x: oldX, y: oldY, width, height, rotation };
      const newProps = { ...finalPosition, width, height, rotation };
      
      const command = new TransformElementCommand(id, oldProps, newProps);
      commandManager.execute(command);

      transformInitialState.current = null;
    }
  };

  const zOrder = {
    moveUp: (id: string) => commandManager.execute(new ZOrderCommand(id, 'moveUp')),
    moveDown: (id: string) => commandManager.execute(new ZOrderCommand(id, 'moveDown')),
    bringToFront: (id: string) => commandManager.execute(new ZOrderCommand(id, 'bringToFront')),
    sendToBack: (id: string) => commandManager.execute(new ZOrderCommand(id, 'sendToBack')),
  };

  const addElementFromRef = async (src: string, generationArea: { x: number; y: number; width: number; height: number }) => {
    const id = `el_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
    
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
    zOrder,
    addElementFromRef,
    removeElement,
  } as const;
}


