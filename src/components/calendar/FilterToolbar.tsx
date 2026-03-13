import { Activity, BarChart3, Download, FileText, FilterX, Palette, Plus, RefreshCw, Settings2, WifiOff } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import SyncActionButton from '@/components/system/SyncActionButton';

import type { Emotion } from '@/types/emotion';

interface FilterToolbarProps {
  year: number;
  emotions: Emotion[];
  selectedFilters: number[];
  isLoading: boolean;
  isExportingImage: boolean;
  isExportingPdf: boolean;
  isOnline: boolean;
  syncEnabled: boolean;
  hasPendingSync: boolean;
  manualSyncAvailableAt: string | null;
  totalEntries: number;
  totalNotes: number;
  filteredEntries: number;
  onChangeYear: (year: number) => void;
  onToggleFilter: (emotionId: number) => void;
  onClearFilters: () => void;
  onOpenEmotionManager: () => void;
  onOpenTodayEntry: () => Promise<void>;
  onExportImage: () => Promise<void>;
  onExportPdf: () => Promise<void>;
  onSync: () => Promise<void>;
}

export default function FilterToolbar({
  year,
  emotions,
  selectedFilters,
  isLoading,
  isExportingImage,
  isExportingPdf,
  isOnline,
  syncEnabled,
  hasPendingSync,
  manualSyncAvailableAt,
  totalEntries,
  totalNotes,
  filteredEntries,
  onChangeYear,
  onToggleFilter,
  onClearFilters,
  onOpenEmotionManager,
  onOpenTodayEntry,
  onExportImage,
  onExportPdf,
  onSync,
}: FilterToolbarProps) {
  const activeEmotions = emotions.filter((emotion) => emotion.active);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-[1.4fr_0.9fr]">
        <Card className="overflow-hidden">
          <CardContent className="space-y-6 p-6 md:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Badge className="w-fit bg-primary/12 text-primary">Registro diario y exportable</Badge>
                  <Badge variant="outline" className={isOnline ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-amber-300 bg-amber-50 text-amber-700'}>
                    {isOnline ? 'Online' : 'Offline'}
                  </Badge>
                </div>
                <div className="space-y-2">
                  <h1 className="max-w-3xl text-5xl leading-none sm:text-6xl">Calendario emocional</h1>
                  <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
                    Registra una o varias emociones por día, añade notas, trabaja sin conexión y genera exportaciones limpias en imagen o PDF.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button onClick={() => void onOpenTodayEntry()}>
                  <Plus className="size-4" />
                  Registrar hoy
                </Button>
                <Button variant="outline" asChild>
                  <a href="/estadisticas">
                    <BarChart3 className="size-4" />
                    Ver estadísticas
                  </a>
                </Button>
                <Button variant="outline" asChild>
                  <a href="/estado">
                    <Activity className="size-4" />
                    Ver estado
                  </a>
                </Button>
                <Button variant="outline" asChild>
                  <a href="/configuracion">
                    <Settings2 className="size-4" />
                    Configuración
                  </a>
                </Button>
                <Button variant="outline" onClick={onOpenEmotionManager}>
                  <Palette className="size-4" />
                  Gestionar emociones
                </Button>
                <Button variant="outline" onClick={() => void onExportImage()} disabled={isExportingImage || isExportingPdf}>
                  {isExportingImage ? <RefreshCw className="size-4 animate-spin" /> : <Download className="size-4" />}
                  Exportar imagen
                </Button>
                <Button variant="outline" onClick={() => void onExportPdf()} disabled={isExportingImage || isExportingPdf}>
                  {isExportingPdf ? <RefreshCw className="size-4 animate-spin" /> : <FileText className="size-4" />}
                  Exportar PDF
                </Button>
                <SyncActionButton
                  busy={isLoading}
                  disabled={!syncEnabled || !isOnline}
                  hasPendingSync={hasPendingSync}
                  manualSyncAvailableAt={manualSyncAvailableAt}
                  onClick={onSync}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-[1.5rem] bg-white/75 p-4">
                <p className="text-sm text-muted-foreground">Días registrados</p>
                <p className="mt-2 text-3xl font-semibold">{totalEntries}</p>
              </div>
              <div className="rounded-[1.5rem] bg-white/75 p-4">
                <p className="text-sm text-muted-foreground">Días con nota</p>
                <p className="mt-2 text-3xl font-semibold">{totalNotes}</p>
              </div>
              <div className="rounded-[1.5rem] bg-white/75 p-4">
                <p className="text-sm text-muted-foreground">Coinciden con filtros</p>
                <p className="mt-2 text-3xl font-semibold">{selectedFilters.length > 0 ? filteredEntries : totalEntries}</p>
              </div>
              <div className="rounded-[1.5rem] bg-white/75 p-4">
                <p className="text-sm text-muted-foreground">Estado de sincronización</p>
                <p className="mt-2 flex items-center gap-2 text-lg font-semibold">
                  {isOnline ? null : <WifiOff className="size-4" />}
                  {syncEnabled ? 'Mongo central activo' : 'Solo local'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-5 p-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-muted-foreground">Año visible</p>
              {isLoading ? <RefreshCw className="size-4 animate-spin text-muted-foreground" /> : null}
            </div>

            <div className="flex items-center gap-3">
              <Button variant="outline" size="icon" aria-label="Año anterior" onClick={() => onChangeYear(year - 1)}>
                <span aria-hidden="true">-</span>
              </Button>
              <div className="flex-1 rounded-[1.5rem] bg-white/75 px-4 py-3 text-center text-3xl font-semibold">{year}</div>
              <Button variant="outline" size="icon" aria-label="Año siguiente" onClick={() => onChangeYear(year + 1)}>
                <span aria-hidden="true">+</span>
              </Button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold">Filtros por emoción</p>
                <Button variant="ghost" size="sm" onClick={onClearFilters}>
                  <FilterX className="size-4" />
                  Limpiar
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                {activeEmotions.map((emotion) => {
                  const selected = selectedFilters.includes(emotion.id);
                  return (
                    <button
                      key={emotion.id}
                      type="button"
                      onClick={() => onToggleFilter(emotion.id)}
                      className={selected ? 'rounded-full border border-transparent px-3 py-1.5 text-xs font-semibold text-white shadow-sm' : 'rounded-full border border-border bg-white/75 px-3 py-1.5 text-xs font-semibold text-foreground'}
                      style={selected ? { backgroundColor: emotion.color } : undefined}
                    >
                      {emotion.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}