export class OperationRegistry {
  private _checks: Map<string, () => boolean> = new Map();

  register(id: string, isActive: () => boolean): void {
    this._checks.set(id, isActive);
  }

  unregister(id: string): void {
    this._checks.delete(id);
  }

  findActive(blockIds: string[]): string | null {
    for (const id of blockIds) {
      const check = this._checks.get(id);
      if (check && check()) {
        return id;
      }
    }
    return null;
  }

  isIdle(blockIds: string[]): boolean {
    return this.findActive(blockIds) === null;
  }
}
