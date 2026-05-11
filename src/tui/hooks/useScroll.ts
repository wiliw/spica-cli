import { useState, useCallback, useEffect, useRef } from 'react';

interface UseScrollResult {
  focusIndex: number;
  contentOffset: number;
  autoFollow: boolean;
  scrollUp: () => void;
  scrollDown: () => void;
  jumpToLatest: () => void;
  setContentHeight: (height: number) => void;
  setViewportHeight: (height: number) => void;
}

export function useScroll(totalRounds: number): UseScrollResult {
  const [focusIndex, setFocusIndex] = useState(0);
  const [contentOffset, setContentOffset] = useState(0);
  const [autoFollow, setAutoFollow] = useState(true);
  const contentHeightRef = useRef(0);
  const viewportHeightRef = useRef(20);
  const scrollDirectionRef = useRef<'up' | 'down' | null>(null);

  useEffect(() => {
    if (autoFollow && totalRounds > 0) {
      setFocusIndex(totalRounds - 1);
      setContentOffset(0);
    }
  }, [totalRounds, autoFollow]);

  const setContentHeight = useCallback((height: number) => {
    contentHeightRef.current = height;
  }, []);

  const setViewportHeight = useCallback((height: number) => {
    viewportHeightRef.current = height;
  }, []);

  const scrollUp = useCallback(() => {
    scrollDirectionRef.current = 'up';
    const maxOffset = Math.max(0, contentHeightRef.current - viewportHeightRef.current);
    
    if (contentOffset > 0) {
      setContentOffset(prev => Math.max(0, prev - 1));
    } else if (focusIndex > 0) {
      setFocusIndex(prev => prev - 1);
      setAutoFollow(false);
      setContentOffset(maxOffset);
    }
  }, [contentOffset, focusIndex]);

  const scrollDown = useCallback(() => {
    scrollDirectionRef.current = 'down';
    const maxOffset = Math.max(0, contentHeightRef.current - viewportHeightRef.current);
    
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
    setContentHeight,
    setViewportHeight,
  };
}