export default function CaseHeader({
  number,
  title,
  subtitle,
  tags,
  desc,
}: {
  number: string;
  title: string;
  subtitle: string;
  tags: string[];
  desc: string;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="text-xs uppercase tracking-[.18em] text-white/60">Case Study {number}</div>
        <h1 className="mt-2 text-[clamp(28px,3.2vw,40px)] font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-white/70">{subtitle}</p>
        <p className="mt-2 max-w-[80ch] text-white/70">{desc}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {tags.map((t) => (
          <span key={t} className="rounded-full border border-white/15 bg-white/5 px-3 py-2 text-xs text-white/80">
            {t}
          </span>
        ))}
      </div>
    </header>
  );
}
