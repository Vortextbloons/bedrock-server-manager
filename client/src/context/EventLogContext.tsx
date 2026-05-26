import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

export type LogLevel = 'info' | 'success' | 'error' | 'warning' | 'starting' | 'stopping';

export interface LogEntry {
  id: number;
  message: string;
  level: LogLevel;
  time: Date;
}

interface EventLogContextValue {
  entries: LogEntry[];
  log: (message: string, level?: LogLevel) => void;
  clear: () => void;
}

const EventLogContext = createContext<EventLogContextValue | null>(null);

let nextId = 0;

export function EventLogProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<LogEntry[]>([
    { id: nextId++, message: '[SYSTEM] Dashboard initialized.', level: 'info', time: new Date() },
  ]);

  const log = useCallback((message: string, level: LogLevel = 'info') => {
    setEntries((prev) => [...prev.slice(-199), { id: nextId++, message, level, time: new Date() }]);
  }, []);

  const clear = useCallback(() => setEntries([]), []);

  return (
    <EventLogContext.Provider value={{ entries, log, clear }}>{children}</EventLogContext.Provider>
  );
}

export function useEventLog() {
  const ctx = useContext(EventLogContext);
  if (!ctx) throw new Error('useEventLog must be used within EventLogProvider');
  return ctx;
}

export function levelColor(level: LogLevel): string {
  switch (level) {
    case 'success':
      return 'text-green-400';
    case 'error':
      return 'text-red-400';
    case 'warning':
      return 'text-amber-300';
    case 'starting':
      return 'text-cyan-400';
    case 'stopping':
      return 'text-amber-400';
    default:
      return 'text-muted-foreground';
  }
}
