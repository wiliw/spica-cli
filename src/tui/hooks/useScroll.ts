import { useState, useCallback } from 'react';

const MAX_VISIBLE = 15;

interface UseScrollResult {
  scrollOffset: number;
  focusIndex: number;
  scrollUp: () => void;
  scrollDown: () => void;
  scrollTo: (index: number) => void;
}

export function useScroll(totalItems: number): UseScrollResult {
  const [scrollOffset, setScrollOffset] = useState(0);
  const focusIndex = scrollOffset + Math.floor(MAX_VISIBLE / 2);

  const scrollUp = useCallback(() => {
    setScrollOffset(prev => Math.max(0, prev - 1));
  }, []);

  const scrollDown = useCallback(() => {
    setScrollOffset(prev => Math.min(Math.max(0, totalItems - MAX_VISIBLE), prev + 1));
  }, [totalItems]);

  const scrollTo = useCallback((index: number) => {
    const offset = Math.max(0, Math.min(Math.max(0, totalItems - MAX_VISIBLE), index - Math.floor(MAX_VISIBLE / 2)));
    setScrollOffset(offset);
  }, [totalItems]);

  return { scrollOffset, focusIndex, scrollUp, scrollDown, scrollTo };
}