interface BackToCalendarLinkProps {
  href?: string;
}

export default function BackToCalendarLink({ href = '/' }: BackToCalendarLinkProps) {
  return (
    <a
      href={href}
      className="inline-flex h-11 items-center justify-center rounded-full border border-border bg-white/70 px-5 text-sm font-semibold text-foreground transition-all duration-150 hover:-translate-y-0.5 hover:bg-white active:translate-y-px active:scale-[0.98]"
    >
      Volver al calendario
    </a>
  );
}