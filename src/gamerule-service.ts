import { ServerProcess } from './server-process';
import { BEDROCK_GAMERULES } from '../shared/gamerules';

function normalizeRuleKey(s: string): string {
  return s.toLowerCase().replace(/[\s_-]/g, '');
}

function parseGameruleQueryOutput(output: string, rule: string): string | undefined {
  const ruleKey = normalizeRuleKey(rule);
  const lines = output
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('[INFO]') && !l.toLowerCase().includes('running '));

  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];

    const eq = line.indexOf('=');
    if (eq !== -1) {
      const key = normalizeRuleKey(line.slice(0, eq).trim());
      if (key === ruleKey || key.endsWith(ruleKey)) {
        return line.slice(eq + 1).trim();
      }
    }

    const colon = line.indexOf(':');
    if (colon !== -1) {
      const key = normalizeRuleKey(line.slice(0, colon).trim());
      if (key === ruleKey || key.endsWith(ruleKey)) {
        return line.slice(colon + 1).trim();
      }
    }

    const setMatch = line.match(
      new RegExp(`gamerule\\s+${rule}\\s+(?:is\\s+now\\s+)?(?:set\\s+to\\s+)?(.+)$`, 'i'),
    );
    if (setMatch) return setMatch[1].trim();

    if (normalizeRuleKey(line).includes(ruleKey)) {
      const trailing = line.match(/(?:true|false|\d+)\s*$/i);
      if (trailing) return trailing[0];
    }
  }

  const last = lines[lines.length - 1];
  if (last && /^(true|false|\d+)$/i.test(last)) return last;

  return undefined;
}

function parseBulkGameruleOutput(output: string): Map<string, string> {
  const map = new Map<string, string>();
  const normalize = normalizeRuleKey;

  for (const line of output.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let key: string | undefined;
    let val: string | undefined;

    const eq = trimmed.indexOf('=');
    if (eq !== -1) {
      key = normalize(trimmed.slice(0, eq).trim());
      val = trimmed.slice(eq + 1).trim();
    } else {
      const colon = trimmed.indexOf(':');
      if (colon !== -1) {
        key = normalize(trimmed.slice(0, colon).trim());
        val = trimmed.slice(colon + 1).trim();
      }
    }

    if (key && val !== undefined && val.length > 0) {
      map.set(key, val);
    }
  }

  return map;
}

async function fetchGameruleValues(server: ServerProcess): Promise<Record<string, string>> {
  const rules = Object.keys(BEDROCK_GAMERULES);
  const values: Record<string, string> = {};

  try {
    const bulkOutput = await server.runCommand('gamerule', { timeoutMs: 8000, idleWindowMs: 800 });
    const bulk = parseBulkGameruleOutput(bulkOutput);
    for (const rule of rules) {
      const val = bulk.get(normalizeRuleKey(rule));
      if (val !== undefined) values[rule] = val;
    }
  } catch {
    // fall through to per-rule queries
  }

  const missing = rules.filter((r) => values[r] === undefined);
  const chunkSize = 4;

  for (let i = 0; i < missing.length; i += chunkSize) {
    const chunk = missing.slice(i, i + chunkSize);
    await Promise.all(
      chunk.map(async (rule) => {
        try {
          const output = await server.runCommand(`gamerule ${rule}`, {
            timeoutMs: 5000,
            idleWindowMs: 700,
          });
          const val = parseGameruleQueryOutput(output, rule);
          if (val !== undefined) values[rule] = val;
        } catch {
          // skip failed rule
        }
      }),
    );
  }

  return values;
}

export { fetchGameruleValues, parseGameruleQueryOutput, normalizeRuleKey };
