import { ServerProcess } from './server-process';
import type { CommandResult } from '../shared/commands';

class CommandService {
  private serverProcess: ServerProcess;

  constructor(serverProcess: ServerProcess) {
    this.serverProcess = serverProcess;
  }

  private sanitize(name: string): string {
    return name.replace(/["']/g, '').slice(0, 256);
  }

  async tp(target: string, destination?: string, coords?: { x: number; y: number; z: number }): Promise<CommandResult> {
    if (!target) throw new Error('Target name is required');
    const cleanTarget = this.sanitize(target);
    let command: string;
    if (coords) {
      if (typeof coords.x !== 'number' || typeof coords.y !== 'number' || typeof coords.z !== 'number') {
        throw new Error('Invalid coordinates');
      }
      command = `teleport "${cleanTarget}" ${coords.x} ${coords.y} ${coords.z}`;
    } else if (destination) {
      const cleanDest = this.sanitize(destination);
      command = `teleport "${cleanTarget}" "${cleanDest}"`;
    } else {
      command = `teleport "${cleanTarget}" ~ ~ ~`;
    }
    const output = await this.serverProcess.runCommand(command);
    return { command, output };
  }

  async give(target: string, item: string, amount?: number, data?: number): Promise<CommandResult> {
    if (!target) throw new Error('Target name is required');
    if (!item) throw new Error('Item name is required');
    if (amount !== undefined && (typeof amount !== 'number' || amount <= 0 || !Number.isFinite(amount))) {
      throw new Error('Amount must be a positive number');
    }
    const cleanTarget = this.sanitize(target);
    const cleanItem = this.sanitize(item);
    let command = `give "${cleanTarget}" ${cleanItem}`;
    if (amount !== undefined) {
      command += ` ${amount}`;
      if (data !== undefined) {
        command += ` ${data}`;
      }
    }
    const output = await this.serverProcess.runCommand(command);
    return { command, output };
  }

  async kill(target: string): Promise<CommandResult> {
    if (!target) throw new Error('Target name is required');
    const cleanTarget = this.sanitize(target);
    const command = `kill "${cleanTarget}"`;
    const output = await this.serverProcess.runCommand(command);
    return { command, output };
  }

  async ban(name: string, reason?: string): Promise<CommandResult> {
    if (!name) throw new Error('Player name is required');
    const cleanName = this.sanitize(name);
    let command = `ban "${cleanName}"`;
    if (reason) {
      const cleanReason = this.sanitize(reason);
      command += ` "${cleanReason}"`;
    }
    const output = await this.serverProcess.runCommand(command);
    return { command, output };
  }

  async pardon(name: string): Promise<CommandResult> {
    if (!name) throw new Error('Player name is required');
    const cleanName = this.sanitize(name);
    const command = `pardon "${cleanName}"`;
    const output = await this.serverProcess.runCommand(command);
    return { command, output };
  }

  async gamerule(rule: string, value: string | boolean | number): Promise<CommandResult> {
    if (!rule) throw new Error('Gamerule name is required');
    if (value === undefined || value === null) throw new Error('Gamerule value is required');
    const cleanRule = this.sanitize(rule);
    let command: string;
    if (typeof value === 'boolean') {
      command = `gamerule ${cleanRule} ${value}`;
    } else if (typeof value === 'number') {
      command = `gamerule ${cleanRule} ${value}`;
    } else {
      const strValue = String(value);
      if (!strValue) throw new Error('Gamerule value is required');
      command = `gamerule ${cleanRule} ${strValue}`;
    }
    const output = await this.serverProcess.runCommand(command);
    return { command, output };
  }
}

let instance: CommandService | null = null;

function getCommandService(serverProcess: ServerProcess): CommandService {
  if (!instance) {
    instance = new CommandService(serverProcess);
  }
  return instance;
}

export { CommandService, getCommandService };
