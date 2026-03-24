import { useState, useEffect } from 'react';

/**
 * Returns a counter that increments each time fonts finish loading.
 * Use as a dependency in useMemo/useEffect to invalidate
 * measurements that depend on font metrics (e.g. auto-fit text).
 */
export function useFontsLoaded(): number {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const bump = () => setVersion(v => v + 1);
    document.fonts.addEventListener('loadingdone', bump);
    document.fonts.ready.then(bump);
    return () => document.fonts.removeEventListener('loadingdone', bump);
  }, []);

  return version;
}
