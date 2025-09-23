import React from 'react';
import { Button } from '@/components/ui/button';

interface CanvasBottomZoomProps {
  onZoomOut: () => void;
  onReset: () => void;
  onZoomIn: () => void;
  onFit: () => void;
}

const CanvasBottomZoom: React.FC<CanvasBottomZoomProps> = ({ onZoomOut, onReset, onZoomIn, onFit }) => {
  return (
    <div className="fixed left-1/2 -translate-x-1/2 bottom-28 flex items-center gap-1.5 canvas-toolbar backdrop-blur shadow-sm rounded-md px-1.5 py-1 z-50">
      <Button variant="ghost" size="sm" onClick={onZoomOut}>−</Button>
      <Button variant="ghost" size="sm" onClick={onReset}>100%</Button>
      <Button variant="ghost" size="sm" onClick={onZoomIn}>+</Button>
      <div className="w-px h-4 bg-border" />
      <Button variant="ghost" size="sm" onClick={onFit}>Fit</Button>
    </div>
  );
};

export default CanvasBottomZoom;

