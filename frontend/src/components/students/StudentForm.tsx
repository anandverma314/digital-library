import { zodResolver } from '@hookform/resolvers/zod';
import { Pencil, RotateCcw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/form-controls';
import { useApi } from '@/lib/hooks';
import { addMonthsISO, ageFromDob, buildQuery, formatCurrency, formatDate, PAYMENT_MODE_LABELS, PLAN_LABELS, PLAN_MONTHS, todayISO, toInputDate } from '@/lib/utils';
import { studentSchema, type StudentFormValues } from '@/lib/validation';
import type { FeePlan, Student, Timing } from '@/types';
import { PhotoPicker } from './PhotoPicker';

export interface StudentFormSubmit {
  values: StudentFormValues;
  photo: File | null;
  removePhoto: boolean;
}

function defaults(student?: Student): StudentFormValues {
  const today = todayISO();
  return {
    name: student?.name ?? '',
    fatherName: student?.fatherName ?? '',
    motherName: student?.motherName ?? '',
    dob: toInputDate(student?.dob),
    age: student?.age !== undefined ? String(student.age) : '',
    ageOverridden: student?.ageOverridden ?? false,
    gender: student?.gender ?? '',
    seatNumber: student?.seatNumber ?? '',
    timing: student?.timing ?? '',
    mobile: student?.mobile ?? '',
    guardianMobile: student?.guardianMobile ?? '',
    email: student?.email ?? '',
    address: student?.address ?? '',
    feePlan: student?.feePlan ?? 'monthly',
    feeAmount: student ? String(student.feeAmount) : '',
    admissionDate: toInputDate(student?.admissionDate) || today,
    feeStartDate: toInputDate(student?.feeStartDate) || today,
    nextDueDate: toInputDate(student?.nextDueDate) || addMonthsISO(today, 1),
    recordInitialPayment: true,
    initialPaymentMode: 'cash',
    initialTransactionId: '',
  };
}

export function StudentForm({
  student,
  onSubmit,
  onCancel,
}: {
  student?: Student;
  onSubmit: (data: StudentFormSubmit) => Promise<void>;
  onCancel: () => void;
}) {
  const isEdit = Boolean(student);
  const timings = useApi<Timing[]>('/timings');
  const feePlans = useApi<FeePlan[]>('/fee-plans');

  const [photo, setPhoto] = useState<File | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [editDue, setEditDue] = useState(false);
  const amountTouched = useRef(isEdit);

  const form = useForm<StudentFormValues>({ resolver: zodResolver(studentSchema), defaultValues: defaults(student), mode: 'onTouched' });
  const { register, watch, setValue, formState } = form;
  const { errors, isSubmitting } = formState;

  const [name, dob, ageOverridden, feePlan, feeStartDate, recordInitial, feeAmount, nextDueDate, timing] = watch([
    'name', 'dob', 'ageOverridden', 'feePlan', 'feeStartDate', 'recordInitialPayment', 'feeAmount', 'nextDueDate', 'timing',
  ]);
  // Free seats depend on the timing: a seat can be shared by students in non-overlapping timings.
  const seats = useApi<string[]>(`/seats/available${buildQuery({ exceptStudent: student?.id, timing: timing || undefined })}`);

  // Age follows DOB unless the admin has overridden it.
  useEffect(() => {
    if (ageOverridden) return;
    const age = ageFromDob(dob);
    setValue('age', age === null ? '' : String(age));
  }, [dob, ageOverridden, setValue]);

  // New students: next due date = start date + plan (or the start date itself if no fee is collected now).
  useEffect(() => {
    if (isEdit || editDue || !feeStartDate) return;
    setValue('nextDueDate', recordInitial ? addMonthsISO(feeStartDate, PLAN_MONTHS[feePlan]) : feeStartDate, { shouldValidate: true });
  }, [isEdit, editDue, feeStartDate, feePlan, recordInitial, setValue]);

  // Pre-fill the plan's default fee until the admin types their own amount.
  useEffect(() => {
    if (amountTouched.current || !feePlans.data) return;
    const plan = feePlans.data.find((p) => p.code === feePlan);
    if (plan) setValue('feeAmount', String(plan.defaultAmount));
  }, [feePlan, feePlans.data, setValue]);

  // Default the timing to the first active one.
  useEffect(() => {
    if (!isEdit && timings.data?.length && !form.getValues('timing')) {
      const first = timings.data.find((t) => t.isActive);
      if (first) setValue('timing', first.name);
    }
  }, [isEdit, timings.data, form, setValue]);

  const submit = form.handleSubmit((values) => onSubmit({ values, photo, removePhoto }));

  const timingOptions = (timings.data ?? []).filter((t) => t.isActive || t.name === student?.timing);

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <Card>
        <CardHeader title="Student details" />
        <CardContent className="space-y-5">
          <PhotoPicker
            name={name}
            existingUrl={student?.photoUrl}
            file={photo}
            removed={removePhoto}
            onFile={(f) => {
              setPhoto(f);
              if (f) setRemovePhoto(false);
            }}
            onRemove={() => setRemovePhoto(true)}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Student name" required error={errors.name?.message} className="sm:col-span-2">
              {(p) => <Input {...p} autoComplete="off" {...register('name')} />}
            </Field>
            <Field label="Father's name" error={errors.fatherName?.message}>
              {(p) => <Input {...p} {...register('fatherName')} />}
            </Field>
            <Field label="Mother's name" error={errors.motherName?.message}>
              {(p) => <Input {...p} {...register('motherName')} />}
            </Field>
            <Field label="Date of birth" error={errors.dob?.message}>
              {(p) => <Input {...p} type="date" max={todayISO()} {...register('dob')} />}
            </Field>
            <Field
              label="Age"
              error={errors.age?.message}
              hint={ageOverridden ? 'Entered manually' : dob ? 'Calculated from date of birth' : 'Enter DOB to calculate, or type it'}
            >
              {(p) => (
                <div className="flex gap-2">
                  <Input
                    {...p}
                    inputMode="numeric"
                    maxLength={3}
                    readOnly={!ageOverridden && Boolean(dob)}
                    className={!ageOverridden && dob ? 'bg-slate-50' : undefined}
                    {...register('age', {
                      onChange: () => {
                        if (!dob) setValue('ageOverridden', true);
                      },
                    })}
                  />
                  {dob && (
                    <Button
                      variant="outline"
                      className="shrink-0"
                      onClick={() => setValue('ageOverridden', !ageOverridden)}
                      title={ageOverridden ? 'Use calculated age' : 'Type age manually'}
                    >
                      {ageOverridden ? <RotateCcw /> : <Pencil />}
                      <span className="hidden sm:inline">{ageOverridden ? 'Auto' : 'Override'}</span>
                    </Button>
                  )}
                </div>
              )}
            </Field>
            <fieldset className="space-y-1.5 sm:col-span-2">
              <legend className="text-sm font-medium text-slate-700">Gender</legend>
              <div className="flex flex-wrap gap-2">
                {(['male', 'female', 'other'] as const).map((g) => (
                  <label
                    key={g}
                    className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary-soft has-[:checked]:text-primary"
                  >
                    <input type="radio" value={g} className="accent-primary" {...register('gender')} />
                    {g === 'male' ? 'Male' : g === 'female' ? 'Female' : 'Other'}
                  </label>
                ))}
              </div>
            </fieldset>
            <Field
              label="Seat number"
              required
              error={errors.seatNumber?.message}
              hint={seats.data?.length ? `${seats.data.length} free seat(s)${timing ? ` in ${timing}` : ''} — start typing to pick one` : 'e.g. A-01'}
            >
              {(p) => (
                <>
                  <Input
                    {...p}
                    list="free-seats"
                    autoComplete="off"
                    placeholder="A-01"
                    className="uppercase"
                    {...register('seatNumber', { onChange: (e) => setValue('seatNumber', e.target.value.toUpperCase()) })}
                  />
                  <datalist id="free-seats">
                    {seats.data?.map((s) => <option key={s} value={s} />)}
                  </datalist>
                </>
              )}
            </Field>
            <Field label="Timing" required error={errors.timing?.message}>
              {(p) => (
                <Select {...p} {...register('timing')}>
                  <option value="">Select timing</option>
                  {timingOptions.map((t) => (
                    <option key={t._id} value={t.name}>
                      {t.name}
                      {t.startTime && t.endTime ? ` (${t.startTime}–${t.endTime})` : ''}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="Contact & address" />
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Student mobile" required error={errors.mobile?.message}>
            {(p) => <Input {...p} type="tel" inputMode="tel" placeholder="98765 43210" autoComplete="off" {...register('mobile')} />}
          </Field>
          <Field label="Guardian phone" error={errors.guardianMobile?.message}>
            {(p) => <Input {...p} type="tel" inputMode="tel" placeholder="98765 43210" autoComplete="off" {...register('guardianMobile')} />}
          </Field>
          <Field label="Email address" error={errors.email?.message} className="sm:col-span-2">
            {(p) => <Input {...p} type="email" autoComplete="off" {...register('email')} />}
          </Field>
          <Field label="Permanent address" error={errors.address?.message} className="sm:col-span-2">
            {(p) => <Textarea {...p} rows={3} {...register('address')} />}
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader
          title="Fee information"
          description={isEdit ? 'Changing the plan or amount applies from the next payment.' : 'Set up the fee plan for this student.'}
        />
        <CardContent className="space-y-4">
          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium text-slate-700">
              Fee plan <span className="text-red-600">*</span>
            </legend>
            <div className="grid grid-cols-3 gap-2">
              {(['monthly', 'half_yearly', 'yearly'] as const).map((code) => {
                const plan = feePlans.data?.find((p) => p.code === code);
                return (
                  <label
                    key={code}
                    className="flex cursor-pointer flex-col items-center rounded-lg border border-slate-300 px-2 py-3 text-center text-sm has-[:checked]:border-primary has-[:checked]:bg-primary-soft has-[:checked]:text-primary"
                  >
                    <input type="radio" value={code} className="sr-only" {...register('feePlan')} />
                    <span className="font-semibold">{PLAN_LABELS[code]}</span>
                    {plan && <span className="text-xs text-slate-500">{formatCurrency(plan.defaultAmount)}</span>}
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Fee amount (₹)" required error={errors.feeAmount?.message} hint={`Per ${PLAN_LABELS[feePlan].toLowerCase()} period`}>
              {(p) => (
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">₹</span>
                  <Input
                    {...p}
                    inputMode="decimal"
                    className="pl-7"
                    {...register('feeAmount', { onChange: () => (amountTouched.current = true) })}
                  />
                </div>
              )}
            </Field>
            <Field label="Admission date" required error={errors.admissionDate?.message}>
              {(p) => <Input {...p} type="date" {...register('admissionDate')} />}
            </Field>
            <Field label="Fee start date" required error={errors.feeStartDate?.message}>
              {(p) => <Input {...p} type="date" {...register('feeStartDate')} />}
            </Field>
            <Field
              label="Next fee due date"
              required
              error={errors.nextDueDate?.message}
              hint={
                isEdit
                  ? 'Normally updated automatically when payments are recorded'
                  : editDue
                    ? 'Set manually'
                    : `Calculated: ${recordInitial ? `fee start + ${PLAN_MONTHS[feePlan]} month(s)` : 'due on fee start date'}`
              }
            >
              {(p) => (
                <div className="flex gap-2">
                  <Input {...p} type="date" readOnly={!isEdit && !editDue} className={!isEdit && !editDue ? 'bg-slate-50' : undefined} {...register('nextDueDate')} />
                  {!isEdit && (
                    <Button variant="outline" className="shrink-0" onClick={() => setEditDue((v) => !v)} title={editDue ? 'Calculate automatically' : 'Edit manually'}>
                      {editDue ? <RotateCcw /> : <Pencil />}
                    </Button>
                  )}
                </div>
              )}
            </Field>
          </div>

          {!isEdit && (
            <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <Checkbox
                label={`First fee collected now${feeAmount ? ` (${formatCurrency(Number(feeAmount) || 0)})` : ''}`}
                hint={
                  recordInitial
                    ? `A receipt is created and the next fee is due on ${formatDate(nextDueDate)}.`
                    : 'Untick if the student will pay later — the fee will show as due from the fee start date.'
                }
                {...register('recordInitialPayment')}
              />
              {recordInitial && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Payment mode">
                    {(p) => (
                      <Select {...p} {...register('initialPaymentMode')}>
                        {Object.entries(PAYMENT_MODE_LABELS).map(([v, l]) => (
                          <option key={v} value={v}>{l}</option>
                        ))}
                      </Select>
                    )}
                  </Field>
                  <Field label="Transaction / reference no." error={errors.initialTransactionId?.message}>
                    {(p) => <Input {...p} placeholder="Optional" {...register('initialTransactionId')} />}
                  </Field>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {Object.keys(errors).length > 0 && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          Please fix the highlighted fields.
        </p>
      )}

      <div className="sticky bottom-0 -mx-4 flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:flex-row sm:justify-end sm:border-0 sm:bg-transparent sm:p-0">
        <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" size="lg" loading={isSubmitting}>
          {isEdit ? 'Save changes' : 'Add student'}
        </Button>
      </div>
    </form>
  );
}
