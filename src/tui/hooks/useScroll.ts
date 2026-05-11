import { useState, useCallback, useEffect } from 'react';

const MAX_VISIBLE = 10;

interface UseScrollResult {
  scrollOffset: number;
  focusIndex: number;
  autoFollow: boolean;
  scrollUp: () => void;
  scrollDown: () => void;
  jumpToLatest: () => void;
}

export function useScroll(totalItems: number): UseScrollResult {
  const [scrollOffset, setScrollOffset] = useState(0);
  const [autoFollow, setAutoFollow] = useState(true);
  
  const maxOffset = Math.max(0, totalItems - MAX_VISIBLE);
  
  useEffect(() => {
    if (autoFollow && totalItems > 0) {
      setScrollOffset(maxOffset);
    }
  }, [totalItems, autoFollow, maxOffset]);

  const focusIndex = Math.min(scrollOffset + Math.floor(MAX_VISIBLE / 2), totalItems - 1);

  const scrollUp = useCallback(() => {
    setAutoFollow(false);
    setScrollOffset(prev => Math.max(0, prev - 1));
  }, []);

  const scrollDown = useCallback(() => {
    const newOffset = scrollOffset + 1;
    if (newOffset >= maxOffset) {
      setAutoFollow(true);
      setScrollOffset(maxOffset);
    } else {
      setScrollOffset(newOffset);
    }
  }, [scrollOffset, maxOffset]);

  const jumpToLatest = useCallback(() => {
    setAutoFollow(true);
    setScrollOffset(maxOffset);
  }, [maxOffset]);

  return { scrollOffset, focusIndex, autoFollow, scrollUp, scrollDown, jumpToLatest };
}