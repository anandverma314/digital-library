import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Check, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Avatar, SearchInput } from '@/components/common';
import { FeeStatusBadge } from '@/components/fees/StatusBadges';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/form-controls';
import { api, errorMessage } from '@/lib/api';
import { useApi, useDebounced } from '@/lib/hooks';
import { buildQuery, extraPaymentError, formatCurrency, formatDate, PAYMENT_MODE_LABELS, PLAN_LABELS, previewPayment, todayISO } from '@/lib/utils';
import { paymentSchema, type PaymentFormValues } from '@/lib/validation';
import type { FeePlan, Paginated, Payment, Student } from '@/types';

export function RecordPaymentDialog({
  open,
  onClose,
  student: fixedStudent,
  onRecorded,
}: {
  open: boolean;
  onClose: () => void;
  /** When given, the student cannot be changed. */
  student?: Student | null;
  onRecorded?: (payment: Payment) => void;
}) {
  const [student, setStudent] = useState<Student | null>(fixedStudent ?? null);
  const feePlans = useApi<FeePlan[]>(open ? '/fee-plans' : null);

  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: blank(),
  });
  const { register, watch, setValue, reset, formState } = form;
  const { errors, isSubmitting } = formState;
  const [amount, feePlan, newFeeAmount] = watch(['amount', 'feePlan', 'newFeeAmount']);

  // Reset whenever the dialog opens.
  useEffect(() => {
    if (!open) return;
    setStudent(fixedStudent ?? null);
    reset(blank(fixedStudent ?? null));
  }, [open, fixedStudent, reset]);

  const pick = (s: Student | null) => {
    setStudent(s);
    reset(blank(s));
  };

  const planChanged = student !== null && feePlan !== student.feePlan;
  useEffect(() => {
    if (!planChanged) return;
    const plan = feePlans.data?.find((p) => p.code === feePlan);
    if (plan) setValue('newFeeAmount', String(plan.defaultAmount));
  }, [planChanged, feePlan, feePlans.data, setValue]);

  const effectiveFee = planChanged ? Number(newFeeAmount) || 0 : (student?.feeAmount ?? 0);
  const preview =
    student && Number(amount) > 0 && effectiveFee > 0
      ? previewPayment(student.nextDueDate, student.feeCredit, effectiveFee, feePlan, Number(amount))
      : null;
  // Credit is kept on a plan change, so this matches the server's check exactly.
  const extra = student && Number(amount) > 0 && effectiveFee > 0 ? extraPaymentError(student.feeCredit, effectiveFee, Number(amount)) : null;

  const submit = form.handleSubmit(async (v) => {
    if (planChanged && !(Number(v.newFeeAmount) > 0)) {
      form.setError('newFeeAmount', { message: 'Enter the fee amount for the new plan' });
      return;
    }
    if (extra) {
      form.setError('amount', { message: 'Amount is more than the fee for whole periods' });
      return;
    }
    try {
      const res = await api.post<{ payment: Payment }>('/payments', {
        studentId: v.studentId,
        paymentDate: v.paymentDate,
        amount: Number(v.amount),
        feePlan: v.feePlan,
        newFeeAmount: planChanged ? Number(v.newFeeAmount) : undefined,
        paymentMode: v.paymentMode,
        transactionId: v.transactionId || undefined,
        remarks: v.remarks || undefined,
      });
      toast.success(`Payment recorded · Receipt ${res.payment.receiptNumber}`);
      onRecorded?.(res.payment);
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Record payment"
      description={student ? `${student.name} · Seat ${student.seatNumber}` : 'Find the student who is paying'}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={submit} loading={isSubmitting} disabled={!student}>
            <Check /> Save payment
          </Button>
        </>
      }
    >
      {!student ? (
        <StudentPicker onPick={pick} />
      ) : (
        <form onSubmit={submit} noValidate className="space-y-4">
          <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <Avatar name={student.name} src={student.photoUrl} size="sm" />
            <div className="min-w-0 flex-1 text-sm">
              <p className="truncate font-medium text-slate-900">{student.name}</p>
              <p className="text-slate-500">
                {PLAN_LABELS[student.feePlan]} · {formatCurrency(student.feeAmount)} · due {formatDate(student.nextDueDate)}
                {student.feeCredit > 0 && ` · ${formatCurrency(student.feeCredit)} already paid`}
              </p>
            </div>
            <FeeStatusBadge status={student.feeStatus} />
            {!fixedStudent && (
              <button type="button" onClick={() => pick(null)} className="rounded p-1 text-slate-500 hover:bg-slate-200" aria-label="Choose another student">
                <X className="size-4" />
              </button>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Amount (₹)" required error={errors.amount?.message}>
              {(p) => (
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">₹</span>
                  <Input {...p} inputMode="decimal" className="pl-7" autoFocus {...register('amount')} />
                </div>
              )}
            </Field>
            <Field label="Payment date" required error={errors.paymentDate?.message}>
              {(p) => <Input {...p} type="date" max={todayISO()} {...register('paymentDate')} />}
            </Field>
            <Field label="Payment mode" required>
              {(p) => (
                <Select {...p} {...register('paymentMode')}>
                  {Object.entries(PAYMENT_MODE_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Fee plan" hint={planChanged ? 'The student will be moved to this plan' : undefined}>
              {(p) => (
                <Select {...p} {...register('feePlan')}>
                  {Object.entries(PLAN_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </Select>
              )}
            </Field>
            {planChanged && (
              <Field label={`New ${PLAN_LABELS[feePlan].toLowerCase()} fee (₹)`} required error={errors.newFeeAmount?.message}>
                {(p) => <Input {...p} inputMode="decimal" {...register('newFeeAmount')} />}
              </Field>
            )}
            <Field label="Transaction / UPI ref. no." error={errors.transactionId?.message} hint="Receipt number is generated automatically">
              {(p) => <Input {...p} placeholder="Optional" {...register('transactionId')} />}
            </Field>
            <Field label="Remarks" error={errors.remarks?.message} className="sm:col-span-2">
              {(p) => <Textarea {...p} rows={2} placeholder="Optional" {...register('remarks')} />}
            </Field>
          </div>

          {extra ? (
            <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
              {extra}
            </p>
          ) : preview && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
              {preview.periods > 0 ? (
                <p className="flex flex-wrap items-center gap-1.5">
                  Covers {preview.periods} period{preview.periods > 1 ? 's' : ''}. Next due date:
                  <span className="font-medium">{formatDate(student.nextDueDate)}</span>
                  <ArrowRight className="size-4" />
                  <span className="font-semibold">{formatDate(preview.nextDueDate)}</span>
                </p>
              ) : (
                <p>
                  Partial payment — {formatCurrency(effectiveFee - preview.credit)} more is needed to cover the period due{' '}
                  {formatDate(student.nextDueDate)}.
                </p>
              )}
            </div>
          )}
        </form>
      )}
    </Dialog>
  );
}

function blank(student?: Student | null): PaymentFormValues {
  return {
    studentId: student?.id ?? '',
    paymentDate: todayISO(),
    amount: student ? String(student.balanceDue > 0 ? student.balanceDue : student.feeAmount) : '',
    feePlan: student?.feePlan ?? 'monthly',
    newFeeAmount: '',
    paymentMode: 'cash',
    transactionId: '',
    remarks: '',
  };
}

function StudentPicker({ onPick }: { onPick: (s: Student) => void }) {
  const [search, setSearch] = useState('');
  const q = useDebounced(search);
  const { data, loading } = useApi<Paginated<Student>>(`/students${buildQuery({ search: q, limit: 8, status: 'active', sort: 'name' })}`);

  return (
    <div className="space-y-3">
      <SearchInput value={search} onChange={setSearch} placeholder="Search by name, seat or mobile" />
      <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
        {loading && !data && <li className="p-4 text-sm text-slate-500">Loading…</li>}
        {data?.items.length === 0 && <li className="p-4 text-sm text-slate-500">No active students found.</li>}
        {data?.items.map((s) => (
          <li key={s.id}>
            <button type="button" onClick={() => onPick(s)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50">
              <Avatar name={s.name} src={s.photoUrl} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900">{s.name}</p>
                <p className="text-xs text-slate-500">
                  Seat {s.seatNumber} · {s.mobile} · due {formatDate(s.nextDueDate)}
                </p>
              </div>
              <FeeStatusBadge status={s.feeStatus} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
