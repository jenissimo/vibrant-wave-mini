import React from 'react';
import { Line } from 'react-konva';

interface Props {
  enabled: boolean;
  area: { x: number; y: number; width: number; height: number };
  cols: number;
  rows: number;
  color: string;
  thickness: number;
}

export default function GenerationGrid({ enabled, area, cols, rows, color, thickness }: Props) {
  if (!enabled) return null;
  const lines: React.ReactNode[] = [];
  const gx = area.x;
  const gy = area.y;
  const gw = area.width;
  const gh = area.height;
  
  // Use theme color if no custom color provided
  const gridColor = color || 'var(--canvas-grid)';

  const c = Math.max(1, cols);
  const r = Math.max(1, rows);
  const stepX = gw / c;
  const stepY = gh / r;
  for (let i = 0; i <= c; i++) {
    const x = gx + i * stepX;
    lines.push(
      <Line key={`gv-${i}`} points={[x, gy, x, gy + gh]} stroke={gridColor} strokeWidth={thickness} listening={false} />
    );
  }
  for (let j = 0; j <= r; j++) {
    const y = gy + j * stepY;
    lines.push(
      <Line key={`gh-${j}`} points={[gx, y, gx + gw, y]} stroke={gridColor} strokeWidth={thickness} listening={false} />
    );
  }
  return <>{lines}</>;
}


