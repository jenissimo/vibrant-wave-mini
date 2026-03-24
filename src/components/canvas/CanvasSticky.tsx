import React from 'react';
import { Group, Rect, Text } from 'react-konva';
import type Konva from 'konva';
import type { CanvasElementData } from '@/components/Canvas';
import { useCanvasElementEvents, type CanvasElementEventProps } from '@/components/canvas/useCanvasElementEvents';
import { STICKY_PADDING, STICKY_CORNER_RADIUS, STICKY_DEFAULT_COLOR } from '@/lib/canvasDefaults';

interface CanvasStickyProps extends CanvasElementEventProps {
  onDoubleClick?: () => void;
  isEditing?: boolean;
}

export default function CanvasSticky(props: CanvasStickyProps) {
  const { data, draggable, registerNodeRef, dragBoundFunc, onDoubleClick, isEditing } = props;
  const eventHandlers = useCanvasElementEvents(props);

  const bgColor = data.stickyColor || STICKY_DEFAULT_COLOR;
  const textPad = STICKY_PADDING;

  return (
    <Group
      ref={registerNodeRef as (node: Konva.Group | null) => void}
      x={data.x}
      y={data.y}
      width={data.width}
      height={data.height}
      rotation={data.rotation || 0}
      draggable={draggable}
      dragBoundFunc={dragBoundFunc}
      {...eventHandlers}
      onDblClick={() => onDoubleClick?.()}
      onDblTap={() => onDoubleClick?.()}
    >
      <Rect
        width={data.width}
        height={data.height}
        fill={bgColor}
        cornerRadius={STICKY_CORNER_RADIUS}
        shadowColor="#000000"
        shadowBlur={4}
        shadowOpacity={0.15}
        shadowOffsetY={2}
      />
      <Text
        x={textPad}
        y={textPad}
        width={Math.max(1, data.width - 2 * textPad)}
        height={Math.max(1, data.height - 2 * textPad)}
        text={data.text || ''}
        fontSize={data.fontSize || 16}
        fontFamily={data.fontFamily || 'Inter'}
        fontStyle={data.fontStyle || 'normal'}
        fill={data.fill || '#000000'}
        align="center"
        verticalAlign="middle"
        wrap="word"
        opacity={isEditing ? 0 : 1}
        listening={false}
      />
    </Group>
  );
}
