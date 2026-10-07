import { ArrowLeft, History, IndianRupee, Pencil, Phone, Power, UserCheck } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { toast } from 'sonner';
import { Avatar, ConfirmDialog, ErrorState, InfoRow, LoadingState } from '@/components/common';
import { FeeStatusBadge, StudentStatusBadge } from '@/components/fees/StatusBadges';
import { PaymentHistory } from '@/components/payments/PaymentHistory';
import { RecordPaymentDialog } from '@/components/payments/RecordPaymentDialog';
import { Button, buttonClass } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { api, errorMessage } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { formatCurrency, formatDate, GENDER_LABELS, PLAN_LABELS } from '@/lib/utils';
import type { Student } from '@/types';

export default function StudentDetailsPage() {
  const { id } = useParams();
  const { data: s, error, loading, reload } = useApi<Student>(`/students/${id}`);
  const [payOpen, setPayOpen] = useState(false);
  const [confirmStatus, setConfirmStatus] = useState(false);
  const [busy, setBusy] = useState(false);
  const [historyKey, setHistoryKey] = useState(0);

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading && !s) return <LoadingState />;
  if (!s) return null;

  const toggleStatus = async () => {
    setBusy(true);
    try {
      await api.patch(`/students/${s.id}/${s.status === 'active' ? 'deactivate' : 'activate'}`);
      toast.success(s.status === 'active' ? 'Student deactivated' : 'Student reactivated');
      setConfirmStatus(false);
      reload();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const scrollToHistory = () => document.getElementById('payment-history')?.scrollIntoView({ behavior: 'smooth' });

  return (
    <div className="space-y-5">
      <Link to="/students" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeft className="size-4" /> Students
      </Link>

      {/* Header */}
      <Card>
        <CardContent className="flex flex-col gap-5 md:flex-row md:items-center">
          <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
            <Avatar name={s.name} src={s.photoUrl} size="xl" />
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{s.name}</h1>
              <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm text-slate-600 sm:justify-start">
                <span>
                  Seat: <strong className="text-slate-900">{s.seatNumber}</strong>
                </span>
                <span>
                  Timing: <strong className="text-slate-900">{s.timing}</strong>
                </span>
              </div>
              <div className="mt-2 flex flex-wrap justify-center gap-2 sm:justify-start">
                <StudentStatusBadge status={s.status} />
                <FeeStatusBadge status={s.feeStatus} />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap md:ml-auto md:max-w-md md:justify-end">
            <Button onClick={() => setPayOpen(true)} className="col-span-2 sm:col-span-1">
              <IndianRupee /> Record payment
            </Button>
            <Link to={`/students/${s.id}/edit`} className={buttonClass('outline')}>
              <Pencil /> Edit
            </Link>
            <Button variant="outline" onClick={scrollToHistory}>
              <History /> Payments
            </Button>
            <Button
              variant="outline"
              onClick={() => setConfirmStatus(true)}
              className={s.status === 'active' ? 'text-red-600 hover:bg-red-50' : undefined}
            >
              {s.status === 'active' ? <><Power /> Deactivate</> : <><UserCheck /> Reactivate</>}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Personal information" />
          <CardContent className="py-2">
            <dl className="divide-y divide-slate-100">
              <InfoRow label="Father's name" value={s.fatherName} />
              <InfoRow label="Mother's name" value={s.motherName} />
              <InfoRow label="Date of birth" value={s.dob ? formatDate(s.dob) : undefined} />
              <InfoRow label="Age" value={s.age !== undefined ? `${s.age} years` : undefined} />
              <InfoRow label="Gender" value={s.gender ? GENDER_LABELS[s.gender] : undefined} />
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Contact information" />
          <CardContent className="py-2">
            <dl className="divide-y divide-slate-100">
              <InfoRow
                label="Student mobile"
                value={
                  <a href={`tel:${s.mobile}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                    <Phone className="size-3.5" /> {s.mobile}
                  </a>
                }
              />
              <InfoRow
                label="Guardian mobile"
                value={
                  s.guardianMobile && (
                    <a href={`tel:${s.guardianMobile}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                      <Phone className="size-3.5" /> {s.guardianMobile}
                    </a>
                  )
                }
              />
              <InfoRow label="Email" value={s.email && <a href={`mailto:${s.email}`} className="text-primary hover:underline">{s.email}</a>} />
              <InfoRow label="Permanent address" value={s.address && <span className="whitespace-pre-line">{s.address}</span>} />
            </dl>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Fee information" />
          <CardContent className="grid gap-x-8 py-2 md:grid-cols-2">
            <dl className="divide-y divide-slate-100">
              <InfoRow label="Fee plan" value={PLAN_LABELS[s.feePlan]} />
              <InfoRow label="Fee amount" value={formatCurrency(s.feeAmount)} />
              <InfoRow label="Admission date" value={formatDate(s.admissionDate)} />
              <InfoRow label="Fee start date" value={formatDate(s.feeStartDate)} />
            </dl>
            <dl className="divide-y divide-slate-100 border-t border-slate-100 md:border-t-0">
              <InfoRow label="Last payment" value={formatDate(s.lastPaymentDate)} />
              <InfoRow label="Next due date" value={formatDate(s.nextDueDate)} />
              <InfoRow label="Fee status" value={<FeeStatusBadge status={s.feeStatus} />} />
              <InfoRow
                label={s.feeStatus === 'paid' ? 'Advance paid' : 'Balance due'}
                value={formatCurrency(s.feeStatus === 'paid' ? s.feeCredit : s.balanceDue)}
              />
            </dl>
          </CardContent>
        </Card>
      </div>

      <Card id="payment-history" className="scroll-mt-20">
        <CardHeader
          title="Payment history"
          action={
            <Button size="sm" onClick={() => setPayOpen(true)}>
              <IndianRupee /> Record payment
            </Button>
          }
        />
        <PaymentHistory studentId={s.id} refreshKey={historyKey} onChanged={reload} />
      </Card>

      <RecordPaymentDialog
        open={payOpen}
        onClose={() => setPayOpen(false)}
        student={s}
        onRecorded={() => {
          reload();
          setHistoryKey((k) => k + 1);
        }}
      />
      <ConfirmDialog
        open={confirmStatus}
        onClose={() => setConfirmStatus(false)}
        onConfirm={toggleStatus}
        loading={busy}
        destructive={s.status === 'active'}
        title={s.status === 'active' ? 'Deactivate student?' : 'Reactivate student?'}
        confirmLabel={s.status === 'active' ? 'Deactivate' : 'Reactivate'}
        message={
          s.status === 'active'
            ? `Seat ${s.seatNumber} will become free. ${s.name}'s details and payment history are kept.`
            : `${s.name} will get seat ${s.seatNumber} back, if it is still free.`
        }
      />
    </div>
  );
}
