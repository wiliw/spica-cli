import { useState, useEffect, useMemo } from 'react';

export function useMarquee(content: string, maxLines: number): string {
  const [phase, setPhase] = useState(0);

  const lines = useMemo(() => content.split('\n'), [content]);
  const needsMarquee = lines.length > maxLines;

  useEffect(() => {
    if (!needsMarquee) {
      setPhase(0);
      return;
    }

    const timer = setInterval(() => {
      setPhase(prev => (prev + 1) % (lines.length - maxLines + 1));
    }, 500);

    return () => clearInterval(timer);
  }, [needsMarquee, lines.length, maxLines]);

  if (!needsMarquee) {
    return content;
  }

  return lines.slice(phase, phase + maxLines).join('\n');
}