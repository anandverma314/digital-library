import { Download } from 'lucide-react';
import { useState } from 'react';
import { ErrorState, LoadingState, PageHeader } from '@/components/common';
import { fillMonths, monthLabel, MonthlyBarChart } from '@/components/dashboard/MonthlyBarChart';
import { buttonClass } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/form-controls';
import { Table, Td, Th, Tr } from '@/components/ui/table';
import { useApi } from '@/lib/hooks';
import { buildQuery, formatCurrency, formatDate, PAYMENT_MODE_LABELS, PLAN_LABELS, todayISO } from '@/lib/utils';
import type { FeePlanCode, PaymentMode } from '@/types';

interface Summary {
  from: string;
  to: string;
  total: number;
  count: number;
  byMonth: { month: string; total: number; count: number }[];
  byMode: { mode: PaymentMode; total: number; count: number }[];
  byPlan: { plan: FeePlanCode; total: number; count: number }[];
}

const PRESETS = {
  thisYear: () => [`${new Date().getFullYear()}-01-01`, todayISO()],
  last12: () => {
    const d = new Date();
    d.setMonth(d.getMonth() - 11, 1);
    return [`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`, todayISO()];
  },
  thisMonth: () => [todayISO().slice(0, 8) + '01', todayISO()],
} as const;

export default function ReportsPage() {
  return (
    <>
      <PageHeader
        title="Reports"
        description="Fee collection summaries and exports."
        actions={
          <>
            <a href="/api/reports/students.csv?status=all" className={buttonClass('outline')}>
              <Download /> Students CSV
            </a>
          </>
        }
      />
      <Collections />
    </>
  );
}

function Collections() {
  const [[from, to], setRange] = useState<readonly string[]>(PRESETS.last12());
  const { data, error, loading, reload } = useApi<Summary>(`/reports/summary${buildQuery({ from, to })}`);
  const months = data ? fillMonths(from, to, data.byMonth) : [];

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3">
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">From</span>
            <Input type="date" value={from} max={to} onChange={(e) => e.target.value && setRange([e.target.value, to])} />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">To</span>
            <Input type="date" value={to} min={from} onChange={(e) => e.target.value && setRange([from, e.target.value])} />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={buttonClass('ghost', 'sm')} onClick={() => setRange(PRESETS.thisMonth())}>This month</button>
            <button type="button" className={buttonClass('ghost', 'sm')} onClick={() => setRange(PRESETS.last12())}>Last 12 months</button>
            <button type="button" className={buttonClass('ghost', 'sm')} onClick={() => setRange(PRESETS.thisYear())}>This year</button>
          </div>
          <a href={`/api/reports/payments.csv${buildQuery({ from, to })}`} className={buttonClass('outline', 'default', 'sm:ml-auto')}>
            <Download /> Payments CSV
          </a>
        </CardContent>
      </Card>

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading && !data ? (
        <LoadingState />
      ) : data ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <p className="text-sm font-medium text-slate-500">Total collected</p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900 sm:text-3xl">{formatCurrency(data.total)}</p>
              <p className="mt-1 text-xs text-slate-500">{formatDate(data.from)} – {formatDate(data.to)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <p className="text-sm font-medium text-slate-500">Payments</p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900 sm:text-3xl">{data.count}</p>
              <p className="mt-1 text-xs text-slate-500">Average {formatCurrency(data.count ? Math.round(data.total / data.count) : 0)}</p>
            </div>
          </div>

          <Card>
            <CardHeader title="Collection by month" description="Hover or tap a month to see its total" />
            <CardContent>
              <MonthlyBarChart data={months} />
            </CardContent>
            <details className="border-t border-slate-100">
              <summary className="cursor-pointer px-5 py-3 text-sm font-medium text-primary">Show as table</summary>
              <Table>
                <thead>
                  <tr>
                    <Th>Month</Th>
                    <Th className="text-right">Payments</Th>
                    <Th className="text-right">Collected</Th>
                  </tr>
                </thead>
                <tbody>
                  {months.map((m) => (
                    <Tr key={m.month}>
                      <Td>{monthLabel(m.month, true)}</Td>
                      <Td className="text-right tabular-nums">{m.count}</Td>
                      <Td className="text-right font-medium tabular-nums">{formatCurrency(m.total)}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </details>
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            <BreakdownTable
              title="By payment mode"
              rows={data.byMode.map((r) => ({ label: PAYMENT_MODE_LABELS[r.mode], total: r.total, count: r.count }))}
              grand={data.total}
            />
            <BreakdownTable
              title="By fee plan"
              rows={data.byPlan.map((r) => ({ label: PLAN_LABELS[r.plan], total: r.total, count: r.count }))}
              grand={data.total}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}

function BreakdownTable({ title, rows, grand }: { title: string; rows: { label: string; total: number; count: number }[]; grand: number }) {
  const sorted = [...rows].sort((a, b) => b.total - a.total);
  return (
    <Card>
      <CardHeader title={title} />
      {sorted.length === 0 ? (
        <p className="p-5 text-sm text-slate-500">No payments in this period.</p>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>{title.replace('By ', '').replace(/^./, (c) => c.toUpperCase())}</Th>
              <Th className="text-right">Payments</Th>
              <Th className="text-right">Collected</Th>
              <Th className="text-right">Share</Th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <Tr key={r.label}>
                <Td className="font-medium">{r.label}</Td>
                <Td className="text-right tabular-nums">{r.count}</Td>
                <Td className="text-right tabular-nums">{formatCurrency(r.total)}</Td>
                <Td className="text-right tabular-nums text-slate-600">{grand ? Math.round((r.total / grand) * 100) : 0}%</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  );
}
