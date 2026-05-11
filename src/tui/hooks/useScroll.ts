import { useState, useCallback, useEffect, useRef } from 'react';

interface UseScrollResult {
  focusIndex: number;
  contentOffset: number;
  autoFollow: boolean;
  scrollUp: () => void;
  scrollDown: () => void;
  jumpToLatest: () => void;
}

export function useScroll(totalRounds: number): UseScrollResult {
  const [focusIndex, setFocusIndex] = useState(0);
  const [contentOffset, setContentOffset] = useState(0);
  const [autoFollow, setAutoFollow] = useState(true);
  const scrollDirectionRef = useRef<'up' | 'down' | null>(null);
  const maxContentOffsetRef = useRef(0);

  useEffect(() => {
    if (autoFollow && totalRounds > 0) {
      setFocusIndex(totalRounds - 1);
      setContentOffset(0);
    }
  }, [totalRounds, autoFollow]);

  useEffect(() => {
    maxContentOffsetRef.current = 0;
  }, [focusIndex]);

  const scrollUp = useCallback(() => {
    scrollDirectionRef.current = 'up';
    
    if (contentOffset > 0) {
      setContentOffset(prev => Math.max(0, prev - 1));
    } else if (focusIndex > 0) {
      setFocusIndex(prev => prev - 1);
      setAutoFollow(false);
      setContentOffset(maxContentOffsetRef.current);
    }
  }, [contentOffset, focusIndex]);

  const scrollDown = useCallback(() => {
    scrollDirectionRef.current = 'down';
    const maxOffset = maxContentOffsetRef.current;
    
    if (contentOffset < maxOffset) {
      setContentOffset(prev => Math.min(maxOffset, prev + 1));
    } else if (focusIndex < totalRounds - 1) {
      setFocusIndex(prev => prev + 1);
      if (focusIndex + 1 >= totalRounds - 1) {
        setAutoFollow(true);
      } else {
        setAutoFollow(false);
      }
      setContentOffset(0);
    }
  }, [contentOffset, focusIndex, totalRounds]);

  const jumpToLatest = useCallback(() => {
    if (totalRounds > 0) {
      setFocusIndex(totalRounds - 1);
      setContentOffset(0);
      setAutoFollow(true);
    }
  }, [totalRounds]);

  return {
    focusIndex,
    contentOffset,
    autoFollow,
    scrollUp,
    scrollDown,
    jumpToLatest,
  };
}