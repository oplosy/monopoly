import { useEffect, useState } from 'react';

export interface Viewport {
  width: number;
  height: number;
}

const read = (): Viewport => ({ width: window.innerWidth, height: window.innerHeight });

/** The window's size, kept current as it resizes or turns. */
export function useViewport(): Viewport {
  const [size, setSize] = useState(read);
  useEffect(() => {
    const update = () =>
      setSize((prev) => {
        const next = read();
        return prev.width === next.width && prev.height === next.height ? prev : next;
      });
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);
  return size;
}
