import { useMemo, useState, useEffect } from 'react';
import type { BackgroundPattern } from '@/lib/types';

function resolveThemeColor(cssVar: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim() || fallback;
  const probe = document.createElement('span');
  probe.style.color = raw;
  document.body.appendChild(probe);
  const resolved = getComputedStyle(probe).color || fallback;
  probe.remove();
  return resolved;
}

function resolveThemeBgColor(cssVar: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim() || fallback;
  const probe = document.createElement('span');
  probe.style.backgroundColor = raw;
  document.body.appendChild(probe);
  const resolved = getComputedStyle(probe).backgroundColor || fallback;
  probe.remove();
  return resolved;
}

type PatternPainter = (ctx: CanvasRenderingContext2D, w: number, h: number, color: string, ratio: number) => void;

// Crisp pixel-perfect dots — use fillRect instead of arc to avoid anti-aliasing blur
const paintDots: PatternPainter = (ctx, w, _h, color, ratio) => {
  ctx.fillStyle = color;
  // Disable anti-aliasing for sharp pixels
  ctx.imageSmoothingEnabled = false;
  const half = w / 2;
  const dotSize = 1 * ratio;
  // Draw directly in pixel space for maximum crispness
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0); // reset to identity (pixel coordinates)
  const positions = [0, half * ratio];
  for (const x of positions) {
    for (const y of positions) {
      ctx.fillRect(Math.round(x), Math.round(y), dotSize, dotSize);
    }
  }
  ctx.restore();
};

const paintGrid: PatternPainter = (ctx, w, h, color, ratio) => {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = color;
  const lineW = Math.max(1, Math.round(0.5 * ratio));
  // horizontal line at top
  ctx.fillRect(0, 0, Math.round(w * ratio), lineW);
  // vertical line at left
  ctx.fillRect(0, 0, lineW, Math.round(h * ratio));
  ctx.restore();
};

const paintCross: PatternPainter = (ctx, w, h, color, ratio) => {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = color;
  const cx = Math.round((w / 2) * ratio);
  const cy = Math.round((h / 2) * ratio);
  const arm = Math.round(2.5 * ratio);
  const lineW = Math.max(1, Math.round(0.75 * ratio));
  // horizontal arm
  ctx.fillRect(cx - arm, cy, arm * 2 + lineW, lineW);
  // vertical arm
  ctx.fillRect(cx, cy - arm, lineW, arm * 2 + lineW);
  ctx.restore();
};

// Hierarchical grid: crosses at cell corners, dots at intermediate snap points.
// Tile = one full cell. Crosses at all 4 corners (they merge with adjacent tiles).
// Dots at half-step positions in between.
const paintCrossDot: PatternPainter = (ctx, w, h, color, ratio) => {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = color;

  const arm = Math.round(2 * ratio);
  const lineW = Math.max(1, Math.round(0.75 * ratio));
  const dotSize = Math.max(1, Math.round(1 * ratio));
  const W = Math.round(w * ratio);
  const H = Math.round(h * ratio);
  const halfW = Math.round((w / 2) * ratio);
  const halfH = Math.round((h / 2) * ratio);

  // Crosses at all 4 corners — clipped parts will be completed by adjacent tiles
  for (const cx of [0, W]) {
    for (const cy of [0, H]) {
      ctx.fillRect(cx - arm, cy, arm * 2 + lineW, lineW);
      ctx.fillRect(cx, cy - arm, lineW, arm * 2 + lineW);
    }
  }

  // Dots at intermediate snap positions (edges + center)
  const dotPositions = [
    [halfW, 0],     // top edge mid
    [0, halfH],     // left edge mid
    [halfW, halfH], // center
    [W, halfH],     // right edge mid
    [halfW, H],     // bottom edge mid
  ];
  for (const [dx, dy] of dotPositions) {
    ctx.fillRect(dx, dy, dotSize, dotSize);
  }

  ctx.restore();
};

const paintIsometric: PatternPainter = (ctx, w, h, color, _ratio) => {
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.75;
  const hw = w / 2;
  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.lineTo(hw, 0);
  ctx.lineTo(w, h);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.lineTo(hw, h * 2);
  ctx.moveTo(w, h);
  ctx.lineTo(hw, h * 2);
  ctx.stroke();
};

const PATTERN_CONFIG: Record<BackgroundPattern, { w: number; h: number; paint: PatternPainter | null }> = {
  none: { w: 32, h: 32, paint: null },
  dots: { w: 24, h: 24, paint: paintDots },
  grid: { w: 32, h: 32, paint: paintGrid },
  cross: { w: 28, h: 28, paint: paintCross },
  crossDot: { w: 28, h: 28, paint: paintCrossDot },
  isometric: { w: 56, h: 28, paint: paintIsometric },
};

export default function useCanvasPattern(patternType: BackgroundPattern, backgroundColor: string) {
  const [themeClass, setThemeClass] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const updateTheme = () => setThemeClass(document.documentElement.className);
    updateTheme();
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const result = useMemo(() => {
    const config = PATTERN_CONFIG[patternType];
    if (!config.paint) {
      return { dataUrl: '', tileWidth: config.w, tileHeight: config.h };
    }

    const ratio = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
    if (!canvas) return { dataUrl: '', tileWidth: config.w, tileHeight: config.h };

    canvas.width = config.w * ratio;
    canvas.height = config.h * ratio;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { dataUrl: '', tileWidth: config.w, tileHeight: config.h };

    // Disable smoothing globally for crisp rendering
    ctx.imageSmoothingEnabled = false;
    ctx.scale(ratio, ratio);

    const themeBg = resolveThemeBgColor('--canvas-background', backgroundColor);
    ctx.fillStyle = themeBg;
    ctx.fillRect(0, 0, config.w, config.h);

    const dotColor = resolveThemeColor('--canvas-dots', '#e5e7eb');
    config.paint(ctx, config.w, config.h, dotColor, ratio);

    return { dataUrl: canvas.toDataURL(), tileWidth: config.w, tileHeight: config.h };
  }, [patternType, backgroundColor, themeClass]);

  return result;
}
