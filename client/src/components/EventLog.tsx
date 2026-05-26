import { ScrollArea } from '@/components/ui/scroll-area';
import { useEventLog, levelColor } from '@/context/EventLogContext';

export function EventLog({ className }: { className?: string }) {
  const { entries } = useEventLog();

  return (
    <ScrollArea className={className ?? 'h-48 rounded-md border border-border bg-black/40 p-3 font-mono text-xs'}>
      <div className="space-y-1 pr-4">
        {entries.map((e) => (
          <div key={e.id} className={levelColor(e.level)}>
            <span className="text-muted-foreground/60">
              [{e.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}]{' '}
            </span>
            {e.message}
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
