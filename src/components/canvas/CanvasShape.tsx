import React from 'react';
import { Group, Rect, Ellipse, Line, Text } from 'react-konva';
import type Konva from 'konva';
import type { CanvasElementData } from '@/components/Canvas';
import { useCanvasElementEvents, type CanvasElementEventProps } from '@/components/canvas/useCanvasElementEvents';
import {
  SHAPE_DEFAULT_BG,
  SHAPE_DEFAULT_BORDER,
  SHAPE_DEFAULT_BORDER_WIDTH,
  SHAPE_DEFAULT_CORNER_RADIUS,
  SHAPE_DEFAULT_PADDING,
} from '@/lib/canvasDefaults';

interface CanvasShapeProps extends CanvasElementEventProps {
  onDoubleClick?: () => void;
  isEditing?: boolean;
}

function ShapeBackground({ data }: { data: CanvasElementData }) {
  const w = data.width;
  const h = data.height;
  const bgColor = data.bgColor || SHAPE_DEFAULT_BG;
  const borderColor = data.borderColor || SHAPE_DEFAULT_BORDER;
  const borderWidth = data.borderWidth ?? SHAPE_DEFAULT_BORDER_WIDTH;

  switch (data.shapeType) {
    case 'ellipse':
      return (
        <Ellipse
          x={w / 2}
          y={h / 2}
          radiusX={w / 2}
          radiusY={h / 2}
          fill={bgColor}
          stroke={borderColor}
          strokeWidth={borderWidth}
        />
      );
    case 'diamond':
      return (
        <Line
          points={[w / 2, 0, w, h / 2, w / 2, h, 0, h / 2]}
          closed
          fill={bgColor}
          stroke={borderColor}
          strokeWidth={borderWidth}
        />
      );
    case 'triangle':
      return (
        <Line
          points={[w / 2, 0, w, h, 0, h]}
          closed
          fill={bgColor}
          stroke={borderColor}
          strokeWidth={borderWidth}
        />
      );
    case 'roundedRect':
      return (
        <Rect
          width={w}
          height={h}
          fill={bgColor}
          stroke={borderColor}
          strokeWidth={borderWidth}
          cornerRadius={data.cornerRadius ?? SHAPE_DEFAULT_CORNER_RADIUS}
        />
      );
    case 'rectangle':
    default:
      return (
        <Rect
          width={w}
          height={h}
          fill={bgColor}
          stroke={borderColor}
          strokeWidth={borderWidth}
        />
      );
  }
}

export default function CanvasShape(props: CanvasShapeProps) {
  const { data, draggable, registerNodeRef, dragBoundFunc, onDoubleClick, isEditing } = props;
  const eventHandlers = useCanvasElementEvents(props);

  const pad = data.padding ?? SHAPE_DEFAULT_PADDING;

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
      <ShapeBackground data={data} />
      {(data.text || isEditing) && (
        <Text
          x={pad}
          y={pad}
          width={Math.max(1, data.width - 2 * pad)}
          height={Math.max(1, data.height - 2 * pad)}
          text={data.text || ''}
          fontSize={data.fontSize || 16}
          fontFamily={data.fontFamily || 'Inter'}
          fontStyle={data.fontStyle || 'normal'}
          fill={data.fill || '#000000'}
          align={data.textAlign || 'center'}
          verticalAlign={data.verticalAlign || 'middle'}
          wrap="word"
          opacity={isEditing ? 0 : 1}
          listening={false}
        />
      )}
    </Group>
  );
}
