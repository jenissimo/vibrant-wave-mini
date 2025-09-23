import React, { useEffect, useRef } from 'react';
import { Transformer } from 'react-konva';
import Konva from 'konva';
import { useTheme } from '@/lib/useTheme';
import { MIN_ELEMENT_SIZE } from '@/lib/canvasDefaults';
import { useKeyState } from '@/lib/useHotkeys';

interface SelectionTransformerProps {
  transformerRef: React.RefObject<Konva.Transformer | null>;
}

const SelectionTransformer: React.FC<SelectionTransformerProps> = ({ transformerRef }) => {
  const { colors: themeColors } = useTheme();
  const primaryColor = themeColors.primary;
  const primaryForegroundColor = themeColors.primaryForeground;
  const isAltPressed = useKeyState('Alt');
  
  useEffect(() => {
    const tr = transformerRef.current;
    if (!tr) return;

    tr.on('dragmove', () => {
      tr.getLayer()?.batchDraw();
    });

    tr.on('transformend', () => {
      const node = tr.getLayer()?.findOne((layer: Konva.Node) => layer.id === tr.id);
      if (!node) return;

      const scaleX = node.scaleX();
      const scaleY = node.scaleY();
      const x = node.x();
      const y = node.y();

      node.scaleX(scaleX);
      node.scaleY(scaleY);
      node.x(x);
      node.y(y);

      tr.getLayer()?.batchDraw();
    });

    return () => {
      tr.off('dragmove');
      tr.off('transformend');
    };
  }, [transformerRef]);

  return (
    <Transformer
      ref={transformerRef}
      rotateEnabled
      keepRatio={true}
      centeredScaling={isAltPressed}
      enabledAnchors={["top-left","top-center","top-right","middle-right","bottom-right","bottom-center","bottom-left","middle-left"]}
      anchorSize={6}
      anchorFill={primaryColor}
      anchorStroke={primaryForegroundColor}
      borderStroke={primaryColor}
      borderStrokeWidth={1}
      boundBoxFunc={(oldBox, newBox) => {
        if (newBox.width < MIN_ELEMENT_SIZE || newBox.height < MIN_ELEMENT_SIZE) return oldBox;
        return newBox;
      }}
    />
  );
};

export default SelectionTransformer;


