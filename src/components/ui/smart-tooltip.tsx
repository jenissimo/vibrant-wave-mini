"use client";
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface SmartTooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
  className?: string;
  containerClassName?: string;
  side?: 'top' | 'bottom';
  offset?: number;
}

const SmartTooltip: React.FC<SmartTooltipProps> = ({
  children,
  content,
  className,
  containerClassName,
  side = 'top',
  offset = 8,
}) => {
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState<{ left: number; top: number } | null>(null);

  const measureAndPosition = () => {
    const anchor = anchorRef.current;
    const tip = tooltipRef.current;
    if (!anchor || !tip) return;
    const padding = 8;
    const anchorRect = anchor.getBoundingClientRect();
    const tipRect = tip.getBoundingClientRect();
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    let topCoord = side === 'top'
      ? anchorRect.top - offset - tipRect.height
      : anchorRect.bottom + offset;

    // Auto-flip vertically if not enough space
    const notEnoughTopSpace = topCoord < padding;
    const notEnoughBottomSpace = topCoord + tipRect.height > viewportH - padding;
    if (side === 'top' && notEnoughTopSpace && anchorRect.bottom + offset + tipRect.height <= viewportH - padding) {
      topCoord = anchorRect.bottom + offset;
    } else if (side === 'bottom' && notEnoughBottomSpace && anchorRect.top - offset - tipRect.height >= padding) {
      topCoord = anchorRect.top - offset - tipRect.height;
    }

    let leftCoord = anchorRect.left + anchorRect.width / 2 - tipRect.width / 2;
    leftCoord = Math.max(padding, Math.min(leftCoord, viewportW - padding - tipRect.width));

    setCoords({ left: Math.round(leftCoord), top: Math.round(topCoord) });
  };

  const handleMouseEnter = () => {
    setVisible(true);
    requestAnimationFrame(measureAndPosition);
  };
  const handleMouseLeave = () => setVisible(false);
  const handleMouseMove = () => measureAndPosition();

  useEffect(() => {
    if (!visible) return;
    const onResize = () => measureAndPosition();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, { passive: true });
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize);
    };
  }, [visible]);

  return (
    <div
      className={`relative ${containerClassName || ''}`}
      ref={anchorRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseMove={handleMouseMove}
    >
      {children}
      {visible && typeof document !== 'undefined' && createPortal(
        <div
          role="tooltip"
          aria-hidden="true"
          ref={tooltipRef}
          style={{ position: 'fixed', left: (coords?.left ?? -99999), top: (coords?.top ?? -99999), pointerEvents: 'none', visibility: coords ? 'visible' : 'hidden' }}
          className={`z-50 rounded-md border border-border bg-background p-1 shadow-lg transition-opacity duration-100 ${className || ''}`}
        >
          {content}
        </div>,
        document.body
      )}
    </div>
  );
};

export default SmartTooltip;


