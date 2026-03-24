import React from 'react';
import { Group, Line } from 'react-konva';
import Konva from 'konva';
import { KonvaEventObject } from 'konva/lib/Node';
import type { CanvasElementData } from '@/components/Canvas';
import { useCanvasElementEvents, type CanvasElementEventProps } from '@/components/canvas/useCanvasElementEvents';

interface CanvasDrawingProps extends CanvasElementEventProps {}

export default function CanvasDrawing(props: CanvasDrawingProps) {
  const { data, registerNodeRef, dragBoundFunc, draggable } = props;
  const eventHandlers = useCanvasElementEvents(props);

  return (
    <Group
      ref={registerNodeRef}
      x={data.x}
      y={data.y}
      width={data.width}
      height={data.height}
      rotation={data.rotation || 0}
      draggable={draggable}
      dragBoundFunc={dragBoundFunc}
      {...eventHandlers}
      listening={true}
    >
      <Line
        points={data.points || []}
        stroke={data.stroke || '#000000'}
        strokeWidth={data.strokeWidth || 2}
        lineCap="round"
        lineJoin="round"
        tension={0.5}
        listening={false}
      />
    </Group>
  );
}
