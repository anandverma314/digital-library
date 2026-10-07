import { Download } from 'lucide-react';
import { useEffect, useState } from 'react';
import { EmptyState, ErrorState, LoadingState, Pagination, SearchInput } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/form-controls';
import { Table, Td, Th, Tr } from '@/components/ui/table';
import { useApi, useDebounced } from '@/lib/hooks';
import { buildQuery, formatCurrency, formatDate, PAYMENT_MODE_LABELS, PLAN_LABELS } from '@/lib/utils';
import type { Paginated, Payment } from '@/types';
import { PaymentDetailsDialog } from './PaymentDetailsDialog';

/** Searchable, filterable payment list. With `studentId` it shows one student's history. */
export function PaymentHistory({ studentId, refreshKey = 0, onChanged }: { studentId?: string; refreshKey?: number; onChanged?: () => void }) {
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [mode, setMode] = useState('');
  const [plan, setPlan] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const q = useDebounced(search);

  const filters = { studentId, search: q, from, to, paymentMode: mode, feePlan: plan };
  useEffect(() => setPage(1), [q, from, to, mode, plan]);

  const { data, error, loading, reload } = useApi<Paginated<Payment> & { totalAmount: number }>(
    `/payments${buildQuery({ ...filters, page, limit: 15 })}`,
  );
  useEffect(() => {
    if (refreshKey) reload();
  }, [refreshKey, reload]);

  const hasFilters = Boolean(search || from || to || mode || plan);

  return (
    <div>
      <div className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-2 lg:grid-cols-5">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder={studentId ? 'Receipt or transaction no.' : 'Student, receipt, seat or txn no.'}
          className="sm:col-span-2 lg:col-span-1"
        />
        <Field label="From" className="[&>label]:sr-only">
          {(p) => <Input {...p} type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" title="From date" />}
        </Field>
        <Field label="To" className="[&>label]:sr-only">
          {(p) => <Input {...p} type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} aria-label="To date" title="To date" />}
        </Field>
        <Select value={mode} onChange={(e) => setMode(e.target.value)} aria-label="Payment mode">
          <option value="">All modes</option>
          {Object.entries(PAYMENT_MODE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </Select>
        <Select value={plan} onChange={(e) => setPlan(e.target.value)} aria-label="Fee plan">
          <option value="">All fee plans</option>
          {Object.entries(PLAN_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </Select>
      </div>

      {data && data.total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
          <span className="text-slate-600">
            Total collected{hasFilters ? ' (filtered)' : ''}: <strong className="text-slate-900">{formatCurrency(data.totalAmount)}</strong>
          </span>
          <div className="flex gap-2">
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setFrom(''); setTo(''); setMode(''); setPlan(''); }}>
                Clear filters
              </Button>
            )}
            <a href={`/api/reports/payments.csv${buildQuery(filters)}`} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-primary hover:bg-primary-soft">
              <Download className="size-4" /> Export CSV
            </a>
          </div>
        </div>
      )}

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading && !data ? (
        <LoadingState />
      ) : !data || data.items.length === 0 ? (
        <EmptyState title={hasFilters ? 'No payments match these filters' : 'No payments yet'} />
      ) : (
        <>
          {/* Phones: cards */}
          <ul className="divide-y divide-slate-100 md:hidden">
            {data.items.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => setSelected(p.id)} className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50">
                  <div className="min-w-0">
                    {!studentId && <p className="truncate font-medium text-slate-900">{p.studentName}</p>}
                    <p className="text-sm text-slate-600">
                      {formatDate(p.paymentDate)} · {p.receiptNumber}
                    </p>
                    <p className="text-xs text-slate-500">
                      {PAYMENT_MODE_LABELS[p.paymentMode]} · {PLAN_LABELS[p.feePlan]}
                    </p>
                  </div>
                  <span className="font-semibold text-slate-900">{formatCurrency(p.amount)}</span>
                </button>
              </li>
            ))}
          </ul>
          {/* Tablet & desktop: table */}
          <div className="hidden md:block">
            <Table>
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Receipt No.</Th>
                  {!studentId && <Th>Student</Th>}
                  {!studentId && <Th>Seat</Th>}
                  <Th className="text-right">Amount</Th>
                  <Th>Mode</Th>
                  <Th>Fee Plan</Th>
                  <Th className="text-right">Details</Th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((p) => (
                  <Tr key={p.id} className="cursor-pointer" onClick={() => setSelected(p.id)}>
                    <Td className="whitespace-nowrap">{formatDate(p.paymentDate)}</Td>
                    <Td className="whitespace-nowrap font-mono text-xs">
                      {p.receiptNumber}
                    </Td>
                    {!studentId && <Td className="font-medium">{p.studentName}</Td>}
                    {!studentId && <Td>{p.seatNumber}</Td>}
                    <Td className="text-right font-semibold tabular-nums">{formatCurrency(p.amount)}</Td>
                    <Td>{PAYMENT_MODE_LABELS[p.paymentMode]}</Td>
                    <Td>{PLAN_LABELS[p.feePlan]}</Td>
                    <Td className="text-right">
                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setSelected(p.id); }}>
                        View
                      </Button>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </div>
          <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onChange={setPage} />
        </>
      )}

      <PaymentDetailsDialog
        paymentId={selected}
        onClose={() => setSelected(null)}
        onChanged={() => {
          reload();
          onChanged?.();
        }}
      />
    </div>
  );
}
