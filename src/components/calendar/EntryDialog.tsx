import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { formatLongDate } from '@/utils/dates';

import type { Emotion } from '@/types/emotion';
import type { EntryInput, EntryRecord } from '@/types/entry';

interface EntryDialogProps {
  open: boolean;
  date: string | null;
  entry: EntryRecord | null;
  emotions: Emotion[];
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (payload: EntryInput) => Promise<void>;
  onDelete: (date: string) => Promise<void>;
}

export default function EntryDialog({ open, date, entry, emotions, busy, onOpenChange, onSave, onDelete }: EntryDialogProps) {
  const [selectedIds, setSelectedIds] = useState<number[]>(entry?.emotions.map((emotion) => emotion.id) ?? []);
  const [primaryEmotionId, setPrimaryEmotionId] = useState<number | null>(entry?.primaryEmotionId ?? entry?.emotions[0]?.id ?? null);
  const [note, setNote] = useState(entry?.note ?? '');
  const [error, setError] = useState<string | null>(null);

  const selectableEmotions = emotions.filter((emotion) => emotion.active);
  const primaryOptions = selectableEmotions.filter((emotion) => selectedIds.includes(emotion.id));

  function toggleEmotion(emotionId: number) {
    setSelectedIds((current) => {
      const next = current.includes(emotionId)
        ? current.filter((id) => id !== emotionId)
        : [...current, emotionId];

      if (!next.includes(primaryEmotionId ?? -1)) {
        setPrimaryEmotionId(next[0] ?? null);
      }

      return next;
    });
  }

  async function handleSave() {
    if (!date) {
      return;
    }

    if (selectedIds.length === 0) {
      setError('Selecciona al menos una emoción.');
      return;
    }

    setError(null);
    await onSave({
      date,
      note,
      emotionIds: selectedIds,
      primaryEmotionId,
    });
  }

  async function handleDelete() {
    if (!date) {
      return;
    }

    await onDelete(date);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{date ? formatLongDate(date) : 'Registro diario'}</DialogTitle>
          <DialogDescription>Elige emociones, define una principal y añade una nota de contexto.</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <section className="space-y-3">
            <div className="space-y-1">
              <Label>Emociones del día</Label>
              <p className="text-sm text-muted-foreground">Puedes seleccionar una o varias emociones.</p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {selectableEmotions.map((emotion) => {
                const checked = selectedIds.includes(emotion.id);
                return (
                  <label
                    key={emotion.id}
                    className="flex items-center gap-3 rounded-[1.4rem] border border-border bg-white/75 px-4 py-3"
                  >
                    <Checkbox checked={checked} onCheckedChange={() => toggleEmotion(emotion.id)} />
                    <span className="size-3 rounded-full" style={{ backgroundColor: emotion.color }} aria-hidden="true" />
                    <span className="font-medium">{emotion.name}</span>
                  </label>
                );
              })}
            </div>
          </section>

          <section className="space-y-2">
            <Label htmlFor="primary-emotion">Emoción principal</Label>
            <Select
              value={primaryEmotionId ? String(primaryEmotionId) : undefined}
              onValueChange={(value) => setPrimaryEmotionId(Number(value))}
            >
              <SelectTrigger id="primary-emotion">
                <SelectValue placeholder="Selecciona la emoción principal" />
              </SelectTrigger>
              <SelectContent>
                {primaryOptions.map((emotion) => (
                  <SelectItem key={emotion.id} value={String(emotion.id)}>
                    {emotion.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </section>

          <section className="space-y-2">
            <Label htmlFor="entry-note">Nota</Label>
            <Textarea
              id="entry-note"
              value={note}
              maxLength={2400}
              placeholder="Qué pasó hoy, qué lo disparó o qué quieres recordar de este día..."
              onChange={(event) => setNote(event.target.value)}
            />
          </section>

          {error ? <p className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          {entry ? (
            <Button variant="destructive" onClick={() => void handleDelete()} disabled={busy}>
              Eliminar registro
            </Button>
          ) : null}
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={() => void handleSave()} disabled={busy}>
            Guardar registro
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}