import { useEffect, useEffectEvent, useRef, useState, useTransition } from 'react';

import AnnualCalendar from '@/components/calendar/AnnualCalendar';
import EmotionManagerDialog from '@/components/calendar/EmotionManagerDialog';
import EntryDialog from '@/components/calendar/EntryDialog';
import ExportSnapshot from '@/components/calendar/ExportSnapshot';
import FilterToolbar from '@/components/calendar/FilterToolbar';
import { Card, CardContent } from '@/components/ui/card';
import { useAutomaticSync } from '@/hooks/use-automatic-sync';
import { exportCalendarImage, exportCalendarPdf } from '@/services/export-service';
import {
  applyOfflineOperation,
  applyOfflineQueue,
  createOfflineOperation,
  createTemporaryEmotionId,
  loadOfflineQueue,
  saveOfflineQueue,
} from '@/utils/offline-queue';
import { replayOfflineQueue } from '@/utils/offline-sync';
import { fetchJson } from '@/utils/http';
import { buildCalendarMonths, formatIsoDate } from '@/utils/dates';

import type { CalendarInitialData, MutationResult } from '@/types/api';
import type { Emotion, EmotionInput } from '@/types/emotion';
import type { EntryInput, EntryRecord } from '@/types/entry';
import type { SyncDiagnostics } from '@/types/system';
import type { OfflineOperation } from '@/utils/offline-queue';

interface CalendarAppProps {
  initialData: CalendarInitialData;
}

function hasMatchingEmotion(entry: EntryRecord, filters: number[]) {
  return entry.emotions.some((emotion) => filters.includes(emotion.id));
}

function isRecoverableOfflineError(error: unknown) {
  return (typeof window !== 'undefined' && !window.navigator.onLine) || error instanceof TypeError;
}

export default function CalendarApp({ initialData }: CalendarAppProps) {
  const [year, setYear] = useState(initialData.year);
  const [entries, setEntries] = useState(initialData.entries);
  const [emotions, setEmotions] = useState(initialData.emotions);
  const [syncDiagnostics, setSyncDiagnostics] = useState(initialData.syncDiagnostics);
  const [selectedFilters, setSelectedFilters] = useState<number[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [entryDialogOpen, setEntryDialogOpen] = useState(false);
  const [emotionDialogOpen, setEmotionDialogOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [isExportingImage, setIsExportingImage] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isOnline, setIsOnline] = useState(() => (typeof window === 'undefined' ? true : window.navigator.onLine));
  const [offlineQueue, setOfflineQueue] = useState<OfflineOperation[]>([]);
  const [isPending, startTransition] = useTransition();
  const exportRef = useRef<HTMLDivElement>(null);
  const todayDate = formatIsoDate(new Date());

  const months = buildCalendarMonths(year, entries);
  const selectedEntry = selectedDate ? entries.find((entry) => entry.date === selectedDate) ?? null : null;
  const totalNotes = entries.filter((entry) => entry.note.trim().length > 0).length;
  const filteredEntries = selectedFilters.length > 0
    ? entries.filter((entry) => hasMatchingEmotion(entry, selectedFilters)).length
    : entries.length;
  const hasPendingSync = offlineQueue.length > 0 || syncDiagnostics.pendingOperations > 0;

  function syncEntryState(nextEntries: EntryRecord[]) {
    setEntries(nextEntries);
  }

  function persistQueue(nextQueue: OfflineOperation[]) {
    saveOfflineQueue(nextQueue, initialData.userId);
    setOfflineQueue(nextQueue);
  }

  function enqueueOfflineOperation(operation: OfflineOperation) {
    setOfflineQueue((current) => {
      const nextQueue = [...current, operation];
      saveOfflineQueue(nextQueue, initialData.userId);
      return nextQueue;
    });
  }

  function applyLocalOperation(operation: OfflineOperation, successMessage: string) {
    const nextState = applyOfflineOperation({ entries, emotions }, operation);
    setEmotions(nextState.emotions);
    syncEntryState(nextState.entries);
    enqueueOfflineOperation(operation);
    setFeedback(successMessage);
    setError(null);
  }

  async function refreshCalendarData(nextYear: number) {
    const [nextEntries, nextEmotions] = await Promise.all([
      fetchJson<EntryRecord[]>(`/api/entries?year=${nextYear}`),
      fetchJson<Emotion[]>('/api/emotions'),
    ]);

    startTransition(() => {
      setYear(nextYear);
      setEntries(nextEntries);
      setEmotions(nextEmotions);
      setSelectedDate(null);
      setEntryDialogOpen(false);
      setSelectedFilters((current) => current.filter((emotionId) => nextEmotions.some((emotion) => emotion.id === emotionId)));
    });
  }

  async function refreshSyncDiagnostics() {
    const nextDiagnostics = await fetchJson<SyncDiagnostics>('/api/sync/status');
    setSyncDiagnostics(nextDiagnostics);
  }

  async function flushOfflineQueue(queueToFlush = offlineQueue, options?: { silent?: boolean }) {
    if (queueToFlush.length === 0 || !window.navigator.onLine) {
      return;
    }

    setIsBusy(true);
    setError(null);

    try {
      await replayOfflineQueue(queueToFlush);

      persistQueue([]);
      await refreshCalendarData(year);
      await refreshSyncDiagnostics();
      if (!options?.silent) {
        setFeedback('Cambios offline sincronizados.');
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudieron sincronizar los cambios offline.');
    } finally {
      setIsBusy(false);
    }
  }

  const handleOnlineSync = useEffectEvent(async () => {
    await flushOfflineQueue();
  });

  const hydrateOfflineState = useEffectEvent(() => {
    const storedQueue = loadOfflineQueue(initialData.userId);
    if (storedQueue.length === 0) {
      return;
    }

    const nextState = applyOfflineQueue(
      {
        entries: initialData.entries,
        emotions: initialData.emotions,
      },
      storedQueue,
    );
    setOfflineQueue(storedQueue);
    setEmotions(nextState.emotions);
    setEntries(nextState.entries);
  });

  useEffect(() => {
    hydrateOfflineState();
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      void handleOnlineSync();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  async function performAutomaticSync() {
    if (!initialData.syncEnabled || !window.navigator.onLine) {
      return;
    }

    try {
      if (offlineQueue.length > 0) {
        await flushOfflineQueue(offlineQueue, { silent: true });
      }

      await fetchJson<MutationResult>('/api/sync/auto', { method: 'POST' });
      await refreshCalendarData(year);
      await refreshSyncDiagnostics();
    } catch {
      await refreshSyncDiagnostics().catch(() => undefined);
    }
  }

  const { scheduleAutomaticSync } = useAutomaticSync({
    enabled: initialData.syncEnabled,
    isOnline,
    onSync: performAutomaticSync,
  });

  async function handleYearChange(nextYear: number) {
    if (!window.navigator.onLine) {
      setError('No puedes cambiar de año mientras estás offline.');
      return;
    }

    setError(null);
    setFeedback(null);
    setIsBusy(true);

    try {
      await refreshCalendarData(nextYear);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo cambiar de año.');
    } finally {
      setIsBusy(false);
    }
  }

  async function handleOpenTodayEntry() {
    const nextYear = Number.parseInt(todayDate.slice(0, 4), 10);

    setError(null);
    setFeedback(null);

    if (year !== nextYear) {
      if (!window.navigator.onLine) {
        setError('No puedes saltar al año actual mientras estás offline.');
        return;
      }

      setIsBusy(true);
      try {
        await refreshCalendarData(nextYear);
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : 'No se pudo abrir el registro de hoy.');
        return;
      } finally {
        setIsBusy(false);
      }
    }

    setSelectedDate(todayDate);
    setEntryDialogOpen(true);
  }

  async function handleSaveEntry(payload: EntryInput) {
    setIsBusy(true);
    setError(null);

    try {
      const saved = await fetchJson<EntryRecord>('/api/entries', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const nextEntries = (() => {
        const withoutCurrent = entries.filter((entry) => entry.date !== saved.date);
        return [...withoutCurrent, saved].sort((left, right) => left.date.localeCompare(right.date));
      })();
      syncEntryState(nextEntries);
      await refreshSyncDiagnostics();
      scheduleAutomaticSync();
      setFeedback('Registro guardado.');
      setEntryDialogOpen(false);
    } catch (requestError) {
      if (isRecoverableOfflineError(requestError)) {
        const operation = createOfflineOperation({ kind: 'save-entry', payload });
        applyLocalOperation(operation, 'Registro guardado localmente. Se sincronizará cuando vuelva la conexión.');
        setEntryDialogOpen(false);
      } else {
        setError(requestError instanceof Error ? requestError.message : 'No se pudo guardar el registro.');
      }
    } finally {
      setIsBusy(false);
    }
  }

  async function handleDeleteEntry(date: string) {
    setIsBusy(true);
    setError(null);

    try {
      await fetchJson<{ success: boolean }>(`/api/entries?date=${date}`, { method: 'DELETE' });
      syncEntryState(entries.filter((entry) => entry.date !== date));
      await refreshSyncDiagnostics();
      scheduleAutomaticSync();
      setFeedback('Registro eliminado.');
      setEntryDialogOpen(false);
    } catch (requestError) {
      if (isRecoverableOfflineError(requestError)) {
        applyLocalOperation(
          createOfflineOperation({ kind: 'delete-entry', payload: { date } }),
          'Eliminación guardada localmente. Se sincronizará cuando vuelva la conexión.',
        );
        setEntryDialogOpen(false);
      } else {
        setError(requestError instanceof Error ? requestError.message : 'No se pudo eliminar el registro.');
      }
    } finally {
      setIsBusy(false);
    }
  }

  async function handleCreateEmotion(input: EmotionInput) {
    setIsBusy(true);
    setError(null);

    try {
      const created = await fetchJson<Emotion>('/api/emotions', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      setEmotions((current) => [...current, created].sort((left, right) => left.name.localeCompare(right.name)));
      await refreshSyncDiagnostics();
      scheduleAutomaticSync();
      setFeedback('Emoción creada.');
    } catch (requestError) {
      if (isRecoverableOfflineError(requestError)) {
        const operation = createOfflineOperation({
          kind: 'create-emotion',
          payload: {
            clientId: createTemporaryEmotionId(emotions, offlineQueue),
            input,
          },
        });
        applyLocalOperation(operation, 'Emoción creada localmente. Se sincronizará cuando vuelva la conexión.');
      } else {
        setError(requestError instanceof Error ? requestError.message : 'No se pudo crear la emoción.');
      }
    } finally {
      setIsBusy(false);
    }
  }

  async function handleUpdateEmotion(id: number, input: EmotionInput) {
    setIsBusy(true);
    setError(null);

    try {
      const updated = await fetchJson<Emotion>(`/api/emotions/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      });
      setEmotions((current) => current.map((emotion) => (emotion.id === id ? updated : emotion)));
      const nextEntries = entries.map((entry) => ({
        ...entry,
        emotions: entry.emotions.map((emotion) =>
          emotion.id === id ? { id: updated.id, syncId: updated.syncId, name: updated.name, slug: updated.slug, color: updated.color } : emotion,
        ),
        primaryColor: entry.primaryEmotionId === id ? updated.color : entry.primaryColor,
      }));
      syncEntryState(nextEntries);
      await refreshSyncDiagnostics();
      scheduleAutomaticSync();
      setFeedback('Emoción actualizada.');
    } catch (requestError) {
      if (isRecoverableOfflineError(requestError)) {
        applyLocalOperation(
          createOfflineOperation({ kind: 'update-emotion', payload: { id, input } }),
          'Cambio de emoción guardado localmente. Se sincronizará cuando vuelva la conexión.',
        );
      } else {
        setError(requestError instanceof Error ? requestError.message : 'No se pudo actualizar la emoción.');
      }
    } finally {
      setIsBusy(false);
    }
  }

  async function handleDeleteEmotion(id: number) {
    setIsBusy(true);
    setError(null);

    try {
      const result = await fetchJson<{ deleted: boolean; reason?: string }>(`/api/emotions/${id}`, {
        method: 'DELETE',
      });
      const nextEmotions = await fetchJson<Emotion[]>('/api/emotions');
      setEmotions(nextEmotions);
      setSelectedFilters((current) => current.filter((emotionId) => emotionId !== id));
      await refreshSyncDiagnostics();
      scheduleAutomaticSync();
      setFeedback(result.reason ?? 'Emoción eliminada.');
    } catch (requestError) {
      if (isRecoverableOfflineError(requestError)) {
        applyLocalOperation(
          createOfflineOperation({ kind: 'delete-emotion', payload: { id } }),
          'Cambio de emoción guardado localmente. Se sincronizará cuando vuelva la conexión.',
        );
        setSelectedFilters((current) => current.filter((emotionId) => emotionId !== id));
      } else {
        setError(requestError instanceof Error ? requestError.message : 'No se pudo eliminar la emoción.');
      }
    } finally {
      setIsBusy(false);
    }
  }

  function handleToggleFilter(emotionId: number) {
    setSelectedFilters((current) =>
      current.includes(emotionId) ? current.filter((id) => id !== emotionId) : [...current, emotionId],
    );
  }

  async function handleExportImage() {
    if (!exportRef.current) {
      setError('No se pudo preparar la vista de exportacion.');
      return;
    }

    setIsExportingImage(true);
    setError(null);

    try {
      await exportCalendarImage(exportRef.current, year);
      setFeedback('Imagen exportada.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo exportar la imagen.');
    } finally {
      setIsExportingImage(false);
    }
  }

  async function handleExportPdf() {
    if (!exportRef.current) {
      setError('No se pudo preparar la vista de exportacion.');
      return;
    }

    setIsExportingPdf(true);
    setError(null);

    try {
      await exportCalendarPdf(exportRef.current, year, entries);
      setFeedback('PDF exportado.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo exportar el PDF.');
    } finally {
      setIsExportingPdf(false);
    }
  }

  async function handleSync() {
    setIsBusy(true);
    setError(null);

    try {
      if (offlineQueue.length > 0) {
        await flushOfflineQueue();
      }

      const result = await fetchJson<MutationResult>('/api/sync', { method: 'POST' });
      await refreshCalendarData(year);
      await refreshSyncDiagnostics();
      setFeedback(result.message);
    } catch (requestError) {
      await refreshSyncDiagnostics().catch(() => undefined);
      setError(requestError instanceof Error ? requestError.message : 'No se pudo completar la sincronizacion.');
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <FilterToolbar
        year={year}
        emotions={emotions}
        selectedFilters={selectedFilters}
        isLoading={isBusy || isPending}
        isExportingImage={isExportingImage}
        isExportingPdf={isExportingPdf}
        isOnline={isOnline}
        syncEnabled={initialData.syncEnabled}
        hasPendingSync={hasPendingSync}
        manualSyncAvailableAt={syncDiagnostics.manualSyncAvailableAt}
        totalEntries={entries.length}
        totalNotes={totalNotes}
        filteredEntries={filteredEntries}
        onChangeYear={(nextYear) => {
          void handleYearChange(nextYear);
        }}
        onToggleFilter={handleToggleFilter}
        onClearFilters={() => setSelectedFilters([])}
        onOpenEmotionManager={() => setEmotionDialogOpen(true)}
        onOpenTodayEntry={handleOpenTodayEntry}
        onExportImage={handleExportImage}
        onExportPdf={handleExportPdf}
        onSync={handleSync}
      />

      {feedback ? (
        <Card className="mt-6 border-accent/50 bg-accent/35">
          <CardContent className="p-4 text-sm font-medium">{feedback}</CardContent>
        </Card>
      ) : null}
      {error ? (
        <Card className="mt-4 border-destructive/40 bg-destructive/10">
          <CardContent className="p-4 text-sm font-medium text-destructive">{error}</CardContent>
        </Card>
      ) : null}

      <section className="mt-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-3xl">Vista anual</h2>
            <p className="text-sm text-muted-foreground">Pulsa cualquier día para registrar emociones y notas. El mes actual y el día de hoy quedan resaltados para orientarte más rápido.</p>
          </div>
        </div>

        <AnnualCalendar
          months={months}
          filters={selectedFilters}
          currentDate={todayDate.startsWith(`${year}`) ? todayDate : null}
          selectedDate={selectedDate}
          onSelectDate={(date) => {
            setSelectedDate(date);
            setEntryDialogOpen(true);
          }}
        />
      </section>

      <EntryDialog
        key={`${selectedDate ?? 'empty'}-${selectedEntry?.updatedAt ?? 'new'}`}
        open={entryDialogOpen}
        date={selectedDate}
        entry={selectedEntry}
        emotions={emotions}
        busy={isBusy}
        onOpenChange={setEntryDialogOpen}
        onSave={handleSaveEntry}
        onDelete={handleDeleteEntry}
      />

      <EmotionManagerDialog
        key={emotions.map((emotion) => `${emotion.id}:${emotion.updatedAt}:${emotion.active ? '1' : '0'}`).join('|')}
        open={emotionDialogOpen}
        emotions={emotions}
        busy={isBusy}
        onOpenChange={setEmotionDialogOpen}
        onCreate={handleCreateEmotion}
        onUpdate={handleUpdateEmotion}
        onDelete={handleDeleteEmotion}
      />

      <div className="pointer-events-none fixed left-[-9999px] top-0" aria-hidden="true">
        <div ref={exportRef}>
          <ExportSnapshot year={year} months={months} emotions={emotions} />
        </div>
      </div>
    </main>
  );
}