/** Non-cancellable native requests must still lose permission to commit when superseded. */
export class RequestContext {
  private generation = 0;
  begin(): number { return ++this.generation; }
  isCurrent(ticket: number): boolean { return ticket === this.generation; }
  invalidate(): void { ++this.generation; }
}

export class BoundedCache<T> {
  private entries = new Map<string, { expires: number; value: T }>();
  constructor(private capacity = 12, private ttlMs = 120000) {}
  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expires <= Date.now()) { this.entries.delete(key); return undefined; }
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }
  set(key: string, value: T): void {
    this.entries.delete(key);
    this.entries.set(key, { value, expires: Date.now() + this.ttlMs });
    while (this.entries.size > this.capacity) this.entries.delete(this.entries.keys().next().value!);
  }
  clear(): void { this.entries.clear(); }
  values(): T[] {
    return [...this.entries.entries()].filter(([key, entry]) => {
      if (entry.expires > Date.now()) return true;
      this.entries.delete(key); return false;
    }).map(([, entry]) => entry.value);
  }
}
