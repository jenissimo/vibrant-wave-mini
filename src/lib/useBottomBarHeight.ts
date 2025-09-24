import { useEffect, useState } from 'react';

export function useBottomBarHeight() {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const updateHeight = () => {
      const bottomBar = document.getElementById('bottom-bar');
      if (bottomBar) {
        const rect = bottomBar.getBoundingClientRect();
        setHeight(rect.height);
      }
    };

    // Initial measurement
    updateHeight();

    // Watch for resize changes
    const resizeObserver = new ResizeObserver(updateHeight);
    const bottomBar = document.getElementById('bottom-bar');
    
    if (bottomBar) {
      resizeObserver.observe(bottomBar);
    }

    // Also listen to window resize as fallback
    window.addEventListener('resize', updateHeight);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateHeight);
    };
  }, []);

  return height;
}

