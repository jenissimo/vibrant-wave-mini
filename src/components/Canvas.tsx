import React, { useRef, useState, useCallback, forwardRef, useImperativeHandle, useEffect, useMemo } from 'react';
import { Stage, Layer, Rect, Group, Circle, Text, Line } from 'react-konva';
import Konva from 'konva';
import { KonvaEventObject } from 'konva/lib/Node';
import CanvasImage from '@/components/canvas/CanvasImage';
import CanvasDrawing from '@/components/canvas/CanvasDrawing';
import CanvasText from '@/components/canvas/CanvasText';
import CanvasSticky from '@/components/canvas/CanvasSticky';
import usePatternDots from '@/components/canvas/usePatternDots';
import GenerationGrid from '@/components/canvas/GenerationGrid';
import SelectionTransformer from '@/components/canvas/SelectionTransformer';
import { MIN_ELEMENT_SIZE, STICKY_MIN_SIZE } from '@/lib/canvasDefaults';
import { useCanvasSnapping } from '@/lib/useCanvasSnapping';
import { useTheme } from '@/lib/useTheme';

export type InteractionMode = 'select' | 'pan' | 'brush' | 'text' | 'sticky';

export interface CanvasElementData {
  id: string;
  type: 'image' | 'drawing' | 'text' | 'sticky';
  // Common
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
  locked: boolean;
  rotation?: number;
  name?: string;
  // Image-specific
  src?: string;
  originalWidth?: number;
  originalHeight?: number;
  sliceX?: number;
  sliceY?: number;
  sliceWidth?: number;
  sliceHeight?: number;
  // Drawing-specific
  points?: number[];       // flat [x0,y0,x1,y1,...] relative to element origin
  stroke?: string;         // hex color
  strokeWidth?: number;
  // Text-specific
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fill?: string;           // text color
  fontStyle?: string;      // 'normal' | 'bold' | 'italic' | 'bold italic'
  // Sticky-specific
  stickyColor?: string;    // background hex color
  stickyShape?: 'square' | 'horizontal';
}

interface CanvasProps {
  width: number;
  height: number;
  generationArea: { width: number; height: number; x: number; y: number };
  gridEnabled: boolean;
  backgroundColor: string; // canvas background (dotted)
  // grid options for generation area
  gridCols: number;
  gridRows: number;
  gridColor: string;
  gridThickness: number;
  // generation area background fill
  generationFillColor: string;
  // number of reference attachments for proper numbering
  attachmentCount: number;

  // elements
  elements: CanvasElementData[];
  selectedElementIds?: string[];
  interactionMode: InteractionMode;
  onSelectElement: (id: string | null, opts?: { shift?: boolean; ctrl?: boolean }) => void;
  onElementPositionChange: (id: string, position: { x: number; y: number }) => void;
  onElementTransform?: (id: string, next: { x: number; y: number; width: number; height: number; rotation?: number }) => void;
  onElementTransformStart?: (id: string) => void;
  onElementTransformMove?: (id: string, next: { x: number; y: number; width: number; height: number; rotation?: number }) => void;
  onElementTransformEnd?: (id: string, finalRect: { x: number; y: number; width: number; height: number; rotation?: number }) => void;
  onElementDragStart?: (id: string) => void;
  onElementDragEnd?: (id: string, pos: { x: number; y: number }) => void;
  onElementNudge?: (id: string, position: { x: number; y: number }) => void;
  onMultiDragStart?: (ids: string[]) => void;
  onMultiDragEnd?: (positions: { id: string; x: number; y: number }[]) => void;
  onMarqueeSelect?: (ids: string[], opts?: { shift?: boolean }) => void;
  snapEnabled?: boolean;

  // drag-n-drop
  onImageDrop?: (file: File, position: { x: number; y: number }) => void;

  // drawing/text tools
  brushColor?: string;
  brushSize?: number;
  onDrawingComplete?: (element: CanvasElementData) => void;
  onTextCreate?: (worldPos: { x: number; y: number }) => void;
  onTextEdit?: (id: string) => void;
  onStickyCreate?: (worldPos: { x: number; y: number }) => void;
  onStickyEdit?: (id: string) => void;
  editingTextId?: string | null;
}

export interface CanvasRef {
  exportGenerationArea: () => string;
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
  fitToArea: () => void;
  getScreenPosition: (worldX: number, worldY: number) => { x: number; y: number; scale: number };
}

// --- Marquee intersection helpers ---

function getElementAABB(el: CanvasElementData) {
  const r = (el.rotation ?? 0) * Math.PI / 180;
  if (Math.abs(r) < 0.001) return { x: el.x, y: el.y, w: el.width, h: el.height };
  const cx = el.x + el.width / 2;
  const cy = el.y + el.height / 2;
  const cos = Math.cos(r), sin = Math.sin(r);
  const hw = el.width / 2, hh = el.height / 2;
  const corners = [
    { x: -hw, y: -hh }, { x: hw, y: -hh },
    { x: hw, y: hh }, { x: -hw, y: hh },
  ].map(p => ({ x: cx + p.x * cos - p.y * sin, y: cy + p.x * sin + p.y * cos }));
  const xs = corners.map(c => c.x), ys = corners.map(c => c.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function rectsIntersect(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
) {
  return !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y);
}

const MARQUEE_THRESHOLD = 3; // px screen distance before marquee activates

const Canvas = forwardRef<CanvasRef, CanvasProps>(({
  width,
  height,
  generationArea,
  gridEnabled,
  backgroundColor,
  gridCols,
  gridRows,
  gridColor,
  gridThickness,
  generationFillColor,
  attachmentCount,
  elements,
  selectedElementIds,
  interactionMode,
  onSelectElement,
  onElementPositionChange,
  onElementTransform,
  onElementTransformStart,
  onElementTransformMove,
  onElementTransformEnd,
  onElementDragStart,
  onElementDragEnd,
  onElementNudge,
  onMultiDragStart,
  onMultiDragEnd,
  onMarqueeSelect,
  snapEnabled,
  onImageDrop,
  brushColor,
  brushSize,
  onDrawingComplete,
  onTextCreate,
  onTextEdit,
  onStickyCreate,
  onStickyEdit,
  editingTextId,
}, ref) => {
  const stageRef = useRef<Konva.Stage | null>(null);
  const contentLayerRef = useRef<Konva.Layer | null>(null);
  const overlayLayerRef = useRef<Konva.Layer | null>(null);
  const [stageScale, setStageScale] = useState(1);
  const [stageX, setStageX] = useState(0);
  const [stageY, setStageY] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const nodeRefs = useRef<Record<string, Konva.Node>>({});
  const initialViewApplied = useRef(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const { colors: themeColors, isDarkMode } = useTheme();

  const { dataUrl: patternDataUrl, tile } = usePatternDots(themeColors.background);

  const { generationAreaAligned, snapWorldPosition, snapAbsolutePosition, snapRect } = useCanvasSnapping({
    generationArea,
    tile,
    stageX,
    stageY,
    stageScale,
  });

  // --- Marquee selection state ---
  const [marqueeRect, setMarqueeRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const marqueeStartRef = useRef<{ worldX: number; worldY: number; screenX: number; screenY: number } | null>(null);
  const marqueeTargetRef = useRef<'stage' | 'generation-area' | null>(null);
  const marqueeRectRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const marqueeCleanupRef = useRef<(() => void) | null>(null);
  // Ref mirrors for values needed inside window-level listeners (avoid stale closures)
  const stageXRef = useRef(stageX);
  const stageYRef = useRef(stageY);
  const stageScaleRef = useRef(stageScale);
  const elementsRef = useRef(elements);
  useEffect(() => { stageXRef.current = stageX; }, [stageX]);
  useEffect(() => { stageYRef.current = stageY; }, [stageY]);
  useEffect(() => { stageScaleRef.current = stageScale; }, [stageScale]);
  useEffect(() => { elementsRef.current = elements; }, [elements]);

  // --- Active stroke state (for brush drawing) ---
  const [activeStroke, setActiveStroke] = useState<{ startX: number; startY: number; points: number[] } | null>(null);
  const activeStrokeRef = useRef<{ startX: number; startY: number; points: number[] } | null>(null);
  const drawingCleanupRef = useRef<(() => void) | null>(null);
  const brushColorRef = useRef(brushColor);
  const brushSizeRef = useRef(brushSize);
  useEffect(() => { brushColorRef.current = brushColor; }, [brushColor]);
  useEffect(() => { brushSizeRef.current = brushSize; }, [brushSize]);

  // Cleanup marquee window listeners on unmount
  useEffect(() => {
    return () => { marqueeCleanupRef.current?.(); };
  }, []);

  useImperativeHandle(ref, () => ({
    exportGenerationArea: () => {
      const stage = stageRef.current;
      if (!stage) return '';
      const overlay = overlayLayerRef.current;
      // Hide overlay UI during export (badges, borders, transformer)
      let overlayPrevVisible: boolean | null = null;
      if (overlay && typeof overlay.visible === 'function') {
        overlayPrevVisible = overlay.visible();
        overlay.visible(false);
        stage.batchDraw();
      }
      // Convert logical coords to screen coords using current pan/zoom
      const sx = stageX + generationAreaAligned.x * stageScale;
      const sy = stageY + generationAreaAligned.y * stageScale;
      const sw = Math.max(1, generationAreaAligned.width * stageScale);
      const sh = Math.max(1, generationAreaAligned.height * stageScale);
      // Compensate zoom to keep output at logical resolution
      const ratio = stageScale > 0 ? 1 / stageScale : 1;
      const dataURL = stage.toDataURL({
        x: sx,
        y: sy,
        width: sw,
        height: sh,
        pixelRatio: ratio,
      });
      // Restore overlay visibility
      if (overlay && overlayPrevVisible !== null) {
        overlay.visible(overlayPrevVisible);
        stage.batchDraw();
      }
      return dataURL;
    },
    zoomIn: () => zoom(1.1),
    zoomOut: () => zoom(1 / 1.1),
    resetView: () => {
      setStageScale(1);
      const newX = (width - generationArea.width) / 2;
      const newY = (height - generationArea.height) / 2;
      setStageX(newX);
      setStageY(newY);
    },
    fitToArea: () => fitToGenerationArea(),
    getScreenPosition: (worldX: number, worldY: number) => ({
      x: worldX * stageScale + stageX,
      y: worldY * stageScale + stageY,
      scale: stageScale,
    }),
  }));

  // Center the view on the generation area initially
  useEffect(() => {
    if (initialViewApplied.current || !width || !generationArea.width) return;
    const newX = (width - generationArea.width) / 2;
    const newY = (height - generationArea.height) / 2;
    setStageX(newX);
    setStageY(newY);
    initialViewApplied.current = true;
  }, [width, height, generationArea]);

  const handleWheel = useCallback((e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    // Always zoom with wheel, centered on cursor
    const scaleBy = 1.1;
    const oldScale = stageScale;
    const pointer = stageRef.current?.getPointerPosition();
    const point = pointer || { x: width / 2, y: height / 2 };
    const mousePointTo = {
      x: (point.x - stageX) / oldScale,
      y: (point.y - stageY) / oldScale,
    };
    const newScaleUnclamped = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
    const newScale = Math.max(0.05, Math.min(8, newScaleUnclamped));
    setStageScale(newScale);
    setStageX(point.x - mousePointTo.x * newScale);
    setStageY(point.y - mousePointTo.y * newScale);
  }, [stageScale, stageX, stageY, width, height]);

  const handleDragMove = useCallback((e: KonvaEventObject<DragEvent>) => {
    const target = e.target as Konva.Node;
    if (target?.getClassName && target.getClassName() === 'Stage') {
      setStageX(target.x());
      setStageY(target.y());
    }
  }, []);

  const handleDragEnd = useCallback((e: KonvaEventObject<DragEvent>) => {
    const target = e.target as Konva.Node;
    if (target?.getClassName && target.getClassName() === 'Stage') {
      setStageX(target.x());
      setStageY(target.y());
    }
  }, []);

  const handleMouseDown = useCallback((e: KonvaEventObject<MouseEvent>) => {
    // Middle mouse button starts panning regardless of mode
    if (e.evt.button === 1) {
      e.evt.preventDefault();
      setIsPanning(true);
      // ensure drag starts immediately
      const stage = stageRef.current;
      if (stage && typeof stage.startDrag === 'function') {
        stage.startDrag();
      }
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    const stage = stageRef.current;
    if (stage && typeof stage.stopDrag === 'function') {
      stage.stopDrag();
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsPanning(false);
    const stage = stageRef.current;
    if (stage && typeof stage.stopDrag === 'function') {
      stage.stopDrag();
    }
  }, []);

  // Drag-n-drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    const imageFile = files.find(file => file.type.startsWith('image/'));

    if (imageFile && onImageDrop) {
      const stage = stageRef.current;
      if (stage) {
        const rect = stage.container().getBoundingClientRect();
        const x = (e.clientX - rect.left - stageX) / stageScale;
        const y = (e.clientY - rect.top - stageY) / stageScale;
        const pos = snapEnabled ? snapWorldPosition({ x, y }) : { x, y };
        onImageDrop(imageFile, pos);
      }
    }
  }, [onImageDrop, stageX, stageY, stageScale]);

  const renderGenerationGrid = () => (
    <GenerationGrid
      enabled={gridEnabled}
      area={{ x: generationAreaAligned.x, y: generationAreaAligned.y, width: generationAreaAligned.width, height: generationAreaAligned.height }}
      cols={gridCols}
      rows={gridRows}
      color={gridColor}
      thickness={gridThickness}
    />
  );

  const zoom = (factor: number) => {
    const oldScale = stageScale;
    const newScale = Math.max(0.05, Math.min(8, oldScale * factor));
    const viewportCenter = { x: width / 2, y: height / 2 };
    const mousePointTo = {
      x: (viewportCenter.x - stageX) / oldScale,
      y: (viewportCenter.y - stageY) / oldScale,
    };
    setStageScale(newScale);
    setStageX(viewportCenter.x - mousePointTo.x * newScale);
    setStageY(viewportCenter.y - mousePointTo.y * newScale);
  };

  const fitToGenerationArea = () => {
    const padding = 32;
    const scaleX = (width - padding * 2) / generationAreaAligned.width;
    const scaleY = (height - padding * 2) / generationAreaAligned.height;
    const newScale = Math.max(0.05, Math.min(8, Math.min(scaleX, scaleY)));
    const targetCenter = {
      x: generationAreaAligned.x + generationAreaAligned.width / 2,
      y: generationAreaAligned.y + generationAreaAligned.height / 2,
    };
    const viewportCenter = { x: width / 2, y: height / 2 };
    setStageScale(newScale);
    setStageX(viewportCenter.x - targetCenter.x * newScale);
    setStageY(viewportCenter.y - targetCenter.y * newScale);
  };

  // Update CSS background of container to follow pan/zoom
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.style.backgroundColor = themeColors.background;
    if (patternDataUrl) {
      const scaledTile = Math.max(1, tile * stageScale);
      el.style.backgroundImage = `url(${patternDataUrl})`;
      el.style.backgroundRepeat = 'repeat';
      el.style.backgroundSize = `${scaledTile}px ${scaledTile}px`;
      el.style.backgroundPosition = `${stageX}px ${stageY}px`;
    } else {
      el.style.backgroundImage = '';
    }
  }, [themeColors.background, patternDataUrl, tile, stageScale, stageX, stageY]);

  // Keyboard nudge with arrow keys using dot step from pattern, adjusted by zoom
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // ignore when user is typing in inputs
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName?.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || target.isContentEditable) return;
      }

      if (interactionMode !== 'select') return;
      const ids = (selectedElementIds ?? []).filter(id => id !== 'generation-area');
      if (ids.length === 0) return;
      const key = e.key;
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) return;
      e.preventDefault();

      const snapStep = tile / 2;
      let dx = 0, dy = 0;
      if (key === 'ArrowUp') dy = -snapStep;
      if (key === 'ArrowDown') dy = snapStep;
      if (key === 'ArrowLeft') dx = -snapStep;
      if (key === 'ArrowRight') dx = snapStep;

      for (const id of ids) {
        const el = elements.find(x => x.id === id);
        if (!el || el.locked) continue;
        if (onElementNudge) {
          onElementNudge(el.id, { x: el.x + dx, y: el.y + dy });
        } else {
          onElementPositionChange(el.id, { x: el.x + dx, y: el.y + dy });
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [elements, selectedElementIds, interactionMode, tile, stageScale, onElementPositionChange, onElementNudge]);

  // Attach transformer to selected nodes (supports multi-select)
  useEffect(() => {
    const tr = transformerRef.current;
    if (!tr) return;
    const nodes = (selectedElementIds ?? [])
      .filter(id => {
        if (id === 'generation-area') return false;
        const el = elements.find(e => e.id === id);
        return el && !el.locked && nodeRefs.current[id];
      })
      .map(id => nodeRefs.current[id]);
    tr.nodes(nodes);
    tr.getLayer()?.batchDraw();
  }, [selectedElementIds, elements]);

  const handleTransformStart = useCallback((id: string) => {
    onElementTransformStart?.(id);
  }, [onElementTransformStart]);

  const handleTransformMove = useCallback((id: string, next: { x: number; y: number; width: number; height: number; rotation?: number }) => {
    onElementTransformMove?.(id, next);
  }, [onElementTransformMove]);

  const handleTransformEnd = useCallback((id: string, finalRect: { x: number; y: number; width: number; height: number; rotation?: number }) => {
    const node = nodeRefs.current[id];
    if (!node) return;
    const scaleX = node.scaleX() || 1;
    const scaleY = node.scaleY() || 1;
    const el = elementsRef.current.find(e => e.id === id);
    const minSize = el?.type === 'sticky' ? STICKY_MIN_SIZE : MIN_ELEMENT_SIZE;
    const nextWidth = Math.max(minSize, node.width() * scaleX);
    const nextHeight = Math.max(minSize, node.height() * scaleY);
    let next: { x: number; y: number; width: number; height: number; rotation?: number; points?: number[] } = {
      x: node.x(),
      y: node.y(),
      width: nextWidth,
      height: nextHeight,
      rotation: node.rotation?.() ?? 0,
    };
    // Scale drawing points proportionally
    if (el?.type === 'drawing' && el.points) {
      next.points = el.points.map((val, i) => val * (i % 2 === 0 ? scaleX : scaleY));
    }
    node.scaleX(1);
    node.scaleY(1);
    if (snapEnabled) {
      const snapped = snapRect(next);
      next = { ...next, ...snapped };
    }
    onElementTransform?.(id, next);
    onElementTransformEnd?.(id, next);
  }, [onElementTransform, onElementTransformEnd, snapEnabled, snapRect]);

  // --- Marquee: start tracking on mousedown on empty space ---
  const startMarqueeTracking = useCallback((e: KonvaEventObject<MouseEvent>) => {
    if (interactionMode !== 'select') return;
    if ((e.evt as MouseEvent).button !== 0) return;

    const target = e.target as Konva.Node;
    const isStage = target?.getClassName?.() === 'Stage';
    const isGenArea = typeof target?.name === 'function' && target.name() === 'generation-area-bg';
    if (!isStage && !isGenArea) return;

    const stage = stageRef.current;
    const pointer = stage?.getPointerPosition();
    if (!pointer) return;

    const worldX = (pointer.x - stageXRef.current) / stageScaleRef.current;
    const worldY = (pointer.y - stageYRef.current) / stageScaleRef.current;
    marqueeStartRef.current = { worldX, worldY, screenX: e.evt.clientX, screenY: e.evt.clientY };
    marqueeTargetRef.current = isGenArea ? 'generation-area' : 'stage';
    marqueeRectRef.current = null;

    const handleMarqueeMove = (me: MouseEvent) => {
      const start = marqueeStartRef.current;
      if (!start) return;

      const dx = me.clientX - start.screenX;
      const dy = me.clientY - start.screenY;
      if (!marqueeRectRef.current && Math.sqrt(dx * dx + dy * dy) < MARQUEE_THRESHOLD) return;

      const stg = stageRef.current;
      if (!stg) return;
      const container = stg.container().getBoundingClientRect();
      const pointerX = me.clientX - container.left;
      const pointerY = me.clientY - container.top;
      const curWorldX = (pointerX - stageXRef.current) / stageScaleRef.current;
      const curWorldY = (pointerY - stageYRef.current) / stageScaleRef.current;

      const rect = {
        x: Math.min(start.worldX, curWorldX),
        y: Math.min(start.worldY, curWorldY),
        width: Math.abs(curWorldX - start.worldX),
        height: Math.abs(curWorldY - start.worldY),
      };
      marqueeRectRef.current = rect;
      setMarqueeRect(rect);
    };

    const removeListeners = () => {
      window.removeEventListener('mousemove', handleMarqueeMove);
      window.removeEventListener('mouseup', handleMarqueeUp);
      marqueeCleanupRef.current = null;
    };

    const handleMarqueeUp = (me: MouseEvent) => {
      removeListeners();

      const finalRect = marqueeRectRef.current;
      if (finalRect && (finalRect.width > 0 || finalRect.height > 0)) {
        // Marquee drag completed — select intersected elements
        const marquee = { x: finalRect.x, y: finalRect.y, w: finalRect.width, h: finalRect.height };
        const currentElements = elementsRef.current;
        const intersectedIds = currentElements
          .filter(el => el.visible)
          .filter(el => rectsIntersect(getElementAABB(el), marquee))
          .map(el => el.id);

        onMarqueeSelect?.(intersectedIds, me.shiftKey ? { shift: true } : undefined);
      } else {
        // No marquee (click) — deselect or select generation area
        if (marqueeTargetRef.current === 'generation-area') {
          onSelectElement('generation-area');
        } else {
          onSelectElement(null);
        }
      }

      marqueeStartRef.current = null;
      marqueeTargetRef.current = null;
      marqueeRectRef.current = null;
      setMarqueeRect(null);
    };

    marqueeCleanupRef.current = removeListeners;
    window.addEventListener('mousemove', handleMarqueeMove);
    window.addEventListener('mouseup', handleMarqueeUp);
  }, [interactionMode, onSelectElement, onMarqueeSelect]);

  // --- Brush drawing ---
  const startDrawing = useCallback((e: KonvaEventObject<MouseEvent>) => {
    if ((e.evt as MouseEvent).button !== 0) return;
    const stage = stageRef.current;
    const pointer = stage?.getPointerPosition();
    if (!pointer) return;

    const worldX = (pointer.x - stageXRef.current) / stageScaleRef.current;
    const worldY = (pointer.y - stageYRef.current) / stageScaleRef.current;
    const stroke = { startX: worldX, startY: worldY, points: [0, 0] };
    activeStrokeRef.current = stroke;
    setActiveStroke(stroke);

    let rafId: number | null = null;

    const handleDrawMove = (me: MouseEvent) => {
      const start = activeStrokeRef.current;
      if (!start) return;
      const stg = stageRef.current;
      if (!stg) return;
      const container = stg.container().getBoundingClientRect();
      const px = me.clientX - container.left;
      const py = me.clientY - container.top;
      const wx = (px - stageXRef.current) / stageScaleRef.current;
      const wy = (py - stageYRef.current) / stageScaleRef.current;
      start.points.push(wx - start.startX, wy - start.startY);
      if (rafId === null) {
        rafId = requestAnimationFrame(() => {
          rafId = null;
          setActiveStroke({ ...start, points: [...start.points] });
        });
      }
    };

    const handleDrawUp = () => {
      window.removeEventListener('mousemove', handleDrawMove);
      window.removeEventListener('mouseup', handleDrawUp);
      drawingCleanupRef.current = null;
      if (rafId !== null) cancelAnimationFrame(rafId);

      const current = activeStrokeRef.current;
      activeStrokeRef.current = null;
      setActiveStroke(null);

      if (!current || current.points.length < 4) return;

      // Compute bounding box and normalize points (iterative to avoid stack overflow on large strokes)
      const pts = current.points;
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (let i = 0; i < pts.length; i++) {
        if (i % 2 === 0) { if (pts[i] < minX) minX = pts[i]; if (pts[i] > maxX) maxX = pts[i]; }
        else { if (pts[i] < minY) minY = pts[i]; if (pts[i] > maxY) maxY = pts[i]; }
      }
      const w = Math.max(1, maxX - minX);
      const h = Math.max(1, maxY - minY);
      const normalizedPoints = pts.map((val, i) => val - (i % 2 === 0 ? minX : minY));

      const element: CanvasElementData = {
        id: crypto.randomUUID(),
        type: 'drawing',
        x: current.startX + minX,
        y: current.startY + minY,
        width: w,
        height: h,
        points: normalizedPoints,
        stroke: brushColorRef.current || '#000000',
        strokeWidth: brushSizeRef.current || 3,
        visible: true,
        locked: false,
      };
      onDrawingComplete?.(element);
    };

    const cleanup = () => {
      window.removeEventListener('mousemove', handleDrawMove);
      window.removeEventListener('mouseup', handleDrawUp);
    };
    drawingCleanupRef.current = cleanup;
    window.addEventListener('mousemove', handleDrawMove);
    window.addEventListener('mouseup', handleDrawUp);
  }, [onDrawingComplete]);

  // --- Element creation click (text / sticky) ---
  const handleCreationClick = useCallback((e: KonvaEventObject<MouseEvent>, callback?: (worldPos: { x: number; y: number }) => void) => {
    if ((e.evt as MouseEvent).button !== 0) return;
    const target = e.target as Konva.Node;
    const isStage = target?.getClassName?.() === 'Stage';
    const isGenArea = typeof target?.name === 'function' && target.name() === 'generation-area-bg';
    if (!isStage && !isGenArea) return;

    const stage = stageRef.current;
    const pointer = stage?.getPointerPosition();
    if (!pointer) return;
    const worldX = (pointer.x - stageXRef.current) / stageScaleRef.current;
    const worldY = (pointer.y - stageYRef.current) / stageScaleRef.current;
    callback?.({ x: worldX, y: worldY });
  }, []);

  // Cleanup drawing listeners on unmount
  useEffect(() => {
    return () => {
      drawingCleanupRef.current?.();
    };
  }, []);

  // Custom circle cursor for brush/eraser
  const brushCursor = useMemo(() => {
    if (interactionMode !== 'brush') {
      return ({ select: 'default', pan: 'grab', text: 'text', sticky: 'crosshair' } as Record<string, string>)[interactionMode] || 'default';
    }
    const diameter = Math.max(4, Math.min(128, (brushSize || 3) * stageScale));
    const r = diameter / 2;
    const strokeColor = (brushColor || '#000000').replace('#', '%23');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${diameter}" height="${diameter}"><circle cx="${r}" cy="${r}" r="${r - 0.5}" fill="none" stroke="${strokeColor}" stroke-width="1"/></svg>`;
    return `url('data:image/svg+xml,${svg}') ${r} ${r}, crosshair`;
  }, [interactionMode, brushSize, brushColor, stageScale]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ cursor: brushCursor }}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <Stage
        ref={stageRef}
        width={width}
        height={height}
        scaleX={stageScale}
        scaleY={stageScale}
        x={stageX}
        y={stageY}
        onWheel={handleWheel}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
        draggable={interactionMode === 'pan' || isPanning}
        onMouseDown={(e) => {
          handleMouseDown(e);
          if (interactionMode === 'select') startMarqueeTracking(e);
          else if (interactionMode === 'brush') startDrawing(e);
          else if (interactionMode === 'text') handleCreationClick(e, onTextCreate);
          else if (interactionMode === 'sticky') handleCreationClick(e, onStickyCreate);
        }}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        className="shadow-lg rounded-lg overflow-hidden"
      >
        {/* Content layer (used for export) */}
        <Layer ref={contentLayerRef}>
          {/* Generation area background fill */}
          <Rect
            name="generation-area-bg"
            x={generationAreaAligned.x}
            y={generationAreaAligned.y}
            width={generationAreaAligned.width}
            height={generationAreaAligned.height}
            fill={generationFillColor}
            onTap={() => { if (interactionMode === 'select') onSelectElement('generation-area'); }}
          />
          {renderGenerationGrid()}
          {/* Elements render (not clipped visually; export crops to area) */}
          {[...elements].slice().reverse().map((el) => {
            if (!el.visible) return null;
            const commonProps = {
              data: el,
              isSelected: (selectedElementIds ?? []).includes(el.id),
              draggable: interactionMode === 'select' && !el.locked,
              dragBoundFunc: snapEnabled ? (pos: { x: number; y: number }) => snapAbsolutePosition(pos) : undefined,
              onSelect: (e?: KonvaEventObject<MouseEvent>) => {
                const nativeEvt = e?.evt;
                const shift = nativeEvt?.shiftKey ?? false;
                const ctrl = nativeEvt?.ctrlKey ?? nativeEvt?.metaKey ?? false;
                onSelectElement(el.id, (shift || ctrl) ? { shift, ctrl } : undefined);
              },
              onDragStart: () => {
                const ids = selectedElementIds ?? [];
                if (!ids.includes(el.id)) {
                  onSelectElement(el.id);
                  onElementDragStart?.(el.id);
                } else if (ids.filter(id => id !== 'generation-area').length > 1) {
                  onMultiDragStart?.(ids.filter(id => id !== 'generation-area'));
                } else {
                  onElementDragStart?.(el.id);
                }
              },
              onDragEnd: (pos: { x: number; y: number }) => {
                const ids = (selectedElementIds ?? []).filter(id => id !== 'generation-area');
                if (ids.length > 1 && ids.includes(el.id)) {
                  const positions = ids
                    .map(id => {
                      const node = nodeRefs.current[id];
                      return node ? { id, x: node.x(), y: node.y() } : null;
                    })
                    .filter(Boolean) as { id: string; x: number; y: number }[];
                  onMultiDragEnd?.(positions);
                } else if (onElementDragEnd) {
                  const snappedPos = snapEnabled ? snapWorldPosition(pos) : pos;
                  onElementDragEnd(el.id, snappedPos);
                }
              },
              onDragMove: (pos: { x: number; y: number }) => onElementPositionChange(el.id, pos),
              onTransformStart: () => handleTransformStart(el.id),
              onTransformMove: (next: { x: number; y: number; width: number; height: number; rotation?: number }) => handleTransformMove(el.id, next),
              onTransformEnd: (finalRect: { x: number; y: number; width: number; height: number; rotation?: number }) => handleTransformEnd(el.id, finalRect),
              registerNodeRef: (node: Konva.Node | null) => { if (node) nodeRefs.current[el.id] = node; },
            };
            switch (el.type) {
              case 'image':
                return <CanvasImage key={el.id} {...commonProps} />;
              case 'drawing':
                return <CanvasDrawing key={el.id} {...commonProps} />;
              case 'text':
                return <CanvasText key={el.id} {...commonProps} onDoubleClick={() => onTextEdit?.(el.id)} isEditing={editingTextId === el.id} />;
              case 'sticky':
                return <CanvasSticky key={el.id} {...commonProps} onDoubleClick={() => onStickyEdit?.(el.id)} isEditing={editingTextId === el.id} />;
              default:
                return null;
            }
          })}
          {/* Active brush stroke (while drawing) */}
          {activeStroke && (
            <Line
              x={activeStroke.startX}
              y={activeStroke.startY}
              points={activeStroke.points}
              stroke={brushColor || '#000000'}
              strokeWidth={brushSize || 3}
              lineCap="round"
              lineJoin="round"
              tension={0.5}
              listening={false}
            />
          )}
        </Layer>
        {/* Overlay layer (not exported) */}
        <Layer ref={overlayLayerRef}>
          {/* Draw generation area border on top */}
          <Rect
            x={generationAreaAligned.x}
            y={generationAreaAligned.y}
            width={generationAreaAligned.width}
            height={generationAreaAligned.height}
            stroke={(selectedElementIds ?? []).includes('generation-area') ? themeColors.primary : themeColors.border}
            strokeWidth={(selectedElementIds ?? []).includes('generation-area') ? 1.5 : 1}
            shadowColor={themeColors.shadow}
            shadowOffset={{ x: 0, y: 1 }}
            listening={false}
          />
          {/* Generation area number badge */}
          <Group>
            <Circle
              x={generationAreaAligned.x + 2}
              y={generationAreaAligned.y + 2}
              radius={10}
              fill={themeColors.primary}
              listening={false}
            />
            <Text
              x={generationAreaAligned.x - 2}
              y={generationAreaAligned.y - 3}
              text={String(attachmentCount + 1)}
              fontSize={12}
              fontFamily="Inter"
              fill={themeColors.badgeText}
              align="center"
              verticalAlign="middle"
              listening={false}
            />
          </Group>
          {/* Marquee selection rectangle */}
          {marqueeRect && (
            <Group listening={false}>
              <Rect
                x={marqueeRect.x}
                y={marqueeRect.y}
                width={marqueeRect.width}
                height={marqueeRect.height}
                fill={themeColors.primary}
                opacity={isDarkMode ? 0.25 : 0.15}
                listening={false}
              />
              <Rect
                x={marqueeRect.x}
                y={marqueeRect.y}
                width={marqueeRect.width}
                height={marqueeRect.height}
                stroke={themeColors.primary}
                strokeWidth={1 / stageScale}
                listening={false}
              />
            </Group>
          )}
          {/* Selection transformer */}
          <SelectionTransformer
            transformerRef={transformerRef}
          />
        </Layer>
      </Stage>
    </div>
  );
});

Canvas.displayName = 'Canvas';

export default Canvas;
