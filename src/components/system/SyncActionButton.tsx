import { RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SyncActionButtonProps {
  busy?: boolean;
  disabled?: boolean;
  hasPendingSync: boolean;
  manualSyncAvailableAt?: string | null;
  label?: string;
  className?: string;
  onClick: () => void | Promise<void>;
}

function formatRemainingTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export default function SyncActionButton({
  busy = false,
  disabled = false,
  hasPendingSync,
  manualSyncAvailableAt = null,
  label = 'Sincronizar',
  className,
  onClick,
}: SyncActionButtonProps) {
  const [now, setNow] = useState(() => Date.now());
  const cooldownEndsAt = manualSyncAvailableAt ? Date.parse(manualSyncAvailableAt) : Number.NaN;
  const remainingSeconds = Number.isNaN(cooldownEndsAt) ? 0 : Math.max(0, Math.ceil((cooldownEndsAt - now) / 1000));
  const cooldownActive = remainingSeconds > 0;
  const effectiveDisabled = disabled || busy || cooldownActive;

  useEffect(() => {
    if (!cooldownActive) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [cooldownActive]);

  const indicatorClassName = effectiveDisabled
    ? 'bg-zinc-400'
    : hasPendingSync
      ? 'bg-red-500 shadow-[0_0_0_4px_rgba(239,68,68,0.15)]'
      : 'bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.14)]';
  const buttonLabel = cooldownActive ? `Disponible en ${formatRemainingTime(remainingSeconds)}` : label;

  return (
    <Button variant="outline" className={cn('relative pr-10', className)} onClick={() => void onClick()} disabled={effectiveDisabled}>
      <RefreshCw className={cn('size-4', busy ? 'animate-spin' : '')} />
      {buttonLabel}
      <span className={cn('absolute right-3 top-1/2 size-2.5 -translate-y-1/2 rounded-full', indicatorClassName)} aria-hidden="true" />
      <span className="sr-only">{hasPendingSync ? 'Hay cambios pendientes por sincronizar' : 'Sincronización al día'}</span>
    </Button>
  );
}