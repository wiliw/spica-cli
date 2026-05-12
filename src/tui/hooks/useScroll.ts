import { useState, useCallback, useEffect, useRef } from 'react';

interface UseScrollResult {
  focusIndex: number;
  contentOffset: number;
  autoFollow: boolean;
  scrollUp: (maxContentOffset?: number) => void;
  scrollDown: (maxContentOffset?: number) => void;
  jumpToLatest: () => void;
  setMaxContentOffset: (offset: number) => void;
}

export function useScroll(totalRounds: number): UseScrollResult {
  const [focusIndex, setFocusIndex] = useState(0);
  const [contentOffset, setContentOffset] = useState(0);
  const [autoFollow, setAutoFollow] = useState(true);
  const maxContentOffsetRef = useRef(0);

  // 自动跟随最新round
  useEffect(() => {
    if (autoFollow && totalRounds > 0) {
      setFocusIndex(totalRounds - 1);
      setContentOffset(0);
    }
  }, [totalRounds, autoFollow]);

  // 切换round时重置offset
  useEffect(() => {
    setContentOffset(0);
  }, [focusIndex]);

  // 设置当前round的最大内容offset
  const setMaxContentOffset = useCallback((offset: number) => {
    maxContentOffsetRef.current = offset;
  }, []);

  const scrollUp = useCallback((maxContentOffset?: number) => {
    const max = maxContentOffset ?? maxContentOffsetRef.current;

    // 先尝试在当前round内滚动内容
    if (contentOffset > 0) {
      setContentOffset(prev => prev - 1);
      return;
    }

    // 内容已到顶部，切换到上一个round
    if (focusIndex > 0) {
      setFocusIndex(prev => prev - 1);
      setAutoFollow(false);
      // 切换round后offset设为最大（显示该round的最后内容）
      // 注意：这需要在下一个round的maxContentOffset被设置后才能正确工作
      // 这里暂时设为0，等待该round的内容加载
      setContentOffset(0);
    }
  }, [contentOffset, focusIndex]);

  const scrollDown = useCallback((maxContentOffset?: number) => {
    const max = maxContentOffset ?? maxContentOffsetRef.current;

    // 先尝试在当前round内滚动内容
    if (contentOffset < max) {
      setContentOffset(prev => prev + 1);
      return;
    }

    // 内容已到底部，切换到下一个round
    if (focusIndex < totalRounds - 1) {
      setFocusIndex(prev => prev + 1);
      setContentOffset(0);
      // 如果到达最后一个round，启用自动跟随
      if (focusIndex + 1 >= totalRounds - 1) {
        setAutoFollow(true);
      } else {
        setAutoFollow(false);
      }
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
    setMaxContentOffset,
  };
}