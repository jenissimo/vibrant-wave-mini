import { useEffect, useMemo, useRef, useState } from 'react';
import type { DocSettings } from '@/lib/types';

export function useCanvasLayout() {
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [isCanvasReady, setIsCanvasReady] = useState(false);
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = canvasContainerRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      const width = el.clientWidth || rect.width;
      const height = el.clientHeight || rect.height;
      const newSize = { width: Math.max(0, Math.floor(width)), height: Math.max(0, Math.floor(height)) };
      if (newSize.width > 0 && newSize.height > 0) {
        setCanvasSize(newSize);
        setIsCanvasReady(true);
      }
    };
    const timeoutId = setTimeout(update, 0);
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => {
        clearTimeout(timeoutId);
        setTimeout(update, 16);
      });
      ro.observe(el);
      return () => { clearTimeout(timeoutId); ro.disconnect(); };
    } else {
      const handleResize = () => { clearTimeout(timeoutId); setTimeout(update, 16); };
      window.addEventListener('resize', handleResize);
      return () => { clearTimeout(timeoutId); window.removeEventListener('resize', handleResize); };
    }
  }, []);

  return { canvasContainerRef, canvasSize, isCanvasReady } as const;
}

export function useGenerationArea(settings: DocSettings, canvasSize: { width: number; height: number }) {
  return useMemo(() => {
    const [widthRatio, heightRatio] = settings.aspectRatio.split(':').map(Number);
    const totalPixels = 1024 * 1024;
    const aspectRatio = widthRatio / heightRatio;
    const zoneHeight = Math.sqrt(totalPixels / aspectRatio);
    const zoneWidth = zoneHeight * aspectRatio;
    // Center the generation area
    const x = 0; // The generation area now defines the origin of our coordinate system.
    const y = 0; // The canvas viewport will be panned to center it visually.
    return { x, y, width: zoneWidth, height: zoneHeight };
  }, [settings.aspectRatio, canvasSize]);
}


