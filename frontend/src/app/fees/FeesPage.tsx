import { IndianRupee } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Avatar, EmptyState, ErrorState, LoadingState, PageHeader, Pagination, SearchInput } from '@/components/common';
import { FeeStatusBadge } from '@/components/fees/StatusBadges';
import { RecordPaymentDialog } from '@/components/payments/RecordPaymentDialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, Td, Th, Tr } from '@/components/ui/table';
import { useApi, useDebounced } from '@/lib/hooks';
import { buildQuery, cn, formatCurrency, formatDate, PLAN_LABELS } from '@/lib/utils';
import type { FeePlanCode, FeeStatus, Paginated, Student } from '@/types';

interface Summary {
  all: number;
  byStatus: Record<FeeStatus, number>;
  byPlan: Record<FeePlanCode, number>;
  dueReminderDays: number;
}

type Filter = 'all' | FeeStatus | FeePlanCode;
const FILTERS: { value: Filter; label: string; kind: 'status' | 'plan' | 'all' }[] = [
  { value: 'all', label: 'All', kind: 'all' },
  { value: 'paid', label: 'Paid', kind: 'status' },
  { value: 'due', label: 'Due', kind: 'status' },
  { value: 'overdue', label: 'Overdue', kind: 'status' },
  { value: 'partial', label: 'Partially Paid', kind: 'status' },
  { value: 'monthly', label: 'Monthly', kind: 'plan' },
  { value: 'half_yearly', label: 'Half-Yearly', kind: 'plan' },
  { value: 'yearly', label: 'Yearly', kind: 'plan' },
];

export default function FeesPage() {
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [paying, setPaying] = useState<Student | null>(null);
  const q = useDebounced(search);
  useEffect(() => setPage(1), [filter, q]);

  const kind = FILTERS.find((f) => f.value === filter)!.kind;
  const summary = useApi<Summary>('/fees/summary');
  const { data, error, loading, reload } = useApi<Paginated<Student>>(
    `/fees${buildQuery({
      search: q,
      feeStatus: kind === 'status' ? filter : undefined,
      feePlan: kind === 'plan' ? filter : undefined,
      page,
      limit: 20,
    })}`,
  );

  const count = (f: Filter) =>
    !summary.data ? undefined : f === 'all' ? summary.data.all : (summary.data.byStatus as Record<string, number>)[f] ?? (summary.data.byPlan as Record<string, number>)[f];

  const refresh = () => {
    reload();
    summary.reload();
  };

  return (
    <>
      <PageHeader
        title="Fees"
        description={
          summary.data
            ? `Fee status of active students. A fee shows as “Due” ${summary.data.dueReminderDays} day(s) before its due date.`
            : 'Fee status of active students.'
        }
      />

      <div className="-mx-4 mb-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex gap-2" role="tablist" aria-label="Filter fees">
          {FILTERS.map((f, i) => (
            <button
              key={f.value}
              type="button"
              role="tab"
              aria-selected={filter === f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
                filter === f.value ? 'border-primary bg-primary text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
                i === 5 && 'ml-2',
              )}
            >
              {f.label}
              {count(f.value) !== undefined && (
                <span className={cn('rounded-full px-1.5 text-xs', filter === f.value ? 'bg-white/20' : 'bg-slate-100 text-slate-600')}>
                  {count(f.value)}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <Card>
        <div className="border-b border-slate-100 p-4">
          <SearchInput value={search} onChange={setSearch} placeholder="Search student, seat or mobile" className="max-w-md" />
        </div>
        {error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : loading && !data ? (
          <LoadingState />
        ) : !data || data.items.length === 0 ? (
          <EmptyState title="No students in this list" />
        ) : (
          <>
            <ul className="divide-y divide-slate-100 md:hidden">
              {data.items.map((s) => (
                <li key={s.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <Avatar name={s.name} src={s.photoUrl} size="sm" />
                    <div className="min-w-0 flex-1">
                      <Link to={`/students/${s.id}`} className="block truncate font-medium text-slate-900">
                        {s.name}
                      </Link>
                      <p className="text-sm text-slate-600">
                        Seat {s.seatNumber} · {PLAN_LABELS[s.feePlan]} · {formatCurrency(s.feeAmount)}
                      </p>
                      <p className="text-sm text-slate-600">
                        Due {formatDate(s.nextDueDate)} · Last paid {formatDate(s.lastPaymentDate)}
                      </p>
                    </div>
                    <FeeStatusBadge status={s.feeStatus} />
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" className="flex-1" onClick={() => setPaying(s)}>
                      <IndianRupee /> Record payment
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
            <div className="hidden md:block">
              <Table>
                <thead>
                  <tr>
                    <Th>Student</Th>
                    <Th>Seat</Th>
                    <Th>Fee Plan</Th>
                    <Th className="text-right">Fee Amount</Th>
                    <Th>Last Payment</Th>
                    <Th>Next Due</Th>
                    <Th>Status</Th>
                    <Th className="text-right">Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((s) => (
                    <Tr key={s.id}>
                      <Td>
                        <Link to={`/students/${s.id}`} className="flex items-center gap-3 font-medium text-slate-900 hover:text-primary">
                          <Avatar name={s.name} src={s.photoUrl} size="sm" />
                          {s.name}
                        </Link>
                      </Td>
                      <Td className="font-mono text-xs font-semibold">{s.seatNumber}</Td>
                      <Td>{PLAN_LABELS[s.feePlan]}</Td>
                      <Td className="text-right tabular-nums">
                        {formatCurrency(s.feeAmount)}
                        {s.feeStatus === 'partial' && <span className="block text-xs text-slate-500">{formatCurrency(s.balanceDue)} left</span>}
                      </Td>
                      <Td className="whitespace-nowrap">{formatDate(s.lastPaymentDate)}</Td>
                      <Td className="whitespace-nowrap font-medium">{formatDate(s.nextDueDate)}</Td>
                      <Td>
                        <FeeStatusBadge status={s.feeStatus} />
                      </Td>
                      <Td>
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="outline" onClick={() => setPaying(s)}>
                            <IndianRupee /> Pay
                          </Button>
                        </div>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </div>
            <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onChange={setPage} />
          </>
        )}
      </Card>

      <RecordPaymentDialog open={paying !== null} student={paying} onClose={() => setPaying(null)} onRecorded={refresh} />
    </>
  );
}
