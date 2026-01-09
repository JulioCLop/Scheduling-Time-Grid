"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import CaseHeader from "@/components/ui/CaseHeader";
import CaseCTA from "@/components/ui/CaseCTA";

type Appt = {
  id: string;
  title: string;
  date: string; // ISO date string (YYYY-MM-DD)
  startMin: number; // minutes from 00:00
  endMin: number;
  location?: string;
  color?: "slate" | "cyan" | "violet" | "emerald" | "rose";
};

type Mode = "create" | "edit";

const HOUR_START = 7; // 7am
const HOUR_END = 19; // 7pm
const SLOT = 15; // minutes per grid row
const DEFAULT_DURATION = 30;

const COLORS: Record<NonNullable<Appt["color"]>, { chip: string; bg: string; border: string }> = {
  slate: { chip: "bg-slate-400/40", bg: "bg-gradient-to-br from-slate-500/10 to-slate-600/15", border: "border-slate-400/25" },
  cyan: { chip: "bg-cyan-400/50", bg: "bg-gradient-to-br from-cyan-500/15 to-blue-500/20", border: "border-cyan-400/35" },
  violet: { chip: "bg-violet-400/50", bg: "bg-gradient-to-br from-violet-500/15 to-purple-500/20", border: "border-violet-400/35" },
  emerald: { chip: "bg-emerald-400/50", bg: "bg-gradient-to-br from-emerald-500/15 to-teal-500/20", border: "border-emerald-400/35" },
  rose: { chip: "bg-rose-400/50", bg: "bg-gradient-to-br from-rose-500/15 to-pink-500/20", border: "border-rose-400/35" },
};

function uid() {
  return Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function minToTime(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const suffix = h >= 12 ? "PM" : "AM";
  const hr12 = ((h + 11) % 12) + 1;
  return `${hr12}:${pad2(m)} ${suffix}`;
}

function rangeLabel(startMin: number, endMin: number) {
  const start = minToTime(startMin); // "9:00 AM"
  const end = minToTime(endMin); // "10:00 AM"
  const [startTime, startSuffix] = start.split(" ");
  const [endTime, endSuffix] = end.split(" ");
  if (startSuffix === endSuffix) return `${startTime}–${endTime} ${startSuffix}`;
  return `${start}–${end}`;
}

function roundToSlot(min: number) {
  return Math.round(min / SLOT) * SLOT;
}

function nearestNextSlot(now = new Date()) {
  const mins = now.getHours() * 60 + now.getMinutes();
  const rounded = roundToSlot(mins);
  // smart default: next slot (not past)
  const next = rounded < mins ? rounded + SLOT : rounded;
  return clamp(next, HOUR_START * 60, HOUR_END * 60 - DEFAULT_DURATION);
}

function weekLabel(anchor: Date) {
  const d = new Date(anchor);
  const day = d.getDay(); // 0..6
  const mondayOffset = (day + 6) % 7;
  d.setDate(d.getDate() - mondayOffset);
  const start = new Date(d);
  const end = new Date(d);
  end.setDate(end.getDate() + 6);
  return `${start.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${end.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })}`;
}

function startOfWeek(anchor: Date) {
  const d = new Date(anchor);
  const day = d.getDay(); // 0..6
  const mondayOffset = (day + 6) % 7;
  d.setDate(d.getDate() - mondayOffset);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(base: Date, days: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function timeToMin(v: string) {
  // "HH:MM" 24h
  const [hh, mm] = v.split(":").map((x) => Number(x));
  return hh * 60 + mm;
}

function minToInput(min: number) {
  const hh = Math.floor(min / 60);
  const mm = min % 60;
  return `${pad2(hh)}:${pad2(mm)}`;
}

function dateToISO(date: Date) {
  return date.toISOString().split("T")[0];
}

function overlaps(a: Appt, b: Appt) {
  return a.date === b.date && Math.max(a.startMin, b.startMin) < Math.min(a.endMin, b.endMin);
}

// Initialize seed data with dates from the current week
function initSeedData() {
  const now = new Date();
  const weekStart = startOfWeek(now);
  return [
    { id: "a1", title: "Design Review", date: dateToISO(addDays(weekStart, 1)), startMin: 9 * 60, endMin: 10 * 60, color: "cyan" as const, location: "Zoom" },
    { id: "a2", title: "Client Call", date: dateToISO(addDays(weekStart, 2)), startMin: 13 * 60 + 30, endMin: 14 * 60, color: "violet" as const, location: "Phone" },
    { id: "a3", title: "Deep Work", date: dateToISO(addDays(weekStart, 3)), startMin: 10 * 60, endMin: 12 * 60, color: "emerald" as const },
  ];
}

export default function SchedulingClient() {
  const [anchor, setAnchor] = useState(() => new Date());
  const [appts, setAppts] = useState<Appt[]>(initSeedData);

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("create");
  const [editingId, setEditingId] = useState<string | null>(null);

  const [draft, setDraft] = useState<Appt>(() => ({
    id: uid(),
    title: "",
    date: dateToISO(new Date()),
    startMin: nearestNextSlot(),
    endMin: nearestNextSlot() + DEFAULT_DURATION,
    location: "",
    color: "cyan",
  }));

  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [currentTime, setCurrentTime] = useState(new Date());
  const dialogRef = useRef<HTMLDivElement | null>(null);
  
  // Hover tooltip state
  const [hoveredAppt, setHoveredAppt] = useState<Appt | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Handle appointment hover for tooltip
  function handleApptMouseEnter(e: React.MouseEvent, appt: Appt) {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    
    const rect = e.currentTarget.getBoundingClientRect();
    const tooltipWidth = 360; // max-w-[360px]
    const tooltipHeight = 250; // estimated height
    const padding = 12;
    
    // Try to position to the right first
    let tooltipX = rect.right + padding;
    let tooltipY = rect.top;
    
    // Check if tooltip would go off right edge
    if (tooltipX + tooltipWidth > window.innerWidth - padding) {
      // Position to the left instead
      tooltipX = rect.left - tooltipWidth - padding;
    }
    
    // Check if tooltip would go off bottom edge
    if (tooltipY + tooltipHeight > window.innerHeight - padding) {
      tooltipY = window.innerHeight - tooltipHeight - padding;
    }
    
    // Check if tooltip would go off top edge
    if (tooltipY < padding) {
      tooltipY = padding;
    }
    
    // Check if tooltip would go off left edge
    if (tooltipX < padding) {
      tooltipX = padding;
    }
    
    setTooltipPosition({ x: tooltipX, y: tooltipY });
    setHoveredAppt(appt);
  }
  
  function handleApptMouseLeave() {
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredAppt(null);
    }, 100);
  }
  
  function handleTooltipMouseEnter() {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
  }
  
  function handleTooltipMouseLeave() {
    setHoveredAppt(null);
  }
  
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  // Update current time every minute for the time indicator
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const weekStart = useMemo(() => startOfWeek(anchor), [anchor]);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  // Filter appointments to only show those in the current week
  const weekAppts = useMemo(() => {
    const weekDates = new Set(days.map(d => dateToISO(d)));
    return appts.filter(a => weekDates.has(a.date));
  }, [appts, days]);

  const hours = useMemo(() => {
    const list: number[] = [];
    for (let h = HOUR_START; h <= HOUR_END; h++) list.push(h);
    return list;
  }, []);

  const gridMinutes = (HOUR_END - HOUR_START) * 60;
  const totalSlots = gridMinutes / SLOT;

  const errors = useMemo(() => {
    const e: Record<string, string> = {};

    if (!draft.title.trim()) e.title = "Title is required.";
    if (draft.endMin <= draft.startMin) e.time = "End time must be after start time.";
    if (draft.startMin < HOUR_START * 60 || draft.endMin > HOUR_END * 60) e.bounds = "Appointment must be within the visible hours.";

    const other = appts.filter((a) => a.id !== draft.id);
    if (other.some((a) => overlaps(a, draft))) e.overlap = "Overlaps another appointment on this day.";

    return e;
  }, [draft, appts]);

  function openCreate(date: Date, startMin: number) {
    const start = clamp(roundToSlot(startMin), HOUR_START * 60, HOUR_END * 60 - DEFAULT_DURATION);
    const end = clamp(start + DEFAULT_DURATION, start + SLOT, HOUR_END * 60);

    setMode("create");
    setEditingId(null);
    setTouched({});
    setDraft({
      id: uid(),
      title: "",
      date: dateToISO(date),
      startMin: start,
      endMin: end,
      location: "",
      color: "cyan",
    });
    setOpen(true);
  }

  function openEdit(a: Appt) {
    setMode("edit");
    setEditingId(a.id);
    setTouched({});
    setDraft({ ...a });
    setOpen(true);
  }

  function closeDialog() {
    setOpen(false);
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!open) return;
      if (e.key === "Escape") closeDialog();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // Click outside to close
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (!open) return;
      const el = dialogRef.current;
      if (!el) return;
      if (!el.contains(e.target as Node)) closeDialog();
    }
    window.addEventListener("mousedown", onMouseDown);
    return () => window.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  function save() {
    setTouched({ title: true, time: true, bounds: true, overlap: true });

    if (Object.keys(errors).length > 0) return;

    if (mode === "create") setAppts((p) => [...p, draft]);
    else setAppts((p) => p.map((a) => (a.id === draft.id ? draft : a)));

    setOpen(false);
  }

  function remove() {
    if (!editingId) return;
    setAppts((p) => p.filter((a) => a.id !== editingId));
    setOpen(false);
  }

  // --- Drag and resize (simple, reliable) ---
  const dragRef = useRef<{
    id: string;
    startY: number;
    origStart: number;
    origEnd: number;
    type: "move" | "resize";
  } | null>(null);

  function pxToMin(px: number, containerHeight: number) {
    const pxPerSlot = containerHeight / totalSlots;
    const slots = Math.round(px / pxPerSlot);
    return slots * SLOT;
  }

  function onBlockMouseDown(e: React.MouseEvent, a: Appt) {
    e.preventDefault();
    dragRef.current = { id: a.id, startY: e.clientY, origStart: a.startMin, origEnd: a.endMin, type: "move" };
    window.addEventListener("mousemove", onDragMove);
    window.addEventListener("mouseup", onDragEnd);
  }

  function onResizeMouseDown(e: React.MouseEvent, a: Appt) {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { id: a.id, startY: e.clientY, origStart: a.startMin, origEnd: a.endMin, type: "resize" };
    window.addEventListener("mousemove", onDragMove);
    window.addEventListener("mouseup", onDragEnd);
  }

  function onDragMove(e: MouseEvent) {
    const dr = dragRef.current;
    if (!dr) return;

    const container = document.getElementById("timegrid");
    if (!container) return;

    const deltaPx = e.clientY - dr.startY;
    const deltaMin = pxToMin(deltaPx, container.clientHeight);

    setAppts((prev) =>
      prev.map((a) => {
        if (a.id !== dr.id) return a;

        if (dr.type === "move") {
          const dur = dr.origEnd - dr.origStart;
          const nextStart = clamp(dr.origStart + deltaMin, HOUR_START * 60, HOUR_END * 60 - dur);
          return { ...a, startMin: nextStart, endMin: nextStart + dur };
        } else {
          const nextEnd = clamp(dr.origEnd + deltaMin, dr.origStart + SLOT, HOUR_END * 60);
          return { ...a, endMin: nextEnd };
        }
      })
    );
  }

  function onDragEnd() {
    dragRef.current = null;
    window.removeEventListener("mousemove", onDragMove);
    window.removeEventListener("mouseup", onDragEnd);
  }

  // --- Render helpers ---
  function topPx(min: number) {
    const start = HOUR_START * 60;
    const offset = min - start;
    return (offset / gridMinutes) * 100;
  }

  function heightPct(a: Appt) {
    return ((a.endMin - a.startMin) / gridMinutes) * 100;
  }

  return (
    <main className="min-h-screen bg-[#070A12] text-white">
      <div className="pointer-events-none fixed inset-0 opacity-20 mask-[radial-gradient(520px_420px_at_50%_20%,black_45%,transparent_80%)]">
        <div className="h-full w-full bg-[linear-gradient(to_right,rgba(255,255,255,.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,.06)_1px,transparent_1px)] bg-size-[44px_44px]" />
      </div>

      <div className="relative mx-auto max-w-295 px-4 py-8 md:py-10">
        <CaseHeader
          number="#03"
          title="Scheduling + Time-Grid Calendar App"
          subtitle="Lead UI • Complex state + edge cases"
          tags={["UX", "Systems"]}
          desc="Week view time-grid, smart defaults, validation, and clean editing flows for appointments."
        />

        <div className="mt-5">
          <CaseCTA
            leftLabel="Live Demo"
            leftHref="#demo"
            rightLabel="Open Case Study"
            rightHref="#case"
          />
        </div>

        <section id="demo" className="mt-5 grid gap-4 lg:grid-cols-12">
          {/* Calendar */}
          <div className="lg:col-span-9 rounded-3xl border border-white/10 bg-white/4 p-3 md:p-5 shadow-[0_30px_80px_rgba(0,0,0,.55)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div>
                  <div className="text-xs uppercase tracking-[.18em] text-white/60">Week view</div>
                  <div className="mt-0.5 text-lg font-semibold flex items-center gap-2">
                    {weekLabel(anchor)}
                    <span className="text-xs font-normal text-white/50">• {weekAppts.length} events</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  className="group rounded-2xl border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold transition-all hover:bg-white/10 hover:border-white/20 hover:scale-105 active:scale-95"
                  onClick={() => setAnchor((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - 7))}
                >
                  <span className="group-hover:-translate-x-0.5 inline-block transition-transform">←</span> Prev
                </button>
                <button
                  className="rounded-2xl border border-cyan-400/30 bg-linear-to-r from-cyan-500/20 to-blue-500/20 px-3 py-2 text-sm font-semibold transition-all hover:from-cyan-500/30 hover:to-blue-500/30 hover:scale-105 active:scale-95"
                  onClick={() => setAnchor(new Date())}
                >
                  Today
                </button>
                <button
                  className="group rounded-2xl border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold transition-all hover:bg-white/10 hover:border-white/20 hover:scale-105 active:scale-95"
                  onClick={() => setAnchor((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7))}
                >
                  Next <span className="group-hover:translate-x-0.5 inline-block transition-transform">→</span>
                </button>
              </div>
            </div>

            {/* Days header */}
            <div className="mt-4 grid grid-cols-[60px_repeat(7,minmax(0,1fr))] gap-2">
              <div />
              {days.map((d, i) => {
                const isToday = new Date().toDateString() === d.toDateString();
                return (
                  <div
                    key={i}
                    className={[
                      "rounded-2xl border px-3 py-2 text-sm",
                      isToday ? "border-cyan-300/30 bg-cyan-300/10" : "border-white/10 bg-white/5",
                    ].join(" ")}
                  >
                    <div className="text-xs text-white/60">{d.toLocaleDateString(undefined, { weekday: "short" }).toUpperCase()}</div>
                    <div className="font-semibold">{d.getDate()}</div>
                  </div>
                );
              })}
            </div>

            {/* Grid */}
            <div className="mt-3 grid grid-cols-[60px_repeat(7,minmax(0,1fr))] gap-2">
              {/* Time labels */}
              <div className="relative">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-2">
                  <div className="text-xs text-white/60">Time</div>
                </div>
                <div className="mt-2">
                  {hours.map((h) => (
                    <div key={h} className="h-16 text-xs text-white/55">
                      <div className="pt-1">{h === 12 ? "12 PM" : h > 12 ? `${h - 12} PM` : `${h} AM`}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Day columns */}
              <div id="timegrid" className="col-span-7 grid grid-cols-7 gap-2">
                {days.map((d, dayIndex) => {
                  const isToday = new Date().toDateString() === d.toDateString();
                  return (
                    <div
                      key={dayIndex}
                      className={[
                        "group/day relative overflow-hidden rounded-2xl border transition-colors",
                        isToday ? "border-cyan-400/20 bg-cyan-500/5" : "border-white/10 bg-white/5 hover:bg-white/[0.07]",
                      ].join(" ")}
                    >
                      {/* click layer */}
                      <div
                        className="absolute inset-0 cursor-crosshair"
                        onClick={(e) => {
                          const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                          const y = e.clientY - rect.top;
                          const min = HOUR_START * 60 + (y / rect.height) * gridMinutes;
                          openCreate(d, min);
                        }}
                        role="button"
                        aria-label={`Create appointment on ${d.toDateString()}`}
                      />

                      {/* horizontal grid lines */}
                      <div className="pointer-events-none absolute inset-0">
                        {Array.from({ length: totalSlots + 1 }, (_, i) => {
                          // Hour markers (every 4th slot = 60 min)
                          const isHourMark = i % 4 === 0;
                          return (
                            <div
                              key={i}
                              className={[
                                "absolute left-0 right-0 border-t",
                                isHourMark ? "border-white/10" : "border-white/4",
                              ].join(" ")}
                              style={{ top: `${(i / totalSlots) * 100}%` }}
                            />
                          );
                        })}
                      </div>

                      {/* Current time indicator - only show on today's column */}
                      {isToday && (() => {
                        const nowMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
                        const isInView = nowMinutes >= HOUR_START * 60 && nowMinutes <= HOUR_END * 60;
                        if (!isInView) return null;

                        return (
                          <div
                            className="pointer-events-none absolute left-0 right-0 z-10 flex items-center"
                            style={{ top: `${topPx(nowMinutes)}%` }}
                          >
                            <div className="h-0.5 w-2 rounded-l-full bg-linear-to-r from-cyan-400 to-transparent" />
                            <div className="flex-1 border-t-2 border-dashed border-cyan-400/60 shadow-[0_0_8px_rgba(34,211,238,0.3)]" />
                            <div className="h-2.5 w-2.5 -ml-1.5 rounded-full bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.6)] animate-pulse" />
                          </div>
                        );
                      })()}

                    {/* blocks */}
                    {appts
                      .filter((a) => a.date === dateToISO(d))
                      .map((a) => {
                        const c = COLORS[a.color ?? "slate"];
                        const duration = a.endMin - a.startMin;

                        // Duration-based layout modes
                        const isTiny = duration <= 15;      // 15 min or less - single-line
                        const isMini = duration <= 30;      // 30 min or less - ultra compact
                        const isCompact = duration <= 60;   // 60 min or less - compact
                        const showLocation = duration >= 75; // 75+ min - show location
                        const compactRange = rangeLabel(a.startMin, a.endMin);
                        const fullRange = `${minToTime(a.startMin)} – ${minToTime(a.endMin)}`;

                        return (
                          <div
                            key={a.id}
                            className={[
                              "group absolute left-1.5 right-1.5 select-none overflow-hidden rounded-xl border",
                              "transition-shadow duration-200 ease-out",
                              "shadow-[0_8px_22px_rgba(0,0,0,.32)] hover:shadow-[0_12px_28px_rgba(0,0,0,.38)]",
                              "cursor-grab active:cursor-grabbing",
                              "z-0 hover:z-10",
                              c.bg,
                              c.border,
                              isTiny
                                ? "px-1.5 py-0.5 text-[9px]"
                                : isMini
                                  ? "px-2 py-1 text-[10px]"
                                  : isCompact
                                    ? "px-2.5 py-1.5 text-[11px]"
                                    : "p-3 text-sm",
                            ].join(" ")}
                            style={{
                              top: `${topPx(a.startMin)}%`,
                              height: `${heightPct(a)}%`,
                              minHeight: isTiny ? "18px" : isMini ? "26px" : isCompact ? "36px" : "48px",
                            }}
                            onMouseDown={(e) => onBlockMouseDown(e, a)}
                            onDoubleClick={() => openEdit(a)}
                            onMouseEnter={(e) => handleApptMouseEnter(e, a)}
                            onMouseLeave={handleApptMouseLeave}
                            title="Drag to move • Drag handle to resize • Double-click to edit"
                          >
                            {/* Empty container - content only visible in hover tooltip */}
                            <div className="h-full flex items-center justify-center">
                              <span
                                className={[
                                  "rounded-full ring-2 ring-white/20",
                                  c.chip,
                                  isTiny ? "h-2 w-2" : isMini ? "h-2.5 w-2.5" : isCompact ? "h-3 w-3" : "h-3.5 w-3.5"
                                ].join(" ")}
                              />
                            </div>

                            {/* Resize handle */}
                            {!isTiny && (
                              <div
                                className={[
                                  "absolute left-0 right-0 bottom-0 cursor-ns-resize rounded-b-xl transition-all duration-200",
                                  "bg-linear-to-t from-black/20 via-white/5 to-transparent backdrop-blur-sm",
                                  isMini
                                    ? "h-3 opacity-0 group-hover:opacity-100"
                                    : isCompact
                                      ? "h-4 opacity-0 group-hover:opacity-100"
                                      : "h-5 opacity-30 hover:opacity-100 hover:h-6",
                                ].join(" ")}
                                onMouseDown={(e) => onResizeMouseDown(e, a)}
                                title="Drag to resize"
                              >
                                {/* Drag indicator lines - only show for larger cards */}
                                {!isCompact && (
                                  <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center justify-center gap-2">
                                    <div className="h-1 w-10 rounded-full bg-white/50 shadow-[0_0_6px_rgba(255,255,255,.4)]" />
                                    <div className="h-1 w-10 rounded-full bg-white/50 shadow-[0_0_6px_rgba(255,255,255,.4)]" />
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-3 text-xs text-white/55">
              Tip: <span className="text-white/75">Click</span> to create • <span className="text-white/75">drag</span> to move •{" "}
              <span className="text-white/75">drag handle</span> to resize • <span className="text-white/75">double-click</span> to edit.
            </div>
          </div>

          {/* Side panel */}
          <aside className="lg:col-span-3 space-y-4">
            {/* Weekly Analytics */}
            <div className="rounded-3xl border border-white/10 bg-white/4 p-4 md:p-5 shadow-[0_20px_60px_rgba(0,0,0,.4)]">
              <div className="flex items-center justify-between">
                <div className="text-xs uppercase tracking-[.18em] text-white/60">Week Analytics</div>
                <div className="flex items-center gap-1.5 rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[10px] font-semibold text-emerald-200">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/10 bg-linear-to-br from-cyan-500/10 to-blue-500/15 p-3">
                  <div className="text-xs text-white/60">Total Events</div>
                  <div className="mt-1 text-2xl font-bold text-white">{weekAppts.length}</div>
                  <div className="mt-1 text-[10px] text-white/50">This week</div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-linear-to-br from-violet-500/10 to-purple-500/15 p-3">
                  <div className="text-xs text-white/60">Total Hours</div>
                  <div className="mt-1 text-2xl font-bold text-white">
                    {(weekAppts.reduce((sum, a) => sum + (a.endMin - a.startMin), 0) / 60).toFixed(1)}
                  </div>
                  <div className="mt-1 text-[10px] text-white/50">Scheduled</div>
                </div>
              </div>

              <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/60">Avg. duration</span>
                  <span className="font-semibold text-white">
                    {weekAppts.length > 0 ? Math.round(weekAppts.reduce((sum, a) => sum + (a.endMin - a.startMin), 0) / weekAppts.length) : 0} min
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="text-white/60">Busiest day</span>
                  <span className="font-semibold text-white">
                    {(() => {
                      const counts = weekAppts.reduce((acc, a) => {
                        acc[a.date] = (acc[a.date] || 0) + 1;
                        return acc;
                      }, {} as Record<string, number>);
                      const maxEntry = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
                      if (!maxEntry) return "None";
                      const busiestDate = new Date(maxEntry[0] + "T00:00:00");
                      return busiestDate.toLocaleDateString(undefined, { weekday: "short" });
                    })()}
                  </span>
                </div>
              </div>
            </div>

            {/* Keyboard Shortcuts */}
            <div className="rounded-3xl border border-white/10 bg-white/4 p-4 md:p-5 shadow-[0_20px_60px_rgba(0,0,0,.4)]">
              <div className="flex items-center gap-2">
                <div className="text-xs uppercase tracking-[.18em] text-white/60">Keyboard Shortcuts</div>
              </div>

              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2 text-xs">
                  <span className="text-white/70">Click anywhere</span>
                  <kbd className="rounded-lg border border-white/20 bg-white/10 px-2 py-1 font-mono text-[10px] text-white">Create</kbd>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2 text-xs">
                  <span className="text-white/70">Double-click event</span>
                  <kbd className="rounded-lg border border-white/20 bg-white/10 px-2 py-1 font-mono text-[10px] text-white">Edit</kbd>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2 text-xs">
                  <span className="text-white/70">Drag event</span>
                  <kbd className="rounded-lg border border-white/20 bg-white/10 px-2 py-1 font-mono text-[10px] text-white">Move</kbd>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2 text-xs">
                  <span className="text-white/70">Drag handle</span>
                  <kbd className="rounded-lg border border-white/20 bg-white/10 px-2 py-1 font-mono text-[10px] text-white">Resize</kbd>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2 text-xs">
                  <span className="text-white/70">Close dialog</span>
                  <kbd className="rounded-lg border border-white/20 bg-white/10 px-2 py-1 font-mono text-[10px] text-white">ESC</kbd>
                </div>
              </div>
            </div>

            {/* Technical Implementation */}
            <div id="case" className="rounded-3xl border border-white/10 bg-white/4 p-4 md:p-5 shadow-[0_20px_60px_rgba(0,0,0,.4)]">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-2 text-xs text-white/80">
                UX • Performance • Systems
              </div>
              <h3 className="mt-3 text-base font-semibold">Technical Highlights</h3>
              <ul className="mt-3 space-y-2.5 text-sm text-white/70">
                <li className="flex items-start gap-2">
                  <span><strong className="text-white">Deterministic time math</strong> – 15-min slot resolution with precise positioning</span>
                </li>
                <li className="flex items-start gap-2">
                  <span><strong className="text-white">Smart defaults</strong> – Auto-suggests next available slot + 30 min duration</span>
                </li>
                <li className="flex items-start gap-2">
                  <span><strong className="text-white">Real-time validation</strong> – Prevents overlaps & enforces time bounds</span>
                </li>
                <li className="flex items-start gap-2">
                  <span><strong className="text-white">Adaptive layouts</strong> – 3 responsive card sizes based on duration</span>
                </li>
                <li className="flex items-start gap-2">
                  <span><strong className="text-white">Live time indicator</strong> – Updates every minute on current day</span>
                </li>
                <li className="flex items-start gap-2">
                  <span><strong className="text-white">Drag & resize</strong> – Smooth interactions with clamping logic</span>
                </li>
              </ul>
              <div className="mt-4 rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-3 text-xs text-white/70">
                <div className="font-semibold text-cyan-200">Stack Used</div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <span className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px]">React 19</span>
                  <span className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px]">Next.js 16</span>
                  <span className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px]">TypeScript</span>
                  <span className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px]">Tailwind v4</span>
                </div>
              </div>
            </div>
          </aside>
        </section>

        {/* Dialog */}
        {open && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div
              ref={dialogRef}
              className="w-full max-w-140 rounded-3xl border border-white/10 bg-[#0A1020] p-4 md:p-6 shadow-[0_30px_80px_rgba(0,0,0,.65)] animate-in zoom-in-95 duration-200"
              role="dialog"
              aria-modal="true"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <div className="text-xs uppercase tracking-[.18em] text-white/60">
                      {mode === "create" ? "✨ New appointment" : "✏️ Edit appointment"}
                    </div>
                    {mode === "create" && (
                      <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-[9px] font-semibold text-emerald-200">
                        Quick add
                      </div>
                    )}
                  </div>
                  <div className="mt-1 text-lg font-semibold">
                    {new Date(draft.date + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
                  </div>
                </div>
                <button
                  className="group rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold transition-all hover:bg-white/10 hover:scale-105 active:scale-95"
                  onClick={closeDialog}
                  type="button"
                  title="Press ESC to close"
                >
                  <span className="group-hover:rotate-90 inline-block transition-transform duration-200">✕</span>
                </button>
              </div>

              <div className="mt-4 grid gap-3">
                <div className="grid gap-1">
                  <label className="text-xs text-white/70">Title</label>
                  <input
                    value={draft.title}
                    onChange={(e) => setDraft((p) => ({ ...p, title: e.target.value }))}
                    onBlur={() => setTouched((p) => ({ ...p, title: true }))}
                    className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-3 text-sm outline-none focus:border-cyan-300/40 focus:shadow-[0_0_0_4px_rgba(34,211,238,.12)]"
                    placeholder="e.g. Intake call"
                    autoFocus
                  />
                  {touched.title && errors.title ? <div className="text-xs text-rose-300">{errors.title}</div> : null}
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="grid gap-1">
                    <label className="text-xs text-white/70">Start</label>
                    <input
                      type="time"
                      value={minToInput(draft.startMin)}
                      onChange={(e) => {
                        const nextStart = timeToMin(e.target.value);
                        const dur = draft.endMin - draft.startMin;
                        const nextEnd = clamp(nextStart + dur, nextStart + SLOT, HOUR_END * 60);
                        setDraft((p) => ({ ...p, startMin: nextStart, endMin: nextEnd }));
                      }}
                      className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-3 text-sm outline-none focus:border-cyan-300/40 focus:shadow-[0_0_0_4px_rgba(34,211,238,.12)]"
                    />
                  </div>

                  <div className="grid gap-1">
                    <label className="text-xs text-white/70">End</label>
                    <input
                      type="time"
                      value={minToInput(draft.endMin)}
                      onChange={(e) => setDraft((p) => ({ ...p, endMin: timeToMin(e.target.value) }))}
                      className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-3 text-sm outline-none focus:border-cyan-300/40 focus:shadow-[0_0_0_4px_rgba(34,211,238,.12)]"
                    />
                  </div>
                </div>

                {(touched.time || touched.bounds || touched.overlap) && (errors.time || errors.bounds || errors.overlap) ? (
                  <div className="rounded-2xl border border-rose-300/25 bg-rose-300/10 p-3 text-sm text-rose-100">
                    {errors.title || errors.time || errors.bounds || errors.overlap}
                  </div>
                ) : null}

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="grid gap-1">
                    <label className="text-xs text-white/70">Location (optional)</label>
                    <input
                      value={draft.location ?? ""}
                      onChange={(e) => setDraft((p) => ({ ...p, location: e.target.value }))}
                      className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-3 text-sm outline-none focus:border-cyan-300/40 focus:shadow-[0_0_0_4px_rgba(34,211,238,.12)]"
                      placeholder="Zoom / Office / Phone"
                    />
                  </div>

                  <div className="grid gap-1">
                    <label className="text-xs text-white/70">Color</label>
                    <select
                      value={draft.color ?? "cyan"}
                      onChange={(e) => setDraft((p) => ({ ...p, color: e.target.value as Appt["color"] }))}
                      className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-3 text-sm outline-none focus:border-cyan-300/40 focus:shadow-[0_0_0_4px_rgba(34,211,238,.12)]"
                    >
                      <option value="cyan">Cyan</option>
                      <option value="violet">Violet</option>
                      <option value="emerald">Emerald</option>
                      <option value="rose">Rose</option>
                      <option value="slate">Slate</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
                {mode === "edit" ? (
                  <button
                    onClick={remove}
                    className="group rounded-2xl border border-rose-300/25 bg-rose-300/10 px-4 py-3 text-sm font-semibold text-rose-100 transition-all hover:bg-rose-300/20 hover:border-rose-300/40 hover:scale-105 active:scale-95"
                    type="button"
                  >
                    <span className="flex items-center gap-2">
                      🗑️ Delete
                    </span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-white/55">
                    <div className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
                    Tip: Drag to move • Drag handle to resize
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={closeDialog}
                    className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold transition-all hover:bg-white/10 hover:scale-105 active:scale-95"
                    type="button"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={save}
                    disabled={Object.keys(errors).length > 0}
                    className="group rounded-2xl border border-cyan-300/40 bg-linear-to-r from-cyan-400/80 to-violet-500/60 px-5 py-3 text-sm font-semibold transition-all hover:shadow-[0_18px_50px_rgba(34,211,238,.25)] hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                    type="button"
                  >
                    <span className="flex items-center gap-2">
                      {mode === "create" ? "✨ Create" : "💾 Save"}
                      <span className="group-hover:translate-x-0.5 inline-block transition-transform">→</span>
                    </span>
                  </button>
                </div>
              </div>

              <div className="mt-3 text-xs text-white/55">
                Visible hours: {HOUR_START}:00–{HOUR_END}:00 • Resolution: {SLOT} min • Double-click blocks to edit quickly
              </div>
            </div>
          </div>
        )}

        <footer className="mt-8 rounded-3xl border border-white/10 bg-white/4 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/30 bg-linear-to-br from-cyan-500/20 to-blue-500/20 text-lg font-bold text-cyan-200">
                  JL
                </div>
                <div>
                  <div className="font-semibold text-white">Julio Lopez</div>
                  <div className="text-xs text-white/60">Full-Stack Developer • UI/UX Specialist</div>
                </div>
              </div>
              <div className="mt-3 text-xs text-white/50">
                © {new Date().getFullYear()} • Scheduling + Time-Grid Calendar App • Case Study #03
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <a
                href="https://github.com/yourusername"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white/80 transition-all hover:bg-white/10 hover:border-white/20 hover:scale-105"
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                GitHub
              </a>
              <a
                href="https://linkedin.com/in/yourusername"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white/80 transition-all hover:bg-white/10 hover:border-white/20 hover:scale-105"
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
                LinkedIn
              </a>
              <a
                href="mailto:your.email@example.com"
                className="flex items-center gap-2 rounded-2xl border border-cyan-400/30 bg-linear-to-r from-cyan-500/20 to-blue-500/20 px-4 py-2 text-sm font-semibold text-white transition-all hover:from-cyan-500/30 hover:to-blue-500/30 hover:scale-105"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Contact
              </a>
            </div>
          </div>
        </footer>
      </div>

      {/* Hover Tooltip */}
      {hoveredAppt && (
        <div
          className="fixed z-50 animate-in fade-in duration-200"
          style={{
            left: `${tooltipPosition.x}px`,
            top: `${tooltipPosition.y}px`,
            transform: 'translateY(0)',
          }}
          onMouseEnter={handleTooltipMouseEnter}
          onMouseLeave={handleTooltipMouseLeave}
        >
          <div className="rounded-xl border border-white/20 bg-[#0F1620] backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,.6)] p-4 min-w-[280px] max-w-[360px] pointer-events-auto">
            {/* Header */}
            <div className="flex items-start gap-3 mb-3">
              <span className={["mt-1 shrink-0 rounded-full", COLORS[hoveredAppt.color ?? "slate"].chip, "h-4 w-4 ring-2 ring-white/20"].join(" ")} />
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-white text-base leading-tight mb-1">
                  {hoveredAppt.title}
                </h3>
                <div className="flex items-center gap-2 text-xs text-white/70">
                  <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>{new Date(hoveredAppt.date + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}</span>
                </div>
              </div>
            </div>

            {/* Details */}
            <div className="space-y-2.5">
              {/* Time */}
              <div className="flex items-center gap-2.5">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/10 border border-white/10">
                  <svg className="h-4 w-4 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="text-xs text-white/60 mb-0.5">Time</div>
                  <div className="text-sm font-medium text-white tabular-nums">
                    {minToTime(hoveredAppt.startMin)} – {minToTime(hoveredAppt.endMin)}
                  </div>
                  <div className="text-xs text-white/50 mt-0.5">
                    Duration: {Math.round((hoveredAppt.endMin - hoveredAppt.startMin) / 15) * 15} minutes
                  </div>
                </div>
              </div>

              {/* Location */}
              {hoveredAppt.location && (
                <div className="flex items-center gap-2.5">
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/10 border border-white/10">
                    <svg className="h-4 w-4 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="text-xs text-white/60 mb-0.5">Location</div>
                    <div className="text-sm font-medium text-white">
                      {hoveredAppt.location}
                    </div>
                  </div>
                </div>
              )}

              {/* Color */}
              <div className="flex items-center gap-2.5">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/10 border border-white/10">
                  <svg className="h-4 w-4 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="text-xs text-white/60 mb-0.5">Color</div>
                  <div className="text-sm font-medium text-white capitalize">
                    {hoveredAppt.color ?? "slate"}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-white/50">
                <span className="h-1.5 w-1.5 rounded-full bg-white/40 animate-pulse" />
                <span>Active appointment</span>
              </div>
              <button
                className="text-xs font-semibold text-white/80 hover:text-white transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  handleTooltipMouseLeave();
                  openEdit(hoveredAppt);
                }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                Edit →
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
      <div className="text-xs text-white/60">{label}</div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  );
}
