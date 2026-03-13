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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import type { Emotion, EmotionInput } from '@/types/emotion';

interface EmotionManagerDialogProps {
  open: boolean;
  emotions: Emotion[];
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (input: EmotionInput) => Promise<void>;
  onUpdate: (id: number, input: EmotionInput) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

export default function EmotionManagerDialog({
  open,
  emotions,
  busy,
  onOpenChange,
  onCreate,
  onUpdate,
  onDelete,
}: EmotionManagerDialogProps) {
  const [drafts, setDrafts] = useState<Record<number, EmotionInput>>(
    Object.fromEntries(
      emotions.map((emotion) => [
        emotion.id,
        {
          name: emotion.name,
          color: emotion.color,
          active: emotion.active,
        },
      ]),
    ),
  );
  const [newEmotion, setNewEmotion] = useState<EmotionInput>({ name: '', color: '#f59e0b', active: true });

  function updateDraft(id: number, patch: Partial<EmotionInput>) {
    setDrafts((current) => ({
      ...current,
      [id]: {
        ...current[id],
        ...patch,
      },
    }));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gestionar emociones</DialogTitle>
          <DialogDescription>Crea emociones nuevas, ajusta su color y desactiva las que no necesites.</DialogDescription>
        </DialogHeader>

        <div className="space-y-8">
          <section className="space-y-4 rounded-[1.75rem] border border-border bg-white/70 p-4">
            <div className="space-y-1">
              <Label>Nueva emoción</Label>
              <p className="text-sm text-muted-foreground">El catálogo se puede ampliar sin tocar el núcleo de la aplicación.</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-[1fr_120px_auto]">
              <Input
                value={newEmotion.name}
                placeholder="Ej. alivio"
                onChange={(event) => setNewEmotion((current) => ({ ...current, name: event.target.value }))}
              />
              <Input
                type="color"
                value={newEmotion.color}
                onChange={(event) => setNewEmotion((current) => ({ ...current, color: event.target.value }))}
              />
              <Button
                onClick={() =>
                  void onCreate(newEmotion).then(() => {
                    setNewEmotion({ name: '', color: '#f59e0b', active: true });
                  })
                }
                disabled={busy}
              >
                Crear emoción
              </Button>
            </div>
          </section>

          <section className="space-y-3">
            {emotions.map((emotion) => {
              const draft = drafts[emotion.id] ?? { name: emotion.name, color: emotion.color, active: emotion.active };
              return (
                <div key={emotion.id} className="rounded-[1.75rem] border border-border bg-white/70 p-4">
                  <div className="grid gap-4 lg:grid-cols-[1fr_120px_auto_auto_auto] lg:items-center">
                    <div className="space-y-2">
                      <Label htmlFor={`emotion-name-${emotion.id}`}>Nombre</Label>
                      <Input
                        id={`emotion-name-${emotion.id}`}
                        value={draft.name}
                        onChange={(event) => updateDraft(emotion.id, { name: event.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`emotion-color-${emotion.id}`}>Color</Label>
                      <Input
                        id={`emotion-color-${emotion.id}`}
                        type="color"
                        value={draft.color}
                        onChange={(event) => updateDraft(emotion.id, { color: event.target.value })}
                      />
                    </div>

                    <label className="flex items-center gap-3 rounded-[1.25rem] border border-border bg-background px-4 py-3">
                      <Checkbox
                        checked={draft.active ?? true}
                        onCheckedChange={(checked) => updateDraft(emotion.id, { active: Boolean(checked) })}
                      />
                      <span className="text-sm font-medium">Activa</span>
                    </label>

                    <Button variant="outline" onClick={() => void onUpdate(emotion.id, draft)} disabled={busy}>
                      Guardar
                    </Button>

                    <Button variant="destructive" onClick={() => void onDelete(emotion.id)} disabled={busy || emotion.isSystem}>
                      {emotion.isSystem ? 'Base' : 'Eliminar'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}