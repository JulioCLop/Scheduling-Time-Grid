interface CaseCTAProps {
  leftLabel: string;
  leftHref: string;
  rightLabel: string;
  rightHref: string;
}

export default function CaseCTA({
  leftLabel,
  leftHref,
  rightLabel,
  rightHref,
}: CaseCTAProps) {
  const baseClasses =
    "group flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition-all hover:scale-105 active:scale-95";

  return (
    <div className="flex flex-wrap items-center gap-3">
      <a
        href={leftHref}
        className={`${baseClasses} border-cyan-400/30 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-white hover:from-cyan-500/30 hover:to-blue-500/30 hover:shadow-[0_8px_24px_rgba(34,211,238,.2)]`}
      >
        <span>{leftLabel}</span>
        <span className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 inline-block transition-transform duration-200">
          ↗
        </span>
      </a>
      <a
        href={rightHref}
        className={`${baseClasses} border-white/15 bg-white/5 text-white/90 hover:bg-white/10 hover:border-white/20`}
      >
        <span>{rightLabel}</span>
        <span className="group-hover:translate-x-1 inline-block transition-transform duration-200">
          →
        </span>
      </a>
    </div>
  );
}
