import { useEffect, useRef, useState } from 'react';

export function useServerLogs(enabled: boolean) {
  const [lines, setLines] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enabled) return;

    const source = new EventSource('/api/server/logs/stream');

    source.addEventListener('log', (e) => {
      try {
        const { data } = JSON.parse(e.data) as { data: string };
        setLines((prev) => [...prev.slice(-499), data]);
      } catch {
        /* ignore */
      }
    });

    source.onerror = () => {
      source.close();
    };

    return () => source.close();
  }, [enabled]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  return { lines, bottomRef };
}
