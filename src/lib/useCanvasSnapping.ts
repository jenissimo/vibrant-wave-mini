import { useMemo, useCallback, useRef } from 'react';
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

const SNAP_STEP = 16;

export function useCanvasSnapping({
  generationArea,
  tile,
  stageScale,
}: SnappingOptions) {

  const generationAreaAligned = useMemo(() => {
    const step = SNAP_STEP;
    const x = Math.round(generationArea.x / step) * step;
    const y = Math.round(generationArea.y / step) * step;
    return { ...generationArea, x, y };
  }, [generationArea]);

  const snapPosition = useCallback((pos: { x: number; y: number }, _elementSize?: { width: number; height: number }) => {
    const step = SNAP_STEP;
    if ((1 / stageScale) > step) {
      return pos;
    }
    // Konva Image uses top-left as origin; snap directly in world-space
    const snapX = Math.round(pos.x / step) * step;
    const snapY = Math.round(pos.y / step) * step;
    return { x: snapX, y: snapY };
  }, [stageScale]);

  const snapRect = useCallback((rect: { x: number; y: number; width: number; height: number }) => {
    const step = SNAP_STEP;
    if ((1 / stageScale) > step) {
      return rect;
    }
    // Snap to dotted background pattern in world-space
    const sx = Math.round(rect.x / step) * step;
    const sy = Math.round(rect.y / step) * step;
    const sw = Math.max(MIN_ELEMENT_SIZE, Math.round(rect.width / step) * step);
    const sh = Math.max(MIN_ELEMENT_SIZE, Math.round(rect.height / step) * step);
    return { x: sx, y: sy, width: sw, height: sh };
  }, [
    stageScale,
  ]);

  return { generationAreaAligned, snapPosition, snapRect };
}
