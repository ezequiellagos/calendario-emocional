import { Badge } from '@/components/ui/badge';

import AnnualCalendar from '@/components/calendar/AnnualCalendar';

import type { CalendarMonth } from '@/types/entry';
import type { Emotion } from '@/types/emotion';

interface ExportSnapshotProps {
  year: number;
  months: CalendarMonth[];
  emotions: Emotion[];
}

export default function ExportSnapshot({ year, months, emotions }: ExportSnapshotProps) {
  const activeEmotions = emotions.filter((emotion) => emotion.active);

  return (
    <div className="w-[1400px] bg-[#fffaf4] px-8 py-6 text-[#3d2a1f]">
      <div className="mb-5 flex items-start justify-between gap-6">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#8f5d3d]">Calendario emocional</p>
          <div className="flex items-end gap-4">
            <h2 className="text-5xl leading-none">Resumen {year}</h2>
            <p className="pb-1 text-sm text-[#6e5c4e]">Vista anual optimizada para impresión en A4 horizontal</p>
          </div>
        </div>
        <div className="flex max-w-[520px] flex-wrap justify-end gap-1.5">
          {activeEmotions.slice(0, 8).map((emotion) => (
            <Badge key={emotion.id} variant="outline" className="border-[#ecdccf] bg-white px-2.5 py-1 text-[11px] text-[#3d2a1f]">
              <span className="mr-2 inline-block size-2.5 rounded-full" style={{ backgroundColor: emotion.color }} aria-hidden="true" />
              {emotion.name}
            </Badge>
          ))}
          {activeEmotions.length > 8 ? (
            <Badge variant="outline" className="border-[#ecdccf] bg-white px-2.5 py-1 text-[11px] text-[#6e5c4e]">
              +{activeEmotions.length - 8} emociones
            </Badge>
          ) : null}
        </div>
      </div>

      <AnnualCalendar months={months} filters={[]} exportMode />
    </div>
  );
}