import { useMemo, useState, useEffect } from 'react';

export default function usePatternDots(backgroundColor: string) {
  const tile = 32;
  const dotRadius = 1;
  const [themeClass, setThemeClass] = useState('');

  // Track theme changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const updateTheme = () => {
      setThemeClass(document.documentElement.className);
    };
    
    updateTheme();
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    
    return () => observer.disconnect();
  }, []);

  const dataUrl = useMemo(() => {
    const ratio = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
    if (!canvas) return '';
    canvas.width = tile * ratio;
    canvas.height = tile * ratio;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    ctx.scale(ratio, ratio);

    // Get theme-aware background color
    let themeBackgroundColor = backgroundColor;
    if (typeof window !== 'undefined') {
      const raw = getComputedStyle(document.documentElement).getPropertyValue('--canvas-background').trim() || backgroundColor;
      const probe = document.createElement('span');
      probe.style.backgroundColor = raw;
      document.body.appendChild(probe);
      themeBackgroundColor = getComputedStyle(probe).backgroundColor || backgroundColor;
      probe.remove();
    }

    ctx.fillStyle = themeBackgroundColor;
    ctx.fillRect(0, 0, tile, tile);

    // Get theme color from CSS variable and normalize to rgb
    let dotColor = '#e5e7eb';
    if (typeof window !== 'undefined') {
      const raw = getComputedStyle(document.documentElement).getPropertyValue('--canvas-dots').trim() || '#e5e7eb';
      const probe = document.createElement('span');
      probe.style.color = raw;
      document.body.appendChild(probe);
      dotColor = getComputedStyle(probe).color || '#e5e7eb';
      probe.remove();
    }
    ctx.fillStyle = dotColor;
    const positions = [0, 16];
    for (const x of positions) {
      for (const y of positions) {
        ctx.beginPath();
        ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    return canvas.toDataURL();
  }, [backgroundColor, themeClass]);

  return { dataUrl, tile } as const;
}


