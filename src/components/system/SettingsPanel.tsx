import { useEffect, useRef, useState } from 'react';
import { Activity, HardDriveDownload, RefreshCw, RotateCcw, WifiOff } from 'lucide-react';

import BackToCalendarLink from '@/components/navigation/BackToCalendarLink';
import SyncActionButton from '@/components/system/SyncActionButton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAutomaticSync } from '@/hooks/use-automatic-sync';
import { loadOfflineQueue, saveOfflineQueue } from '@/utils/offline-queue';
import { replayOfflineQueue } from '@/utils/offline-sync';
import { fetchJson } from '@/utils/http';

import type { MutationResult, SettingsPageData } from '@/types/api';
import type { SyncDiagnostics } from '@/types/system';
import type { OfflineOperation } from '@/utils/offline-queue';

interface SettingsPanelProps {
  initialData: SettingsPageData;
}

export default function SettingsPanel({ initialData }: SettingsPanelProps) {
  const [syncDiagnostics, setSyncDiagnostics] = useState(initialData.syncDiagnostics);
  const [syncEnabled] = useState(initialData.syncEnabled);
  const [offlineQueue, setOfflineQueue] = useState<OfflineOperation[]>([]);
  const [isOnline, setIsOnline] = useState(() => (typeof window === 'undefined' ? true : window.navigator.onLine));
  const [isBusy, setIsBusy] = useState(false);
  const [isDownloadingBackup, setIsDownloadingBackup] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const restoreInputRef = useRef<HTMLInputElement>(null);

  const hasPendingSync = offlineQueue.length > 0 || syncDiagnostics.pendingOperations > 0;

  async function refreshSyncDiagnostics() {
    const nextDiagnostics = await fetchJson<SyncDiagnostics>('/api/sync/status');
    setSyncDiagnostics(nextDiagnostics);
  }

  useEffect(() => {
    setOfflineQueue(loadOfflineQueue(initialData.userId));
  }, [initialData.userId]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  async function performAutomaticSync() {
    if (!syncEnabled || !window.navigator.onLine) {
      return;
    }

    try {
      if (offlineQueue.length > 0) {
        await replayOfflineQueue(offlineQueue);
        saveOfflineQueue([], initialData.userId);
        setOfflineQueue([]);
      }

      await fetchJson<MutationResult>('/api/sync/auto', { method: 'POST' });
      await refreshSyncDiagnostics();
    } catch {
      await refreshSyncDiagnostics().catch(() => undefined);
    }
  }

  const { scheduleAutomaticSync } = useAutomaticSync({
    enabled: syncEnabled,
    isOnline,
    onSync: performAutomaticSync,
  });

  async function handleSync() {
    setIsBusy(true);
    setError(null);
    setFeedback(null);

    try {
      if (offlineQueue.length > 0) {
        await replayOfflineQueue(offlineQueue);
        saveOfflineQueue([], initialData.userId);
        setOfflineQueue([]);
      }

      const result = await fetchJson<MutationResult>('/api/sync', { method: 'POST' });
      await refreshSyncDiagnostics();
      setFeedback(result.message);
    } catch (requestError) {
      await refreshSyncDiagnostics().catch(() => undefined);
      setError(requestError instanceof Error ? requestError.message : 'No se pudo completar la sincronización.');
    } finally {
      setIsBusy(false);
    }
  }

  async function handleRestoreFileSelection(file: File | null) {
    if (!file) {
      return;
    }

    if (offlineQueue.length > 0) {
      setError('Sincroniza o limpia primero los cambios offline antes de restaurar una base.');
      return;
    }

    setIsBusy(true);
    setError(null);
    setFeedback(null);

    try {
      const formData = new FormData();
      formData.set('file', file);
      const result = await fetchJson<MutationResult>('/api/system/restore', {
        method: 'POST',
        body: formData,
      });
      await refreshSyncDiagnostics();
      scheduleAutomaticSync(true);
      setFeedback(result.message);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo restaurar el respaldo.');
    } finally {
      setIsBusy(false);
      if (restoreInputRef.current) {
        restoreInputRef.current.value = '';
      }
    }
  }

  async function handleDownloadBackup() {
    setIsDownloadingBackup(true);
    setError(null);
    setFeedback(null);

    try {
      const response = await fetch('/api/system/backup');
      if (!response.ok) {
        let message = 'No se pudo crear el backup de SQLite.';
        try {
          const payload = await response.json() as { error?: string };
          message = payload.error ?? message;
        } catch {
          // Ignore JSON parsing failures and keep the generic message.
        }
        throw new Error(message);
      }

      const fileBlob = await response.blob();
      const contentDisposition = response.headers.get('Content-Disposition') ?? '';
      const filenameMatch = /filename="?([^";]+)"?/i.exec(contentDisposition);
      const filename = filenameMatch?.[1] ?? 'emotional-calendar-backup.sqlite';
      const downloadUrl = URL.createObjectURL(fileBlob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(downloadUrl);
      setFeedback('Respaldo descargado.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo descargar el respaldo.');
    } finally {
      setIsDownloadingBackup(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="overflow-hidden">
          <CardHeader className="space-y-3 p-6 md:p-8">
            <div className="flex justify-end">
              <BackToCalendarLink />
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-semibold">
              <span className="inline-flex items-center rounded-full bg-primary/12 px-3 py-1 text-primary">Configuración del sistema</span>
              <span className="inline-flex items-center rounded-full border border-border bg-white/75 px-3 py-1 text-foreground">
                {syncEnabled ? 'Sincronización central activa' : 'Solo almacenamiento local'}
              </span>
            </div>
            <div>
              <CardTitle className="text-5xl leading-none sm:text-6xl">Configuración</CardTitle>
              <p className="mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
                Gestiona respaldos, restauraciones y sincronización desde una vista separada del calendario principal.
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 p-6 pt-0 md:px-8 md:pb-8">
            <div className="grid gap-3 md:grid-cols-2">
              <Button onClick={() => void handleDownloadBackup()} disabled={isBusy || isDownloadingBackup}>
                {isDownloadingBackup ? <RefreshCw className="size-4 animate-spin" /> : <HardDriveDownload className="size-4" />}
                Descargar respaldo SQLite
              </Button>
              <Button variant="outline" onClick={() => restoreInputRef.current?.click()} disabled={isBusy || isDownloadingBackup}>
                <RotateCcw className="size-4" />
                Restaurar respaldo
              </Button>
            </div>
            <div className="flex flex-wrap gap-3">
              <SyncActionButton
                busy={isBusy}
                disabled={!syncEnabled || !isOnline}
                hasPendingSync={hasPendingSync}
                manualSyncAvailableAt={syncDiagnostics.manualSyncAvailableAt}
                onClick={handleSync}
              />
              <Button variant="outline" asChild>
                <a href="/estado">
                  <Activity className="size-4" />
                  Ver estado
                </a>
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              {isOnline ? 'La aplicación tiene conexión disponible para enviar y traer cambios.' : 'Sin conexión. Puedes seguir usando SQLite local y sincronizar luego.'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-6 pb-4">
            <CardTitle className="text-2xl">Resumen actual</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-6 pt-0 text-sm">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[1.4rem] bg-white/75 p-4">
                <p className="text-muted-foreground">Pendientes en SQLite</p>
                <p className="mt-1 text-2xl font-semibold">{syncDiagnostics.pendingOperations}</p>
              </div>
              <div className="rounded-[1.4rem] bg-white/75 p-4">
                <p className="text-muted-foreground">Pendientes offline</p>
                <p className="mt-1 text-2xl font-semibold">{offlineQueue.length}</p>
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-border bg-white/70 p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Instancia local</span>
                <span className="font-mono text-xs">{syncDiagnostics.instanceId ? syncDiagnostics.instanceId.slice(0, 8) : 'sin ID'}</span>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div>
                  <p className="text-muted-foreground">Último push</p>
                  <p className="font-semibold">{syncDiagnostics.lastPushAt ?? 'sin registros'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Último pull</p>
                  <p className="font-semibold">{syncDiagnostics.lastPullAt ?? 'sin registros'}</p>
                </div>
              </div>
              {syncDiagnostics.lastError ? (
                <p className="mt-3 rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive">{syncDiagnostics.lastError}</p>
              ) : null}
            </div>

            {!isOnline ? (
              <p className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                <WifiOff className="size-3.5" />
                Sin conexión
              </p>
            ) : null}
          </CardContent>
        </Card>
      </section>

      {feedback ? (
        <Card className="border-accent/50 bg-accent/35">
          <CardContent className="p-4 text-sm font-medium">{feedback}</CardContent>
        </Card>
      ) : null}
      {error ? (
        <Card className="border-destructive/40 bg-destructive/10">
          <CardContent className="p-4 text-sm font-medium text-destructive">{error}</CardContent>
        </Card>
      ) : null}

      <input
        ref={restoreInputRef}
        type="file"
        accept=".sqlite,.db,application/vnd.sqlite3"
        className="hidden"
        onChange={(event) => {
          void handleRestoreFileSelection(event.target.files?.[0] ?? null);
        }}
      />
    </div>
  );
}