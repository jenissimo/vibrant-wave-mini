import React, { useMemo } from 'react';
import { Group, Rect, Text } from 'react-konva';
import type Konva from 'konva';
import type { CanvasElementData } from '@/components/Canvas';
import { useCanvasElementEvents, type CanvasElementEventProps } from '@/components/canvas/useCanvasElementEvents';
import { STICKY_PADDING, STICKY_CORNER_RADIUS, STICKY_DEFAULT_COLOR } from '@/lib/canvasDefaults';
import { calcStickyFontSize } from '@/lib/calcStickyFontSize';
import { useFontsLoaded } from '@/lib/useFontsLoaded';

interface CanvasStickyProps extends CanvasElementEventProps {
  onDoubleClick?: () => void;
  isEditing?: boolean;
}

export default function CanvasSticky(props: CanvasStickyProps) {
  const { data, draggable, registerNodeRef, dragBoundFunc, onDoubleClick, isEditing } = props;
  const eventHandlers = useCanvasElementEvents(props);

  const bgColor = data.stickyColor || STICKY_DEFAULT_COLOR;
  const textPad = STICKY_PADDING;
  const fontsLoaded = useFontsLoaded();
  const fontSize = useMemo(
    () => calcStickyFontSize(data.text || '', data.width, data.height, data.fontFamily || 'Inter', data.fontStyle || 'normal', textPad),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fontsLoaded invalidates cached font metrics
    [data.text, data.width, data.height, data.fontFamily, data.fontStyle, textPad, fontsLoaded],
  );

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
        fontSize={fontSize}
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
