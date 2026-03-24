import React, { useRef, useState, useCallback, useEffect } from 'react';
import { MousePointer, Hand, Pen, Type, StickyNote, GripHorizontal, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { InteractionMode, ShapeType } from '@/components/Canvas';
import { STICKY_COLORS } from '@/lib/canvasDefaults';

interface CanvasLeftToolbarProps {
  interactionMode: InteractionMode;
  setInteractionMode: (mode: InteractionMode) => void;
  color: string;
  onColorChange: (color: string) => void;
  size: number;
  onSizeChange: (size: number) => void;
  sizeMin?: number;
  sizeMax?: number;
  stickyColor?: string;
  onStickyColorChange?: (color: string) => void;
  stickyShape?: 'square' | 'horizontal';
  onStickyShapeChange?: (shape: 'square' | 'horizontal') => void;
  shapeType?: ShapeType;
  onShapeTypeChange?: (shape: ShapeType) => void;
  shapeBgColor?: string;
  onShapeBgColorChange?: (color: string) => void;
  shapeBorderColor?: string;
  onShapeBorderColorChange?: (color: string) => void;
}

const tools: { mode: InteractionMode; icon: React.ElementType; label: string; hotkey: string }[] = [
  { mode: 'select', icon: MousePointer, label: 'Select', hotkey: 'V' },
  { mode: 'pan', icon: Hand, label: 'Pan', hotkey: 'H' },
];

const drawTools: { mode: InteractionMode; icon: React.ElementType; label: string; hotkey: string }[] = [
  { mode: 'brush', icon: Pen, label: 'Brush', hotkey: 'B' },
  { mode: 'text', icon: Type, label: 'Text', hotkey: 'T' },
  { mode: 'sticky', icon: StickyNote, label: 'Sticky Note', hotkey: 'S' },
];

const shapeIcons: Record<ShapeType, { svg: React.ReactNode; label: string }> = {
  rectangle: {
    label: 'Rectangle',
    svg: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="1" y="2" width="12" height="10" />
      </svg>
    ),
  },
  roundedRect: {
    label: 'Rounded Rect',
    svg: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="1" y="2" width="12" height="10" rx="3" />
      </svg>
    ),
  },
  ellipse: {
    label: 'Ellipse',
    svg: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
        <ellipse cx="7" cy="7" rx="6" ry="5" />
      </svg>
    ),
  },
  diamond: {
    label: 'Diamond',
    svg: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
        <polygon points="7,1 13,7 7,13 1,7" />
      </svg>
    ),
  },
  triangle: {
    label: 'Triangle',
    svg: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
        <polygon points="7,1 13,13 1,13" />
      </svg>
    ),
  },
};

const shapeTypeList: ShapeType[] = ['rectangle', 'roundedRect', 'ellipse', 'diamond', 'triangle'];

const CanvasLeftToolbar: React.FC<CanvasLeftToolbarProps> = ({
  interactionMode,
  setInteractionMode,
  color,
  onColorChange,
  size,
  onSizeChange,
  sizeMin = 1,
  sizeMax = 50,
  stickyColor = '#FEF08A',
  onStickyColorChange,
  stickyShape = 'square',
  onStickyShapeChange,
  shapeType = 'rectangle',
  onShapeTypeChange,
  shapeBgColor = '#ffffff',
  onShapeBgColorChange,
  shapeBorderColor = '#374151',
  onShapeBorderColorChange,
}) => {
  const colorInputRef = useRef<HTMLInputElement>(null);
  const shapeBgInputRef = useRef<HTMLInputElement>(null);
  const shapeBorderInputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const showBrushTextControls = interactionMode === 'brush' || interactionMode === 'text';
  const showStickyControls = interactionMode === 'sticky';
  const showShapeControls = interactionMode === 'shape';

  const [pos, setPos] = useState({ x: 12, y: 68 });
  const [dragging, setDragging] = useState(false);
  const [shapeDropdownOpen, setShapeDropdownOpen] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(true);
    dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
  }, [pos]);

  useEffect(() => {
    if (!dragging) return;
    const handleMove = (e: MouseEvent) => {
      const nx = e.clientX - dragOffset.current.x;
      const ny = e.clientY - dragOffset.current.y;
      const pad = 8;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const rect = panelRef.current?.getBoundingClientRect();
      const pw = rect?.width ?? 40;
      const ph = rect?.height ?? 200;
      setPos({
        x: Math.min(Math.max(pad, nx), vw - pw - pad),
        y: Math.min(Math.max(pad, ny), vh - ph - pad),
      });
    };
    const handleUp = () => setDragging(false);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [dragging]);

  // Close shape dropdown on outside click
  useEffect(() => {
    if (!shapeDropdownOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setShapeDropdownOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClick);
    return () => window.removeEventListener('mousedown', handleClick);
  }, [shapeDropdownOpen]);

  return (
    <div
      ref={panelRef}
      className="absolute z-10 flex flex-col items-center gap-1 canvas-toolbar backdrop-blur shadow-sm rounded-md px-1 py-1.5"
      style={{ left: pos.x, top: pos.y }}
    >
      {/* Drag handle */}
      <div
        className="w-8 h-5 flex items-center justify-center cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
        onMouseDown={handleMouseDown}
        title="Drag to move"
      >
        <GripHorizontal size={14} />
      </div>
      <div className="w-5 h-px bg-border my-0.5" />
      {tools.map((t) => (
        <Button
          key={t.mode}
          variant={interactionMode === t.mode ? 'default' : 'ghost'}
          size="icon"
          className="w-8 h-8"
          onClick={() => setInteractionMode(t.mode)}
          title={`${t.label} (${t.hotkey})`}
        >
          <t.icon size={16} />
        </Button>
      ))}
      <div className="w-5 h-px bg-border my-0.5" />
      {drawTools.map((t) => (
        <Button
          key={t.mode}
          variant={interactionMode === t.mode ? 'default' : 'ghost'}
          size="icon"
          className="w-8 h-8"
          onClick={() => setInteractionMode(t.mode)}
          title={`${t.label} (${t.hotkey})`}
        >
          <t.icon size={16} />
        </Button>
      ))}
      {/* Shape tool with dropdown */}
      <div className="relative">
        <Button
          variant={interactionMode === 'shape' ? 'default' : 'ghost'}
          size="icon"
          className="w-8 h-8"
          onClick={() => setInteractionMode('shape')}
          title={`${shapeIcons[shapeType].label} (R)`}
        >
          {shapeIcons[shapeType].svg}
        </Button>
        <button
          className="absolute -right-0.5 -bottom-0.5 w-3 h-3 flex items-center justify-center rounded-sm bg-background border border-border text-muted-foreground hover:text-foreground"
          onClick={(e) => { e.stopPropagation(); setShapeDropdownOpen(!shapeDropdownOpen); }}
        >
          <ChevronDown size={8} />
        </button>
        {shapeDropdownOpen && (
          <div className="absolute left-full top-0 ml-1 canvas-toolbar backdrop-blur shadow-md rounded-md p-1 flex flex-col gap-0.5 z-20">
            {shapeTypeList.map((st) => (
              <button
                key={st}
                className={`flex items-center gap-2 px-2 py-1 rounded text-xs whitespace-nowrap hover:bg-accent/50 ${shapeType === st ? 'bg-accent text-accent-foreground' : ''}`}
                onClick={() => {
                  onShapeTypeChange?.(st);
                  setInteractionMode('shape');
                  setShapeDropdownOpen(false);
                }}
              >
                {shapeIcons[st].svg}
                <span>{shapeIcons[st].label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {showBrushTextControls && (
        <>
          <div className="w-5 h-px bg-border my-0.5" />
          {/* Color picker */}
          <button
            className="w-6 h-6 rounded-md border border-border cursor-pointer hover:ring-1 hover:ring-primary transition-shadow"
            style={{ backgroundColor: color }}
            onClick={() => colorInputRef.current?.click()}
            title="Color"
          />
          <input
            ref={colorInputRef}
            type="color"
            value={color}
            onChange={(e) => onColorChange(e.target.value)}
            className="sr-only"
          />
          {/* Size slider */}
          <div className="flex flex-col items-center gap-0.5 mt-0.5" title={`Size: ${size}`}>
            <input
              type="range"
              min={sizeMin}
              max={sizeMax}
              value={size}
              onChange={(e) => onSizeChange(Number(e.target.value))}
              className="w-6 accent-primary"
              style={{ writingMode: 'vertical-lr', direction: 'rtl', height: '64px' }}
            />
            <span className="text-[10px] text-muted-foreground">{size}</span>
          </div>
        </>
      )}
      {showStickyControls && (
        <>
          <div className="w-5 h-px bg-border my-0.5" />
          {/* Shape selector */}
          <div className="flex flex-col items-center gap-1">
            <button
              className={`w-7 h-7 rounded border border-border flex items-center justify-center transition-shadow ${stickyShape === 'square' ? 'ring-2 ring-primary bg-accent' : 'hover:bg-accent/50'}`}
              onClick={() => onStickyShapeChange?.('square')}
              title="Square"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="1" y="1" width="12" height="12" rx="1.5" />
              </svg>
            </button>
            <button
              className={`w-7 h-7 rounded border border-border flex items-center justify-center transition-shadow ${stickyShape === 'horizontal' ? 'ring-2 ring-primary bg-accent' : 'hover:bg-accent/50'}`}
              onClick={() => onStickyShapeChange?.('horizontal')}
              title="Horizontal"
            >
              <svg width="16" height="10" viewBox="0 0 16 10" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="1" y="1" width="14" height="8" rx="1.5" />
              </svg>
            </button>
          </div>
          <div className="w-5 h-px bg-border my-0.5" />
          {/* Color swatches */}
          <div className="flex flex-col items-center gap-1">
            {STICKY_COLORS.map((c) => (
              <button
                key={c.hex}
                className={`w-5 h-5 rounded-sm border border-border/50 cursor-pointer transition-shadow ${stickyColor === c.hex ? 'ring-2 ring-primary ring-offset-1' : 'hover:ring-1 hover:ring-primary'}`}
                style={{ backgroundColor: c.hex }}
                onClick={() => onStickyColorChange?.(c.hex)}
                title={c.name}
              />
            ))}
          </div>
        </>
      )}
      {showShapeControls && (
        <>
          <div className="w-5 h-px bg-border my-0.5" />
          {/* Fill color */}
          <div className="flex flex-col items-center gap-1">
            <span className="text-[9px] text-muted-foreground">Fill</span>
            <button
              className="w-6 h-6 rounded-md border border-border cursor-pointer hover:ring-1 hover:ring-primary transition-shadow"
              style={{ backgroundColor: shapeBgColor }}
              onClick={() => shapeBgInputRef.current?.click()}
              title="Fill Color"
            />
            <input
              ref={shapeBgInputRef}
              type="color"
              value={shapeBgColor}
              onChange={(e) => onShapeBgColorChange?.(e.target.value)}
              className="sr-only"
            />
          </div>
          {/* Border color */}
          <div className="flex flex-col items-center gap-1">
            <span className="text-[9px] text-muted-foreground">Border</span>
            <button
              className="w-6 h-6 rounded-md border-2 cursor-pointer hover:ring-1 hover:ring-primary transition-shadow"
              style={{ borderColor: shapeBorderColor, backgroundColor: 'transparent' }}
              onClick={() => shapeBorderInputRef.current?.click()}
              title="Border Color"
            />
            <input
              ref={shapeBorderInputRef}
              type="color"
              value={shapeBorderColor}
              onChange={(e) => onShapeBorderColorChange?.(e.target.value)}
              className="sr-only"
            />
          </div>
        </>
      )}
    </div>
  );
};

export default CanvasLeftToolbar;
