import { useMemo, useCallback } from 'react';
import { MIN_ELEMENT_SIZE } from '@/lib/canvasDefaults';

interface GenerationArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface SnappingOptions {
  generationArea: GenerationArea;
  tile: number;
  stageX: number;
  stageY: number;
  stageScale: number;
}

export function useCanvasSnapping({
  generationArea,
  tile,
  stageX,
  stageY,
  stageScale,
}: SnappingOptions) {
  // Use tile / 2 as snap step to align with dotted background pattern
  const snapStep = tile / 2;

  const generationAreaAligned = useMemo(() => {
    const x = Math.round(generationArea.x / snapStep) * snapStep;
    const y = Math.round(generationArea.y / snapStep) * snapStep;
    return { ...generationArea, x, y };
  }, [generationArea, snapStep]);

  const snapWorldPosition = useCallback((pos: { x: number; y: number }) => {
    const offsetX = generationAreaAligned.x;
    const offsetY = generationAreaAligned.y;
    
    const snappedX = Math.round((pos.x - offsetX) / snapStep) * snapStep + offsetX;
    const snappedY = Math.round((pos.y - offsetY) / snapStep) * snapStep + offsetY;
    
    return { x: snappedX, y: snappedY };
  }, [snapStep, generationAreaAligned.x, generationAreaAligned.y]);

  const snapAbsolutePosition = useCallback((pos: { x: number; y: number }) => {
    // 1. Convert absolute screen position to world position
    const worldX = (pos.x - stageX) / stageScale;
    const worldY = (pos.y - stageY) / stageScale;

    // 2. Snap in world space
    const snappedWorld = snapWorldPosition({ x: worldX, y: worldY });
    
    // 3. Convert back to absolute screen position
    return { 
      x: snappedWorld.x * stageScale + stageX, 
      y: snappedWorld.y * stageScale + stageY 
    };
  }, [snapWorldPosition, stageX, stageY, stageScale]);

  const snapRect = useCallback((rect: { x: number; y: number; width: number; height: number }) => {
    const snappedPos = snapWorldPosition({ x: rect.x, y: rect.y });
    const sw = Math.max(MIN_ELEMENT_SIZE, Math.round(rect.width / snapStep) * snapStep);
    const sh = Math.max(MIN_ELEMENT_SIZE, Math.round(rect.height / snapStep) * snapStep);
    
    return { x: snappedPos.x, y: snappedPos.y, width: sw, height: sh };
  }, [snapWorldPosition, snapStep]);

  return { generationAreaAligned, snapWorldPosition, snapAbsolutePosition, snapRect };
}
