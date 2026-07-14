/**
 * Крошечный in-memory TTL-кэш для одного процесса.
 *
 * Осознанно без Redis и cache-manager: приложение живёт на одном VPS в одном
 * процессе, кэшируются только горячие дешёвые ответы (каталог, настройки),
 * а инвалидация нужна немедленная и локальная (см. clear()).
 */
export class TtlCache<T> {
  private readonly entries = new Map<string, { data: T; expiresAt: number }>();

  constructor(
    private readonly ttlMs: number,
    /** Защита от неограниченного роста при кэшировании по ключу. */
    private readonly maxEntries = 500,
  ) {}

  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt < Date.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.data;
  }

  set(key: string, data: T): void {
    if (this.entries.size >= this.maxEntries) {
      // Простейшее вытеснение: сбросить всё. Для наших объёмов достаточно.
      this.entries.clear();
    }
    this.entries.set(key, { data, expiresAt: Date.now() + this.ttlMs });
  }

  /** Полная инвалидация — вызывается при любой мутации кэшируемых данных. */
  clear(): void {
    this.entries.clear();
  }
}
