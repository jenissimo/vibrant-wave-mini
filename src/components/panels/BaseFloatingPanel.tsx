import React from 'react';
import { settingsStore } from '@/lib/settingsStore';

interface BaseFloatingPanelProps {
  title: string;
  children: React.ReactNode;
  headerRight?: React.ReactNode;
  initialPosition?: { x: number; y: number };
  className?: string;
  storageKey?: string; // persist position as viewport percentages
  panelWidth?: number; // explicit width in px
}

const BaseFloatingPanel: React.FC<BaseFloatingPanelProps> = ({ title, children, headerRight, initialPosition, className, storageKey, panelWidth }) => {
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  // Avoid hydration mismatch: keep x stable (0) for SSR/first client render.
  // Apply window-dependent x via effects after mount.
  const [pos, setPos] = React.useState<{ x: number; y: number }>(() => ({ x: 0, y: initialPosition?.y ?? 0 }));
  const [dragging, setDragging] = React.useState(false);
  const dragOffset = React.useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const parentRectRef = React.useRef<{ left: number; top: number }>({ left: 0, top: 0 });
  const percentRef = React.useRef<{ xPct: number; yPct: number } | null>(null);

  // Clamp within viewport
  const clampToViewport = React.useCallback((x: number, y: number) => {
    const vw = typeof window !== 'undefined' ? window.innerWidth : 0;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 0;
    const rect = panelRef.current?.getBoundingClientRect();
    const pad = 8;
    const maxX = Math.max(0, vw - (rect?.width || 0) - pad);
    const maxY = Math.max(0, vh - (rect?.height || 0) - pad);
    return { x: Math.min(Math.max(pad, x), maxX), y: Math.min(Math.max(pad, y), maxY) };
  }, []);

  const onMouseDownHeader = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = panelRef.current?.getBoundingClientRect();
    if (!rect) return;
    const parentRect = (panelRef.current?.offsetParent as HTMLElement | null)?.getBoundingClientRect?.();
    parentRectRef.current = { left: parentRect?.left || 0, top: parentRect?.top || 0 };
    setDragging(true);
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    e.preventDefault();
  };

  React.useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      const parentLeft = parentRectRef.current.left;
      const parentTop = parentRectRef.current.top;
      const next = {
        x: e.clientX - parentLeft - dragOffset.current.x,
        y: e.clientY - parentTop - dragOffset.current.y,
      };
      const clamped = clampToViewport(next.x, next.y);
      setPos(clamped);
    };
    const onUp = () => {
      setDragging(false);
      if (storageKey) {
        const vw = window.innerWidth || 1;
        const vh = window.innerHeight || 1;
        const xPct = (pos.x / vw) * 100;
        const yPct = (pos.y / vh) * 100;
        percentRef.current = { xPct, yPct };
        settingsStore.setPanelPosition(storageKey, { xPct, yPct });
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging, clampToViewport, pos.x, pos.y, storageKey]);

  // Load persisted position
  React.useEffect(() => {
    if (!storageKey) return;
    const saved = settingsStore.getState().settings.panelPositions[storageKey];
    if (saved) {
      percentRef.current = saved;
      const vw = window.innerWidth || 1;
      const vh = window.innerHeight || 1;
      const px = clampToViewport((saved.xPct / 100) * vw, (saved.yPct / 100) * vh);
      setPos(px);
      return;
    }
    if (initialPosition) {
      const vw = window.innerWidth || 1;
      const vh = window.innerHeight || 1;
      const xPct = (initialPosition.x / vw) * 100;
      const yPct = (initialPosition.y / vh) * 100;
      percentRef.current = { xPct, yPct };
      if (storageKey) settingsStore.setPanelPosition(storageKey, { xPct, yPct });
      setPos(clampToViewport(initialPosition.x, initialPosition.y));
    }
  }, [storageKey, initialPosition, clampToViewport]);

  // Reposition on resize using saved percents
  React.useEffect(() => {
    if (!storageKey) return;
    const onResize = () => {
      const perc = percentRef.current;
      if (!perc) return;
      const vw = window.innerWidth || 1;
      const vh = window.innerHeight || 1;
      const px = clampToViewport((perc.xPct / 100) * vw, (perc.yPct / 100) * vh);
      setPos(px);
    };
    window.addEventListener('resize', onResize);
    const unsub = settingsStore.subscribe((state) => {
      const p = state.settings.panelPositions[storageKey];
      if (p) {
        percentRef.current = p;
        onResize();
      }
    });
    return () => { window.removeEventListener('resize', onResize); unsub(); };
  }, [storageKey, clampToViewport]);

  return (
    <div
      ref={panelRef}
      className={`absolute z-10 ${className || ''}`}
      style={{ left: pos.x, top: pos.y, width: panelWidth !== undefined ? panelWidth : undefined }}
    >
      <div className="bg-background/90 backdrop-blur border border-border shadow-sm rounded-md overflow-hidden">
        <div
          className="px-3 py-2 text-xs text-foreground border-b bg-background/70 flex items-center justify-between cursor-move select-none"
          onMouseDown={onMouseDownHeader}
        >
          <div className="font-medium">{title}</div>
          <div className="flex items-center gap-1">{headerRight}</div>
        </div>
        <div className="p-2">
          {children}
        </div>
      </div>
    </div>
  );
};

export default BaseFloatingPanel;


