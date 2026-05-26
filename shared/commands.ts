export type CommandAction = 'tp' | 'give' | 'kill' | 'ban' | 'pardon' | 'gamerule';

export interface TpRequest {
  action: 'tp';
  target: string;
  destination?: string;
  x?: number;
  y?: number;
  z?: number;
}

export interface GiveRequest {
  action: 'give';
  target: string;
  item: string;
  amount?: number;
  data?: number;
}

export interface KillRequest {
  action: 'kill';
  target: string;
}

export interface BanRequest {
  action: 'ban';
  target: string;
  reason?: string;
}

export interface PardonRequest {
  action: 'pardon';
  target: string;
}

export interface GameruleRequest {
  action: 'gamerule';
  rule: string;
  value: string | boolean | number;
}

export type CommandRequest = TpRequest | GiveRequest | KillRequest | BanRequest | PardonRequest | GameruleRequest;

export interface CommandResult {
  command: string;
  output: string;
}
