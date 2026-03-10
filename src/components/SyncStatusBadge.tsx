import { useState, useEffect } from 'react';
import { onSyncChange, getSyncInfo, syncNow, retryFailed, type SyncInfo } from '@/lib/syncEngine';
import { Cloud, CloudOff, RefreshCw, AlertTriangle, Check, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';

export default function SyncStatusBadge({ tenantId }: { tenantId?: string }) {
  const [info, setInfo] = useState<SyncInfo | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  useEffect(() => {
    getSyncInfo().then(setInfo);
    return onSyncChange(setInfo);
  }, []);

  if (!info) return null;

  const icon = {
    synced: <Cloud className="w-4 h-4 text-emerald-500" />,
    syncing: <Loader2 className="w-4 h-4 text-primary animate-spin" />,
    pending: <RefreshCw className="w-4 h-4 text-amber-500" />,
    offline: <CloudOff className="w-4 h-4 text-muted-foreground" />,
    error: <AlertTriangle className="w-4 h-4 text-destructive" />,
  }[info.state];

  const label = {
    synced: '✓',
    syncing: '...',
    pending: String(info.pendingCount),
    offline: '✗',
    error: '!',
  }[info.state];

  return (
    <>
      <button
        onClick={() => setPanelOpen(true)}
        className="relative flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-muted/50 transition-colors"
        title="Sync Status"
      >
        {icon}
        {(info.pendingCount > 0 || info.failedCount > 0) && (
          <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
            {info.pendingCount + info.failedCount}
          </span>
        )}
      </button>

      {panelOpen && (
        <>
          <div className="fixed inset-0 bg-foreground/30 z-50" onClick={() => setPanelOpen(false)} />
          <div className="fixed top-4 right-4 z-50 w-80 max-w-[calc(100vw-2rem)] bg-card border rounded-xl shadow-lg animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                🔄 Sync Status
              </h3>
              <button onClick={() => setPanelOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                {icon}
                <span className="text-sm text-foreground">
                  {info.state === 'synced' && 'All data synced'}
                  {info.state === 'syncing' && 'Syncing...'}
                  {info.state === 'pending' && `${info.pendingCount} changes pending sync`}
                  {info.state === 'offline' && 'Offline — sync hoga jab online ho'}
                  {info.state === 'error' && `${info.failedCount} items failed`}
                </span>
              </div>

              {info.lastSyncedAt && (
                <p className="text-xs text-muted-foreground">
                  Last sync: {formatDistanceToNow(new Date(info.lastSyncedAt), { addSuffix: true })}
                </p>
              )}

              {Object.keys(info.pendingByTable).length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Pending:</p>
                  {Object.entries(info.pendingByTable).map(([table, count]) => (
                    <div key={table} className="flex items-center justify-between text-xs">
                      <span className="capitalize text-foreground">{table}</span>
                      <span className="text-muted-foreground">{count} items</span>
                    </div>
                  ))}
                </div>
              )}

              {info.failedItems.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-destructive">Failed:</p>
                  {info.failedItems.slice(0, 3).map(item => (
                    <div key={item.id} className="text-xs bg-destructive/10 rounded p-2">
                      <p className="text-foreground capitalize">{item.table_name}: {item.operation}</p>
                      <p className="text-muted-foreground truncate">{item.last_error}</p>
                      <p className="text-muted-foreground">Attempts: {item.retry_count}/5</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 min-h-[36px]"
                  disabled={!navigator.onLine || info.state === 'syncing'}
                  onClick={() => syncNow(tenantId)}
                >
                  <RefreshCw className="w-3 h-3 mr-1" /> Sync Now
                </Button>
                {info.failedCount > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 min-h-[36px]"
                    onClick={retryFailed}
                  >
                    Retry Failed
                  </Button>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
