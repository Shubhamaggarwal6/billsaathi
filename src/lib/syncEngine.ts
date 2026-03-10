import { db, type SyncQueueItem, type SyncMetadata, nowISO } from './localDb';
import { supabase } from '@/integrations/supabase/client';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SYNC_TABLES = ['tenants', 'users', 'customers', 'products', 'invoices', 'invoice_items', 'payments', 'purchases'] as const;
type SyncTable = typeof SYNC_TABLES[number];

export type SyncState = 'synced' | 'syncing' | 'pending' | 'offline' | 'error';

export interface SyncInfo {
  state: SyncState;
  pendingCount: number;
  failedCount: number;
  lastSyncedAt: string | null;
  pendingByTable: Record<string, number>;
  failedItems: SyncQueueItem[];
}

let syncInProgress = false;
let syncInterval: ReturnType<typeof setInterval> | null = null;
let listeners: Array<(info: SyncInfo) => void> = [];

export function onSyncChange(cb: (info: SyncInfo) => void) {
  listeners.push(cb);
  return () => { listeners = listeners.filter(l => l !== cb); };
}

async function notifyListeners() {
  const info = await getSyncInfo();
  listeners.forEach(cb => cb(info));
}

export async function getSyncInfo(): Promise<SyncInfo> {
  const pending = await db.sync_queue.where('status').anyOf('PENDING', 'SYNCING').toArray();
  const failed = await db.sync_queue.where('status').equals('FAILED').toArray();
  const lastMeta = await db.sync_metadata.toArray();
  const lastSyncedAt = lastMeta.length > 0
    ? lastMeta.reduce((latest, m) => m.last_synced_at > latest ? m.last_synced_at : latest, '')
    : null;

  const pendingByTable: Record<string, number> = {};
  pending.forEach(p => {
    pendingByTable[p.table_name] = (pendingByTable[p.table_name] || 0) + 1;
  });

  let state: SyncState = 'synced';
  if (!navigator.onLine) state = 'offline';
  else if (syncInProgress) state = 'syncing';
  else if (failed.length > 0) state = 'error';
  else if (pending.length > 0) state = 'pending';

  return {
    state,
    pendingCount: pending.length,
    failedCount: failed.length,
    lastSyncedAt: lastSyncedAt || null,
    pendingByTable,
    failedItems: failed,
  };
}

// PUSH local changes to server
async function pushChanges(): Promise<void> {
  const pending = await db.sync_queue
    .where('status').equals('PENDING')
    .sortBy('created_at');

  for (const item of pending) {
    await db.sync_queue.update(item.id, { status: 'SYNCING' });
    try {
      const table = item.table_name as SyncTable;
      const payload = { ...item.payload };
      // Remove fields not in supabase
      delete payload.is_local;

      if (item.operation === 'CREATE') {
        const { error } = await (supabase.from(table) as any).insert(payload);
        if (error) throw error;
      } else if (item.operation === 'UPDATE') {
        const { error } = await (supabase.from(table) as any)
          .update(payload)
          .eq('id', item.record_id);
        if (error) throw error;
      } else if (item.operation === 'DELETE') {
        const { error } = await (supabase.from(table) as any)
          .update({ is_deleted: true, updated_at: nowISO() })
          .eq('id', item.record_id);
        if (error) throw error;
      }

      await db.sync_queue.delete(item.id);
    } catch (err: any) {
      const retryCount = (item.retry_count || 0) + 1;
      await db.sync_queue.update(item.id, {
        status: retryCount > 5 ? 'FAILED' : 'PENDING',
        retry_count: retryCount,
        last_error: err?.message || 'Unknown error',
      });
    }
  }
}

// PULL server changes to local
async function pullChanges(tenantId: string): Promise<void> {
  for (const table of SYNC_TABLES) {
    try {
      const meta = await db.sync_metadata.get(table);
      const lastSynced = meta?.last_synced_at || '1970-01-01T00:00:00Z';

      let query = (supabase.from(table) as any)
        .select('*')
        .gt('updated_at', lastSynced)
        .order('updated_at', { ascending: true });

      // Filter by tenant_id for tenant-scoped tables
      if (table !== 'invoice_items') {
        query = query.eq('tenant_id', tenantId);
      }

      const { data, error } = await query;
      if (error) {
        console.warn(`Pull ${table} failed:`, error.message);
        continue;
      }
      if (!data || data.length === 0) {
        await db.sync_metadata.put({ table_name: table, last_synced_at: nowISO() });
        continue;
      }

      const localTable = (db as any)[table] as import('dexie').Table;

      for (const serverRecord of data) {
        const localRecord = await localTable.get(serverRecord.id);
        if (localRecord) {
          // Check if local is in sync queue (modified locally)
          const inQueue = await db.sync_queue
            .where('record_id').equals(serverRecord.id)
            .and(q => q.status === 'PENDING' || q.status === 'SYNCING')
            .first();

          if (inQueue) {
            // Conflict: local modified and server modified
            // Most recent updated_at wins
            if (new Date(serverRecord.updated_at) > new Date(localRecord.updated_at)) {
              await localTable.put(serverRecord);
              // Remove from queue since server is newer
              await db.sync_queue.delete(inQueue.id);
            }
            // else: keep local version, it will push on next sync
          } else {
            // No conflict, server is source of truth
            if (new Date(serverRecord.updated_at) > new Date(localRecord.updated_at)) {
              await localTable.put(serverRecord);
            }
          }
        } else {
          // New record from server
          await localTable.put(serverRecord);
        }
      }

      await db.sync_metadata.put({ table_name: table, last_synced_at: nowISO() });
    } catch (err) {
      console.warn(`Pull ${table} error:`, err);
    }
  }
}

export async function syncNow(tenantId?: string): Promise<void> {
  if (syncInProgress || !navigator.onLine) return;
  syncInProgress = true;
  await notifyListeners();

  try {
    // Push first
    await pushChanges();

    // Pull if we have a tenant ID
    if (tenantId) {
      await pullChanges(tenantId);
    }
  } catch (err) {
    console.error('Sync error:', err);
  } finally {
    syncInProgress = false;
    await notifyListeners();
  }
}

export async function retryFailed(): Promise<void> {
  await db.sync_queue
    .where('status').equals('FAILED')
    .modify({ status: 'PENDING', retry_count: 0, last_error: undefined });
  await notifyListeners();
  if (navigator.onLine) {
    await syncNow();
  }
}

export function startAutoSync(tenantId: string) {
  stopAutoSync();

  // Sync every 30 seconds
  syncInterval = setInterval(() => {
    if (navigator.onLine) syncNow(tenantId);
  }, 30000);

  // Sync on coming online
  const onOnline = () => syncNow(tenantId);
  window.addEventListener('online', onOnline);

  // Sync on visibility change
  const onVisible = () => {
    if (document.visibilityState === 'visible' && navigator.onLine) {
      syncNow(tenantId);
    }
  };
  document.addEventListener('visibilitychange', onVisible);

  // Sync on status change
  const onOffline = () => notifyListeners();
  window.addEventListener('offline', onOffline);

  // Initial sync
  if (navigator.onLine) syncNow(tenantId);

  return () => {
    stopAutoSync();
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
    document.removeEventListener('visibilitychange', onVisible);
  };
}

export function stopAutoSync() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}

// Initial data download for first-time setup
export async function initialDownload(
  tenantId: string,
  onProgress?: (table: string, done: boolean) => void
): Promise<void> {
  for (const table of SYNC_TABLES) {
    onProgress?.(table, false);
    try {
      let query = (supabase.from(table) as any).select('*');
      if (table !== 'invoice_items') {
        query = query.eq('tenant_id', tenantId);
      }
      // For invoices, limit to last 2 years
      if (table === 'invoices') {
        const twoYearsAgo = new Date();
        twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
        query = query.gte('created_at', twoYearsAgo.toISOString());
      }

      const { data, error } = await query;
      if (error) {
        console.warn(`Initial download ${table} failed:`, error.message);
        onProgress?.(table, true);
        continue;
      }
      if (data && data.length > 0) {
        const localTable = (db as any)[table] as import('dexie').Table;
        await localTable.bulkPut(data);
      }
      await db.sync_metadata.put({ table_name: table, last_synced_at: nowISO() });
    } catch (err) {
      console.warn(`Initial download ${table} error:`, err);
    }
    onProgress?.(table, true);
  }
}

// Trigger sync after a write operation
export function triggerSync(tenantId?: string) {
  if (navigator.onLine && tenantId) {
    // Debounced: wait 500ms to batch rapid writes
    setTimeout(() => syncNow(tenantId), 500);
  }
  notifyListeners();
}
