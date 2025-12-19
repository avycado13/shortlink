import { getTableName, is, Table } from "drizzle-orm";
import { Cache } from "drizzle-orm/cache/core";
import type { CacheConfig } from "drizzle-orm/cache/core/types";
import { LRUCache } from "lru-cache";

export class DrizzleLRUCache extends Cache {
  private globalTtl = 1000;

  // Tracks which cache keys depend on which tables
  private usedTablesPerKey: Record<string, Set<string>> = {};

  private cache: LRUCache<string, any>;

  constructor(options?: { max?: number; ttl?: number }) {
    super();

    this.cache = new LRUCache<string, any>({
      max: options?.max ?? 5000,
      ttl: options?.ttl ?? this.globalTtl,
      allowStale: false,
    });
  }

  override strategy(): "explicit" | "all" {
    return "all";
  }

  override async get(key: string): Promise<any[] | undefined> {
    return this.cache.get(key);
  }

  override async put(
    key: string,
    response: any,
    tables: string[],
    _isTag: boolean, // Added 'isTag' parameter (unused but required by interface)
    config?: CacheConfig
  ): Promise<void> {
    const ttl = config?.px ?? (config?.ex ? config.ex * 1000 : this.globalTtl);

    this.cache.set(key, response, { ttl });

    for (const table of tables) {
      if (!this.usedTablesPerKey[table]) {
        this.usedTablesPerKey[table] = new Set();
      }
      this.usedTablesPerKey[table].add(key);
    }
  }

  override async onMutate(params: {
    tags: string | string[];
    tables: string | string[] | Table<any> | Table<any>[];
  }): Promise<void> {
    const tagsArray = params.tags
      ? Array.isArray(params.tags)
        ? params.tags
        : [params.tags]
      : [];

    const tablesArray = params.tables
      ? Array.isArray(params.tables)
        ? params.tables
        : [params.tables]
      : [];

    const keysToDelete = new Set<string>();

    for (const table of tablesArray) {
      const tableName = is(table, Table)
        ? getTableName(table)
        : (table as string);

      const keys = this.usedTablesPerKey[tableName];
      if (!keys) continue;

      for (const key of keys) {
        keysToDelete.add(key);
      }
    }

    // Delete by tag
    for (const tag of tagsArray) {
      this.cache.delete(tag);
    }

    // Delete affected keys
    for (const key of keysToDelete) {
      this.cache.delete(key);
    }

    // Clear table mappings
    for (const table of tablesArray) {
      const tableName = is(table, Table)
        ? getTableName(table)
        : (table as string);

      this.usedTablesPerKey[tableName]?.clear();
    }
  }
}
