import { TrendingDown, TrendingUp } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import type { MonthlyStats as MonthlyStatsRecord } from '@/types/stats';

interface MonthlyStatsProps {
  stats: MonthlyStatsRecord[];
}

export default function MonthlyStats({ stats }: MonthlyStatsProps) {
  const maxRegisteredDays = Math.max(1, ...stats.map((month) => month.registeredDays));

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-3xl">Estadísticas mensuales</h2>
          <p className="text-sm text-muted-foreground">
            Tendencias por volumen de registro, notas y emociones predominantes a lo largo del año.
          </p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
        {stats.map((month) => (
          <Card key={month.month} className="overflow-hidden bg-white/80">
            <CardHeader className="space-y-3 pb-3">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="capitalize">{month.label}</CardTitle>
                <Badge variant="outline" className="bg-white/70">
                  {month.registeredDays} días
                </Badge>
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-[#f0e3d8]">
                <div
                  className="h-full rounded-full bg-[#8f5d3d] transition-[width]"
                  style={{ width: `${(month.registeredDays / maxRegisteredDays) * 100}%` }}
                />
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-[1.25rem] bg-background/80 p-3">
                  <p className="text-muted-foreground">Días con nota</p>
                  <p className="mt-1 text-2xl font-semibold">{month.noteDays}</p>
                </div>
                <div className="rounded-[1.25rem] bg-background/80 p-3">
                  <p className="text-muted-foreground">Promedio emociones</p>
                  <p className="mt-1 text-2xl font-semibold">{month.averageEmotionsPerDay}</p>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-[1.25rem] bg-background/80 px-4 py-3 text-sm">
                <span className="text-muted-foreground">Tendencia vs mes previo</span>
                <span
                  className={cn(
                    'inline-flex items-center gap-1 font-semibold',
                    month.trend === 'up' && 'text-emerald-700',
                    month.trend === 'down' && 'text-amber-700',
                    month.trend === 'stable' && 'text-muted-foreground',
                  )}
                >
                  {month.trend === 'up' ? <TrendingUp className="size-4" /> : null}
                  {month.trend === 'down' ? <TrendingDown className="size-4" /> : null}
                  {month.changeFromPreviousMonth === null ? 'Sin base' : `${month.changeFromPreviousMonth > 0 ? '+' : ''}${month.changeFromPreviousMonth}`}
                </span>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold">Emoción dominante</p>
                {month.dominantEmotion ? (
                  <div className="rounded-[1.25rem] border border-border bg-white/75 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span
                          className="inline-block size-3 rounded-full"
                          style={{ backgroundColor: month.dominantEmotion.color }}
                          aria-hidden="true"
                        />
                        <span className="font-medium">{month.dominantEmotion.name}</span>
                      </div>
                      <span className="text-sm text-muted-foreground">{month.dominantCount} menciones</span>
                    </div>
                  </div>
                ) : (
                  <p className="rounded-[1.25rem] border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
                    Sin registros durante este mes.
                  </p>
                )}
              </div>

              {month.emotionBreakdown.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm font-semibold">Distribución principal</p>
                  <div className="flex flex-wrap gap-2">
                    {month.emotionBreakdown.map((metric) => (
                      <span
                        key={metric.emotion.id}
                        className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-3 py-1.5 text-xs font-medium"
                      >
                        <span
                          className="inline-block size-2.5 rounded-full"
                          style={{ backgroundColor: metric.emotion.color }}
                          aria-hidden="true"
                        />
                        {metric.emotion.name}
                        <span className="text-muted-foreground">{metric.share}%</span>
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}