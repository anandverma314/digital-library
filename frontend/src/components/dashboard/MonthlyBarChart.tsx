import { useState } from 'react';
import { formatCurrency } from '@/lib/utils';

export interface MonthPoint {
  month: string; // YYYY-MM
  total: number;
  count: number;
}

export function monthLabel(m: string, withYear = false) {
  const [y, mo] = m.split('-').map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString('en-IN', { month: 'short', ...(withYear ? { year: 'numeric' } : {}) });
}

function niceMax(v: number) {
  if (v <= 0) return 1000;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

function shortCurrency(v: number) {
  if (v >= 100000) return `₹${(v / 100000).toFixed(v % 100000 ? 1 : 0)}L`;
  if (v >= 1000) return `₹${(v / 1000).toFixed(v % 1000 ? 1 : 0)}k`;
  return `₹${v}`;
}

/** Single-series bar chart: one hue, thin bars rounded at the data end, hover/focus tooltip. */
export function MonthlyBarChart({ data }: { data: MonthPoint[] }) {
  const [active, setActive] = useState<number | null>(null);
  const W = 640;
  const H = 240;
  const pad = { top: 16, right: 8, bottom: 28, left: 48 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const max = niceMax(Math.max(...data.map((d) => d.total), 0));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const slot = innerW / Math.max(data.length, 1);
  const barW = Math.min(28, slot * 0.6);
  const y = (v: number) => pad.top + innerH - (v / max) * innerH;
  const labelEvery = data.length > 12 ? Math.ceil(data.length / 12) : 1;
  const a = active !== null ? data[active] : null;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Fee collection by month">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={W - pad.right} y1={y(t)} y2={y(t)} stroke="#e2e8f0" strokeWidth={1} />
            <text x={pad.left - 8} y={y(t)} textAnchor="end" dominantBaseline="middle" className="fill-slate-500 text-[11px]">
              {shortCurrency(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = pad.left + slot * i + slot / 2;
          const top = y(d.total);
          const base = pad.top + innerH;
          const h = base - top;
          const r = Math.min(4, h);
          const x0 = cx - barW / 2;
          return (
            <g key={d.month}>
              {/* Hit area wider than the bar, for hover and tap */}
              <rect
                x={pad.left + slot * i}
                y={pad.top}
                width={slot}
                height={innerH}
                fill={active === i ? '#f1f5f9' : 'transparent'}
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
                onClick={() => setActive(i)}
                tabIndex={0}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                aria-label={`${monthLabel(d.month, true)}: ${formatCurrency(d.total)} from ${d.count} payments`}
              />
              {h > 0 && (
                <path
                  pointerEvents="none"
                  fill="var(--color-series-1)"
                  d={`M${x0},${base} V${top + r} Q${x0},${top} ${x0 + r},${top} H${x0 + barW - r} Q${x0 + barW},${top} ${x0 + barW},${top + r} V${base} Z`}
                />
              )}
              {i % labelEvery === 0 && (
                <text x={cx} y={H - 8} textAnchor="middle" className="fill-slate-500 text-[11px]">
                  {monthLabel(d.month)}
                </text>
              )}
            </g>
          );
        })}
        <line x1={pad.left} x2={W - pad.right} y1={pad.top + innerH} y2={pad.top + innerH} stroke="#94a3b8" strokeWidth={1} />
      </svg>
      {a && active !== null && (
        <div
          className="pointer-events-none absolute top-1 -translate-x-1/2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg"
          style={{ left: `${Math.min(Math.max(((pad.left + slot * active + slot / 2) / W) * 100, 12), 88)}%` }}
          role="status"
        >
          <p className="font-medium text-slate-900">{monthLabel(a.month, true)}</p>
          <p className="text-slate-700">{formatCurrency(a.total)}</p>
          <p className="text-slate-500">{a.count} payment(s)</p>
        </div>
      )}
    </div>
  );
}

/** Fills months with no payments so the axis is continuous. */
export function fillMonths(from: string, to: string, rows: MonthPoint[]): MonthPoint[] {
  const byMonth = new Map(rows.map((r) => [r.month, r]));
  const out: MonthPoint[] = [];
  let [y, m] = from.slice(0, 7).split('-').map(Number);
  const [ty, tm] = to.slice(0, 7).split('-').map(Number);
  while ((y < ty || (y === ty && m <= tm)) && out.length < 120) {
    const key = `${y}-${String(m).padStart(2, '0')}`;
    out.push(byMonth.get(key) ?? { month: key, total: 0, count: 0 });
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}
