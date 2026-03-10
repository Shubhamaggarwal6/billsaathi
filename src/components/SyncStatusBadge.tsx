import { useState, useEffect } from 'react';
import { onSyncChange, getSyncInfo, syncNow, retryFailed, type SyncInfo } from '@/lib/syncEngine';
import { db } from '@/lib/localDb';
import { Cloud, CloudOff, RefreshCw, AlertTriangle, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { formatDistanceToNow } from 'date-fns';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function friendlyError(err: string | undefined, t: (k: string) => string): string {
  if (!err) return t('syncErrorGeneric');
  const e = err.toLowerCase();
  if (e.includes('uuid') || e.includes('invalid input syntax')) return t('syncErrorUuid');
  if (e.includes('foreign key') || e.includes('violates')) return t('syncErrorFk');
  if (e.includes('jwt') || e.includes('token') || e.includes('auth')) return t('syncErrorJwt');
  return t('syncErrorGeneric');
}

function isRetryable(err: string | undefined): boolean {
  if (!err) return true;
  const e = err.toLowerCase();
  if (e.includes('uuid') || e.includes('invalid input syntax')) return false;
  if (e.includes('foreign key') || e.includes('violates')) return false;
  return true;
}

export default function SyncStatusBadge({ tenantId }: { tenantId?: string }) {
  const [info, setInfo] = useState<SyncInfo | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const { t } = useLanguage();
  const isMobile = useIsMobile();

  useEffect(() => {
    getSyncInfo().then(setInfo);
    return onSyncChange(setInfo);
  }, []);

  // Clean bad UUID records on mount
  useEffect(() => {
    (async () => {
      try {
        const failed = await db.sync_queue.where('status').equals('FAILED').toArray();
        const badIds = failed.filter(f => !UUID_REGEX.test(f.record_id));
        if (badIds.length > 0) {
          await Promise.all(badIds.map(b => db.sync_queue.delete(b.id)));
          getSyncInfo().then(setInfo);
        }
      } catch {}
    })();
  }, []);

  if (!info) return null;

  const icon = {
    synced: <Cloud className="w-4 h-4 text-emerald-500" />,
    syncing: <Loader2 className="w-4 h-4 text-primary animate-spin" />,
    pending: <RefreshCw className="w-4 h-4 text-amber-500" />,
    offline: <CloudOff className="w-4 h-4 text-muted-foreground" />,
    error: <AlertTriangle className="w-4 h-4 text-destructive" />,
  }[info.state];

  const labelText = {
    synced: t('synced'),
    syncing: t('syncing'),
    pending: t('pendingSync').replace('{count}', String(info.pendingCount)),
    offline: t('offline'),
    error: t('syncFailed').replace('{count}', String(info.failedCount)),
  }[info.state];

  const dismissItem = async (id: string) => {
    await db.sync_queue.delete(id);
    getSyncInfo().then(setInfo);
  };

  return (
    <>
      <button
        onClick={() => setPanelOpen(true)}
        className="relative flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-muted/50 transition-colors shrink-0 min-w-[32px] min-h-[32px]"
        title={labelText}
      >
        {icon}
        {!isMobile && <span className="text-xs font-medium text-foreground whitespace-nowrap">{labelText}</span>}
        {(info.pendingCount > 0 || info.failedCount > 0) && (
          <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
            {info.pendingCount + info.failedCount}
          </span>
        )}
      </button>

      {panelOpen && (
        <>
          <div className="fixed inset-0 bg-foreground/30 z-50" onClick={() => setPanelOpen(false)} />
          <div className={`fixed z-50 bg-card border shadow-lg animate-in duration-200 ${
            isMobile
              ? 'bottom-0 left-0 right-0 rounded-t-2xl slide-in-from-bottom-2 max-h-[70vh] overflow-y-auto'
              : 'top-14 right-4 w-80 max-w-[calc(100vw-2rem)] rounded-xl slide-in-from-top-2 max-h-[400px] overflow-y-auto'
          }`}>
            {isMobile && (
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
              </div>
            )}
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                🔄 {t('syncStatus')}
              </h3>
              <button onClick={() => setPanelOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                {icon}
                <span className="text-sm text-foreground">
                  {info.state === 'synced' && t('allDataSynced')}
                  {info.state === 'syncing' && t('syncInProgress')}
                  {info.state === 'pending' && t('changesPendingSync').replace('{count}', String(info.pendingCount))}
                  {info.state === 'offline' && t('offlineWillSync')}
                  {info.state === 'error' && t('itemsFailed').replace('{count}', String(info.failedCount))}
                </span>
              </div>

              {info.lastSyncedAt && (
                <p className="text-xs text-muted-foreground">
                  {t('lastSync')}: {formatDistanceToNow(new Date(info.lastSyncedAt), { addSuffix: true })}
                </p>
              )}

              {Object.keys(info.pendingByTable).length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">{t('pendingLabel2')}</p>
                  {Object.entries(info.pendingByTable).map(([table, count]) => (
                    <div key={table} className="flex items-center justify-between text-xs">
                      <span className="capitalize text-foreground">{table}</span>
                      <span className="text-muted-foreground">{count} {t('items')}</span>
                    </div>
                  ))}
                </div>
              )}

              {info.failedItems.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-destructive">{t('failedLabel')}</p>
                  {info.failedItems.slice(0, 5).map(item => {
                    const retryable = isRetryable(item.last_error);
                    return (
                      <div key={item.id} className="text-xs bg-destructive/10 rounded p-2 space-y-1">
                        <p className="text-foreground capitalize font-medium">{item.table_name}: {item.operation}</p>
                        <p className="text-muted-foreground">{friendlyError(item.last_error, t)}</p>
                        <p className="text-muted-foreground">{t('attempts')}: {item.retry_count}/5</p>
                        <div className="flex gap-1 pt-1">
                          {retryable ? (
                            <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => retryFailed()}>
                              {t('retryFailed')}
                            </Button>
                          ) : (
                            <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={() => dismissItem(item.id)}>
                              {t('dismiss')}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
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
                  <RefreshCw className="w-3 h-3 mr-1" /> {t('syncNow')}
                </Button>
                {info.failedCount > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 min-h-[36px]"
                    onClick={retryFailed}
                  >
                    {t('retryFailed')}
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
