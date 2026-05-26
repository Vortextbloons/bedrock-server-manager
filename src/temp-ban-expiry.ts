import { ServerProcess } from './server-process';
import { getCommandService } from './command-service';
import {
  getExpiredTempBans,
  removeBanEntry,
  removeTempBan,
} from './player-service';

async function processExpiredTempBans(serverProcess: ServerProcess): Promise<number> {
  const expired = getExpiredTempBans();
  if (expired.length === 0) return 0;

  const cmd = getCommandService(serverProcess);
  const running = serverProcess.getStatus().running;

  for (const ban of expired) {
    try {
      if (running) {
        await cmd.pardon(ban.name);
      }
      try {
        removeBanEntry(ban.name);
      } catch {
        // may already be removed from banlist
      }
      removeTempBan(ban.name);
    } catch {
      // continue with other bans
    }
  }

  return expired.length;
}

function startTempBanExpiryScheduler(serverProcess: ServerProcess, intervalMs = 60_000): () => void {
  const tick = () => {
    void processExpiredTempBans(serverProcess);
  };

  tick();
  const handle = setInterval(tick, intervalMs);
  return () => clearInterval(handle);
}

export { processExpiredTempBans, startTempBanExpiryScheduler };
