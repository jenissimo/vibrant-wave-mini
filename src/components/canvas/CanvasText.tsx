import React from 'react';
import { Text } from 'react-konva';
import type Konva from 'konva';
import type { CanvasElementData } from '@/components/Canvas';
import { useCanvasElementEvents, type CanvasElementEventProps } from '@/components/canvas/useCanvasElementEvents';

interface CanvasTextProps extends CanvasElementEventProps {
  onDoubleClick?: () => void;
  isEditing?: boolean;
}

export default function CanvasText(props: CanvasTextProps) {
  const { data, draggable, registerNodeRef, dragBoundFunc, onDoubleClick, isEditing } = props;
  const eventHandlers = useCanvasElementEvents(props);

  return (
    <Text
      ref={registerNodeRef}
      x={data.x}
      y={data.y}
      width={data.width}
      height={data.height}
      text={data.text || ''}
      fontSize={data.fontSize || 24}
      fontFamily={data.fontFamily || 'Arial'}
      fill={data.fill || '#000000'}
      rotation={data.rotation || 0}
      opacity={isEditing ? 0 : 1}
      draggable={draggable}
      dragBoundFunc={dragBoundFunc}
      {...eventHandlers}
      onDblClick={() => onDoubleClick?.()}
      onDblTap={() => onDoubleClick?.()}
      listening={true}
    />
  );
}
