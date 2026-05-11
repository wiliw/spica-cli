import { useState, useCallback, useEffect } from 'react';

interface UseScrollResult {
  scrollOffset: number;
  focusIndex: number;
  autoFollow: boolean;
  scrollUp: () => void;
  scrollDown: () => void;
  jumpToLatest: () => void;
}

export function useScroll(totalItems: number): UseScrollResult {
  const [focusIndex, setFocusIndex] = useState(0);
  const [autoFollow, setAutoFollow] = useState(true);
  
  useEffect(() => {
    if (autoFollow && totalItems > 0) {
      setFocusIndex(totalItems - 1);
    }
  }, [totalItems, autoFollow]);

  const scrollUp = useCallback(() => {
    setAutoFollow(false);
    setFocusIndex(prev => Math.max(0, prev - 1));
  }, []);

  const scrollDown = useCallback(() => {
    const newIndex = focusIndex + 1;
    if (newIndex >= totalItems - 1) {
      setAutoFollow(true);
      setFocusIndex(totalItems - 1);
    } else {
      setFocusIndex(newIndex);
    }
  }, [focusIndex, totalItems]);

  const jumpToLatest = useCallback(() => {
    setAutoFollow(true);
    if (totalItems > 0) {
      setFocusIndex(totalItems - 1);
    }
  }, [totalItems]);

  return { 
    scrollOffset: Math.max(0, focusIndex - 2), 
    focusIndex, 
    autoFollow, 
    scrollUp, 
    scrollDown, 
    jumpToLatest 
  };
}