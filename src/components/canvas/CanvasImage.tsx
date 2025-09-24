import React, { useEffect, useState } from 'react';
import { Image as KonvaImage, Rect } from 'react-konva';
import Konva from 'konva';
import type { CanvasElementData } from '@/components/Canvas';

interface CanvasImageProps {
  data: CanvasElementData;
  isSelected: boolean;
  draggable: boolean;
  onSelect: () => void;
  onDragStart?: () => void;
  onDragEnd: (pos: { x: number; y: number }) => void;
  onDragMove?: (pos: { x: number; y: number }) => void;
  onTransformStart?: () => void;
  onTransformMove?: (pos: { x: number; y: number; width: number; height: number; rotation?: number }) => void;
  onTransformEnd: (finalRect: { x: number; y: number; width: number; height: number; rotation?: number }) => void;
  registerNodeRef: (node: Konva.Node | null) => void;
  dragBoundFunc?: (pos: { x: number; y: number }) => { x: number; y: number };
}

export default function CanvasImage(props: CanvasImageProps) {
  const { data, isSelected, draggable, onSelect, onDragStart, onDragEnd, onDragMove, onTransformStart, onTransformMove, onTransformEnd, registerNodeRef, dragBoundFunc } = props;
  const image = useHTMLImage(data.src) as HTMLImageElement | null;
  
  // Check if this is a slice (has slice coordinates)
  const isSlice = data.sliceX !== undefined && data.sliceY !== undefined && data.sliceWidth !== undefined && data.sliceHeight !== undefined;
  
  return (
    <>
      <KonvaImage
        ref={registerNodeRef}
        image={image || undefined}
        x={data.x}
        y={data.y}
        width={data.width}
        height={data.height}
        rotation={data.rotation || 0}
        draggable={draggable}
        dragBoundFunc={dragBoundFunc}
        onClick={onSelect}
        onTap={onSelect}
        onDragStart={(e) => { e.cancelBubble = true; onDragStart?.(); }}
        onDragMove={(e) => { e.cancelBubble = true; onDragMove?.({ x: e.target.x(), y: e.target.y() }); }}
        onDragEnd={(e) => { e.cancelBubble = true; onDragEnd({ x: e.target.x(), y: e.target.y() }); }}
        onTransformStart={(e) => { e.cancelBubble = true; onTransformStart?.(); }}
        onTransform={(e) => { 
          e.cancelBubble = true; 
          const node = e.target;
          const scaleX = node.scaleX() || 1;
          const scaleY = node.scaleY() || 1;
          onTransformMove?.({
            x: node.x(),
            y: node.y(),
            width: Math.max(1, node.width() * scaleX),
            height: Math.max(1, node.height() * scaleY),
            rotation: node.rotation?.() ?? 0,
          });
        }}
        onTransformEnd={(e) => {
          e.cancelBubble = true;
          const node = e.target;
          const scaleX = node.scaleX() || 1;
          const scaleY = node.scaleY() || 1;
          onTransformEnd({
            x: node.x(),
            y: node.y(),
            width: Math.max(1, node.width() * scaleX),
            height: Math.max(1, node.height() * scaleY),
            rotation: node.rotation?.() ?? 0,
          });
        }}
        listening={true}
        // Crop properties for slices
        crop={isSlice ? {
          x: data.sliceX!,
          y: data.sliceY!,
          width: data.sliceWidth!,
          height: data.sliceHeight!,
        } : undefined}
        cropX={isSlice ? data.sliceX! : undefined}
        cropY={isSlice ? data.sliceY! : undefined}
        cropWidth={isSlice ? data.sliceWidth! : undefined}
        cropHeight={isSlice ? data.sliceHeight! : undefined}
      />
    </>
  );
}

function useHTMLImage(src?: string) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!src) { setImg(null); return; }
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => setImg(image);
    image.src = src;
    return () => { setImg(null); };
  }, [src]);
  return img;
}


