import { useMemo } from 'react';
import type Konva from 'konva';
import { KonvaEventObject } from 'konva/lib/Node';
import type { CanvasElementData } from '@/components/Canvas';

export interface CanvasElementEventProps {
  data: CanvasElementData;
  isSelected: boolean;
  draggable: boolean;
  onSelect: (e?: KonvaEventObject<MouseEvent>) => void;
  onDragStart?: () => void;
  onDragEnd: (pos: { x: number; y: number }) => void;
  onDragMove?: (pos: { x: number; y: number }) => void;
  onTransformStart?: () => void;
  onTransformMove?: (pos: { x: number; y: number; width: number; height: number; rotation?: number }) => void;
  onTransformEnd: (finalRect: { x: number; y: number; width: number; height: number; rotation?: number }) => void;
  registerNodeRef: (node: Konva.Node | null) => void;
  dragBoundFunc?: (pos: { x: number; y: number }) => { x: number; y: number };
}

export function useCanvasElementEvents(props: CanvasElementEventProps) {
  const { onSelect, onDragStart, onDragEnd, onDragMove, onTransformStart, onTransformMove, onTransformEnd } = props;

  return useMemo(() => ({
    onClick: (e: KonvaEventObject<MouseEvent>) => onSelect(e),
    onTap: (e: KonvaEventObject<unknown>) => onSelect(e as unknown as KonvaEventObject<MouseEvent>),
    onDragStart: (e: KonvaEventObject<DragEvent>) => { e.cancelBubble = true; onDragStart?.(); },
    onDragMove: (e: KonvaEventObject<DragEvent>) => { e.cancelBubble = true; onDragMove?.({ x: e.target.x(), y: e.target.y() }); },
    onDragEnd: (e: KonvaEventObject<DragEvent>) => { e.cancelBubble = true; onDragEnd({ x: e.target.x(), y: e.target.y() }); },
    onTransformStart: (e: KonvaEventObject<Event>) => { e.cancelBubble = true; onTransformStart?.(); },
    onTransform: (e: KonvaEventObject<Event>) => {
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
    },
    onTransformEnd: (e: KonvaEventObject<Event>) => {
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
    },
  }), [onSelect, onDragStart, onDragEnd, onDragMove, onTransformStart, onTransformMove, onTransformEnd]);
}
