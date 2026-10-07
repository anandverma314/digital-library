import { AlertTriangle, ArrowRight, Armchair, CheckCircle2, CircleDashed, Clock, IndianRupee, Plus, Users } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { Avatar, EmptyState, ErrorState, LoadingState, PageHeader } from '@/components/common';
import { FeeStatusBadge } from '@/components/fees/StatusBadges';
import { RecordPaymentDialog } from '@/components/payments/RecordPaymentDialog';
import { Button, buttonClass } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { useAuth } from '@/lib/auth/AuthContext';
import { useApi } from '@/lib/hooks';
import { cn, formatCurrency, formatDate, PAYMENT_MODE_LABELS } from '@/lib/utils';
import type { FeeStatus, Payment, Student } from '@/types';

interface Dashboard {
  students: { active: number; inactive: number; newThisMonth: number };
  feeStatus: Record<FeeStatus, number>;
  collections: Record<'today' | 'thisMonth' | 'lastMonth', { total: number; count: number }>;
  seats: { total: number; occupied: number };
  attention: Student[];
  recentPayments: Payment[];
  dueReminderDays: number;
}

function StatTile({ label, value, sub, icon: Icon, to }: { label: string; value: string; sub?: string; icon: typeof Users; to?: string }) {
  const body = (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <Icon className="size-5 text-slate-400" aria-hidden />
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900 sm:text-3xl">{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </>
  );
  const cls = 'rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5';
  return to ? (
    <Link to={to} className={cn(cls, 'block transition-colors hover:border-primary/40 hover:bg-slate-50')}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

const STATUS_TILES: { status: FeeStatus; label: string; icon: typeof Users; color: string }[] = [
  { status: 'overdue', label: 'Overdue', icon: AlertTriangle, color: 'text-status-critical' },
  { status: 'due', label: 'Due soon', icon: Clock, color: 'text-amber-600' },
  { status: 'partial', label: 'Partially paid', icon: CircleDashed, color: 'text-orange-600' },
  { status: 'paid', label: 'Paid', icon: CheckCircle2, color: 'text-status-good' },
];

export default function DashboardPage() {
  const { user } = useAuth();
  const { data, error, loading, reload } = useApi<Dashboard>('/dashboard');
  const [payFor, setPayFor] = useState<Student | null | undefined>(undefined);

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading && !data) return <LoadingState />;
  if (!data) return null;

  const change = data.collections.lastMonth.total
    ? Math.round(((data.collections.thisMonth.total - data.collections.lastMonth.total) / data.collections.lastMonth.total) * 100)
    : null;

  return (
    <>
      <PageHeader
        title={`Hello, ${user?.name.split(' ')[0] ?? 'Admin'}`}
        description={new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        actions={
          <>
            <Button variant="outline" onClick={() => setPayFor(null)}>
              <IndianRupee /> Record payment
            </Button>
            <Link to="/students/new" className={buttonClass()}>
              <Plus /> Add student
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatTile
          label="Active students"
          value={String(data.students.active)}
          sub={`${data.students.newThisMonth} joined this month`}
          icon={Users}
          to="/students"
        />
        <StatTile
          label="Collected this month"
          value={formatCurrency(data.collections.thisMonth.total)}
          sub={
            change === null
              ? `${data.collections.thisMonth.count} payment(s)`
              : `${change >= 0 ? '▲' : '▼'} ${Math.abs(change)}% vs last month (${formatCurrency(data.collections.lastMonth.total)})`
          }
          icon={IndianRupee}
          to="/payments"
        />
        <StatTile
          label="Collected today"
          value={formatCurrency(data.collections.today.total)}
          sub={`${data.collections.today.count} payment(s)`}
          icon={IndianRupee}
        />
        <StatTile
          label="Seats occupied"
          value={data.seats.total ? `${data.seats.occupied} / ${data.seats.total}` : String(data.seats.occupied)}
          sub={data.seats.total ? `${Math.max(data.seats.total - data.seats.occupied, 0)} free` : 'Add seats in Settings to track free seats'}
          icon={Armchair}
          to={data.seats.total ? undefined : '/settings?tab=seats'}
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {STATUS_TILES.map(({ status, label, icon: Icon, color }) => (
          <Link
            key={status}
            to={`/students?feeStatus=${status}`}
            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:bg-slate-50"
          >
            <Icon className={cn('size-6 shrink-0', color)} aria-hidden />
            <div>
              <p className="text-xl font-bold tabular-nums text-slate-900">{data.feeStatus[status]}</p>
              <p className="text-sm text-slate-600">{label}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Needs attention"
            description={`Overdue, or due within ${data.dueReminderDays} day(s)`}
            action={
              <Link to="/fees" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                All fees <ArrowRight className="size-4" />
              </Link>
            }
          />
          {data.attention.length === 0 ? (
            <EmptyState title="All caught up" description="No fees are overdue or due soon." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.attention.map((s) => (
                <li key={s.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                  <Avatar name={s.name} src={s.photoUrl} size="sm" />
                  <div className="min-w-0 flex-1">
                    <Link to={`/students/${s.id}`} className="block truncate text-sm font-medium text-slate-900 hover:text-primary">
                      {s.name}
                    </Link>
                    <p className="text-xs text-slate-500">
                      Seat {s.seatNumber} · due {formatDate(s.nextDueDate)} · {formatCurrency(s.balanceDue)}
                    </p>
                  </div>
                  <FeeStatusBadge status={s.feeStatus} />
                  <Button size="sm" variant="outline" onClick={() => setPayFor(s)} aria-label={`Record payment for ${s.name}`}>
                    <IndianRupee /> <span className="hidden sm:inline">Pay</span>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Recent payments"
            action={
              <Link to="/payments" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                All payments <ArrowRight className="size-4" />
              </Link>
            }
          />
          {data.recentPayments.length === 0 ? (
            <EmptyState title="No payments yet" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.recentPayments.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
                  <div className="min-w-0">
                    <Link to={`/students/${p.student}`} className="block truncate text-sm font-medium text-slate-900 hover:text-primary">
                      {p.studentName}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {formatDate(p.paymentDate)} · {PAYMENT_MODE_LABELS[p.paymentMode]} · {p.receiptNumber}
                    </p>
                  </div>
                  <span className="font-semibold tabular-nums text-slate-900">{formatCurrency(p.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <RecordPaymentDialog open={payFor !== undefined} student={payFor ?? null} onClose={() => setPayFor(undefined)} onRecorded={reload} />
    </>
  );
}
