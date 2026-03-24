import React, { useRef, useState, useCallback, useEffect } from 'react';
import { MousePointer, Hand, Pen, Type, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { InteractionMode } from '@/components/Canvas';

interface CanvasLeftToolbarProps {
  interactionMode: InteractionMode;
  setInteractionMode: (mode: InteractionMode) => void;
  color: string;
  onColorChange: (color: string) => void;
  size: number;
  onSizeChange: (size: number) => void;
}

const tools: { mode: InteractionMode; icon: React.ElementType; label: string; hotkey: string }[] = [
  { mode: 'select', icon: MousePointer, label: 'Select', hotkey: 'V' },
  { mode: 'pan', icon: Hand, label: 'Pan', hotkey: 'H' },
];

const drawTools: { mode: InteractionMode; icon: React.ElementType; label: string; hotkey: string }[] = [
  { mode: 'brush', icon: Pen, label: 'Brush', hotkey: 'B' },
  { mode: 'text', icon: Type, label: 'Text', hotkey: 'T' },
];

const CanvasLeftToolbar: React.FC<CanvasLeftToolbarProps> = ({
  interactionMode,
  setInteractionMode,
  color,
  onColorChange,
  size,
  onSizeChange,
}) => {
  const colorInputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const showControls = interactionMode === 'brush' || interactionMode === 'text';

  const [pos, setPos] = useState({ x: 12, y: 56 });
  const [dragging, setDragging] = useState(false);
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
        <GripVertical size={14} />
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
      {showControls && (
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
              min={1}
              max={50}
              value={size}
              onChange={(e) => onSizeChange(Number(e.target.value))}
              className="w-6 accent-primary"
              style={{ writingMode: 'vertical-lr', direction: 'rtl', height: '64px' }}
            />
            <span className="text-[10px] text-muted-foreground">{size}</span>
          </div>
        </>
      )}
    </div>
  );
};

export default CanvasLeftToolbar;
