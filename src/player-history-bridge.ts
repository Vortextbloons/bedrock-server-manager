import type { EventBus } from './core/event-bus';
import type { BackendEventMap } from '../shared/events';
import { appendHistory, trimHistoryFile } from './player-service';

const HISTORY_TRIM_EVERY = 50;
let linesSinceTrim = 0;

function normalizePlayerName(raw: string): string {
  return raw.trim().replace(/^["']|["']$/g, '');
}

function parseJoinLeave(line: string): { name: string; event: 'join' | 'leave' } | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const patterns: Array<{ re: RegExp; event: 'join' | 'leave' }> = [
    { re: /Player\s+Connected:\s*([^,(]+)/i, event: 'join' },
    { re: /Player\s+Disconnected:\s*([^,(]+)/i, event: 'leave' },
    { re: /\[.*?\]\s*(.+?)\s+joined the game/i, event: 'join' },
    { re: /\[.*?\]\s*(.+?)\s+left the game/i, event: 'leave' },
    { re: /(\S+)\s+joined the game/i, event: 'join' },
    { re: /(\S+)\s+left the game/i, event: 'leave' },
  ];

  for (const { re, event } of patterns) {
    const m = trimmed.match(re);
    if (m?.[1]) {
      const name = normalizePlayerName(m[1]);
      if (name && name.toLowerCase() !== 'xuid') return { name, event };
    }
  }

  return null;
}

function wirePlayerHistory(bus: EventBus<BackendEventMap>): void {
  bus.onTyped('server.log', (payload) => {
    const data = payload.data;
    for (const line of data.split(/\r?\n/)) {
      const parsed = parseJoinLeave(line);
      if (!parsed) continue;

      appendHistory({
        timestamp: new Date().toISOString(),
        name: parsed.name,
        event: parsed.event,
      });

      linesSinceTrim += 1;
      if (linesSinceTrim >= HISTORY_TRIM_EVERY) {
        linesSinceTrim = 0;
        trimHistoryFile();
      }
    }
  });
}

export { wirePlayerHistory, parseJoinLeave };
