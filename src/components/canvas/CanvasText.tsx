import React from 'react';
import { Text } from 'react-konva';
import type Konva from 'konva';
import { KonvaEventObject } from 'konva/lib/Node';
import type { CanvasElementData } from '@/components/Canvas';

interface CanvasTextProps {
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
  onDoubleClick?: () => void;
  isEditing?: boolean;
}

export default function CanvasText(props: CanvasTextProps) {
  const { data, draggable, onSelect, onDragStart, onDragEnd, onDragMove, onTransformStart, onTransformMove, onTransformEnd, registerNodeRef, dragBoundFunc, onDoubleClick, isEditing } = props;

  return (
    <Text
      ref={registerNodeRef}
      x={data.x}
      y={data.y}
      width={data.width}
      text={data.text || ''}
      fontSize={data.fontSize || 24}
      fontFamily={data.fontFamily || 'Arial'}
      fill={data.fill || '#000000'}
      rotation={data.rotation || 0}
      opacity={isEditing ? 0 : 1}
      draggable={draggable}
      dragBoundFunc={dragBoundFunc}
      onClick={(e) => onSelect(e as KonvaEventObject<MouseEvent>)}
      onTap={(e) => onSelect(e as unknown as KonvaEventObject<MouseEvent>)}
      onDblClick={() => onDoubleClick?.()}
      onDblTap={() => onDoubleClick?.()}
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
    />
  );
}
