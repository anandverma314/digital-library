export interface TimingSlot {
  name: string;
  startTime?: string;
  endTime?: string;
}

function minutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/** A slot as minute ranges within one day; a slot ending at or before its start wraps past midnight. */
function ranges(t: TimingSlot): [number, number][] | null {
  if (!t.startTime || !t.endTime) return null;
  const start = minutes(t.startTime);
  const end = minutes(t.endTime);
  return end > start ? [[start, end]] : [[start, 1440], [0, end]];
}

/**
 * Two timings clash when they are the same timing, or when both have start/end times that overlap.
 * Touching slots (Morning 06:00-12:00, Afternoon 12:00-17:00) do not clash.
 */
export function timingsOverlap(a: TimingSlot, b: TimingSlot): boolean {
  if (a.name === b.name) return true;
  const ra = ranges(a);
  const rb = ranges(b);
  if (!ra || !rb) return false;
  return ra.some(([s1, e1]) => rb.some(([s2, e2]) => s1 < e2 && s2 < e1));
}
