import React, { useRef, useState, useCallback, forwardRef, useImperativeHandle, useEffect, useMemo } from 'react';
import { Stage, Layer, Rect, Group, Circle, Text } from 'react-konva';
import Konva from 'konva';
import { KonvaEventObject } from 'konva/lib/Node';
import CanvasImage from '@/components/canvas/CanvasImage';
import usePatternDots from '@/components/canvas/usePatternDots';
import GenerationGrid from '@/components/canvas/GenerationGrid';
import SelectionTransformer from '@/components/canvas/SelectionTransformer';
import { MIN_ELEMENT_SIZE } from '@/lib/canvasDefaults';
import { useCanvasSnapping } from '@/lib/useCanvasSnapping';
import { useTheme } from '@/lib/useTheme';

export interface CanvasElementData {
  id: string;
  type: 'image';
  src: string;
  name?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  originalWidth?: number; // Original image width
  originalHeight?: number; // Original image height
  // Slice properties for cropped images
  sliceX?: number; // X position in original image
  sliceY?: number; // Y position in original image
  sliceWidth?: number; // Width in original image
  sliceHeight?: number; // Height in original image
  visible: boolean;
  locked: boolean;
  rotation?: number;
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
  selectedElementId?: string | null;
  interactionMode: 'select' | 'pan';
  onSelectElement: (id: string | null) => void;
  onElementPositionChange: (id: string, position: { x: number; y: number }) => void;
  onElementTransform?: (id: string, next: { x: number; y: number; width: number; height: number; rotation?: number }) => void;
  onElementTransformStart?: (id: string) => void;
  onElementTransformMove?: (id: string, next: { x: number; y: number; width: number; height: number; rotation?: number }) => void;
  onElementTransformEnd?: (id: string, finalRect: { x: number; y: number; width: number; height: number; rotation?: number }) => void;
  onElementDragStart?: (id: string) => void;
  onElementDragEnd?: (id: string, pos: { x: number; y: number }) => void;
  onElementNudge?: (id: string, position: { x: number; y: number }) => void;
  snapEnabled?: boolean;
  
  // drag-n-drop
  onImageDrop?: (file: File, position: { x: number; y: number }) => void;
}

export interface CanvasRef {
  exportGenerationArea: () => string;
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
  fitToArea: () => void;
}

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
  selectedElementId,
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
  snapEnabled,
  onImageDrop,
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
  const { colors: themeColors } = useTheme();
  
  const { dataUrl: patternDataUrl, tile } = usePatternDots(themeColors.background);

  const { generationAreaAligned, snapWorldPosition, snapAbsolutePosition, snapRect } = useCanvasSnapping({
    generationArea,
    tile,
    stageX,
    stageY,
    stageScale,
  });

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
      if (!selectedElementId || selectedElementId === 'generation-area') return;
      const el = elements.find(x => x.id === selectedElementId);
      if (!el || el.locked) return;
      const key = e.key;
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) return;
      e.preventDefault();
      
      const snapStep = tile / 2;
      let dx = 0, dy = 0;
      if (key === 'ArrowUp') dy = -snapStep;
      if (key === 'ArrowDown') dy = snapStep;
      if (key === 'ArrowLeft') dx = -snapStep;
      if (key === 'ArrowRight') dx = snapStep;

      if (onElementNudge) {
        onElementNudge(el.id, { x: el.x + dx, y: el.y + dy });
      } else {
        onElementPositionChange(el.id, { x: el.x + dx, y: el.y + dy });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [elements, selectedElementId, interactionMode, tile, stageScale, onElementPositionChange, onElementNudge]);

  // Attach transformer to selected node
  useEffect(() => {
    const tr = transformerRef.current;
    if (!tr) return;
    if (selectedElementId && nodeRefs.current[selectedElementId]) {
      tr.nodes([nodeRefs.current[selectedElementId]]);
    } else {
      tr.nodes([]);
    }
    tr.getLayer()?.batchDraw();
  }, [selectedElementId, elements]);

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
    const nextWidth = Math.max(MIN_ELEMENT_SIZE, node.width() * scaleX);
    const nextHeight = Math.max(MIN_ELEMENT_SIZE, node.height() * scaleY);
    let next = {
      x: node.x(),
      y: node.y(),
      width: nextWidth,
      height: nextHeight,
      rotation: node.rotation?.() ?? 0,
    };
    node.scaleX(1);
    node.scaleY(1);
    if (snapEnabled) {
      const snapped = snapRect(next);
      next = { ...next, ...snapped };
    }
    onElementTransform?.(id, next);
    onElementTransformEnd?.(id, next);
  }, [onElementTransform, onElementTransformEnd, snapEnabled, snapRect]);

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full"
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
          // deselect when clicking empty space (only in select mode and left button)
          if (interactionMode === 'select' && (e.evt as MouseEvent).button === 0) {
            const target = e.target as Konva.Node;
            if (target && target.getClassName && target.getClassName() === 'Stage') {
              onSelectElement(null);
            }
          }
        }}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        className="shadow-lg rounded-lg overflow-hidden"
      >
        {/* Content layer (used for export) */}
        <Layer ref={contentLayerRef}>
          {/* Generation area background fill */}
          <Rect
            x={generationAreaAligned.x}
            y={generationAreaAligned.y}
            width={generationAreaAligned.width}
            height={generationAreaAligned.height}
            fill={generationFillColor}
            onClick={() => { if (interactionMode === 'select') onSelectElement('generation-area'); }}
            onTap={() => { if (interactionMode === 'select') onSelectElement('generation-area'); }}
          />
          {renderGenerationGrid()}
          {/* Elements render (not clipped visually; export crops to area) */}
          {[...elements].slice().reverse().map((el) => (
            el.visible ? (
              <CanvasImage
                key={el.id}
                data={el}
                isSelected={selectedElementId === el.id}
                draggable={interactionMode === 'select' && !el.locked}
                dragBoundFunc={snapEnabled ? (pos) => snapAbsolutePosition(pos) : undefined}
                onSelect={() => onSelectElement(el.id)}
                onDragStart={() => {
                  onSelectElement(el.id);
                  onElementDragStart?.(el.id);
                }}
                onDragEnd={(pos) => {
                  if (onElementDragEnd) {
                    const snappedPos = snapEnabled ? snapWorldPosition(pos) : pos;
                    onElementDragEnd(el.id, snappedPos);
                  }
                }}
                onDragMove={(pos) => onElementPositionChange(el.id, pos)}
                onTransformStart={() => handleTransformStart(el.id)}
                onTransformMove={(next) => handleTransformMove(el.id, next)}
                onTransformEnd={(finalRect) => handleTransformEnd(el.id, finalRect)}
                registerNodeRef={(node) => { if (node) nodeRefs.current[el.id] = node; }}
              />
            ) : null
          ))}
        </Layer>
        {/* Overlay layer (not exported) */}
        <Layer ref={overlayLayerRef}>
          {/* Draw generation area border on top */}
          <Rect
            x={generationAreaAligned.x}
            y={generationAreaAligned.y}
            width={generationAreaAligned.width}
            height={generationAreaAligned.height}
            stroke={selectedElementId === 'generation-area' ? themeColors.primary : themeColors.border}
            strokeWidth={selectedElementId === 'generation-area' ? 1.5 : 1}
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
              fontFamily="Arial"
              fill={themeColors.badgeText}
              align="center"
              verticalAlign="middle"
              listening={false}
            />
          </Group>
          {/* Single selection transformer */}
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
