import { zodResolver } from '@hookform/resolvers/zod';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { z } from 'zod';
import { ConfirmDialog, ErrorState, LoadingState, PageHeader } from '@/components/common';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Checkbox, Field, Input, Textarea } from '@/components/ui/form-controls';
import { Table, Td, Th, Tr } from '@/components/ui/table';
import { Tabs } from '@/components/ui/tabs';
import { api, errorMessage } from '@/lib/api';
import { useAuth, useIsAdmin } from '@/lib/auth/AuthContext';
import { useApi } from '@/lib/hooks';
import { changePasswordSchema } from '@/lib/validation';
import type { FeePlan, Seat, Settings, Timing, User } from '@/types';

type Tab = 'library' | 'fees' | 'timings' | 'seats' | 'account';

export default function SettingsPage() {
  const [params, setParams] = useSearchParams();
  const isAdmin = useIsAdmin();
  const tab = isAdmin ? (params.get('tab') as Tab) || 'library' : 'account';
  if (!isAdmin) {
    return (
      <>
        <PageHeader title="Settings" description="Your account. Library settings can only be changed by an admin." />
        <AccountSettings />
      </>
    );
  }
  return (
    <>
      <PageHeader title="Settings" description="Library details, fees, timings, seats and your account." />
      <Tabs
        value={tab}
        onChange={(t) => setParams({ tab: t }, { replace: true })}
        items={[
          { value: 'library', label: 'Library' },
          { value: 'fees', label: 'Fee plans' },
          { value: 'timings', label: 'Timings' },
          { value: 'seats', label: 'Seats' },
          { value: 'account', label: 'My account' },
        ]}
        className="mb-5"
      />
      {tab === 'library' && <LibrarySettings />}
      {tab === 'fees' && <FeePlanSettings />}
      {tab === 'timings' && <TimingSettings />}
      {tab === 'seats' && <SeatSettings />}
      {tab === 'account' && <AccountSettings />}
    </>
  );
}

// ---------------- Library ----------------
const librarySchema = z.object({
  libraryName: z.string().trim().min(2, 'Library name is required').max(120),
  contactPhone: z.string().trim().max(30),
  contactEmail: z.string().trim().refine((v) => v === '' || z.string().email().safeParse(v).success, 'Enter a valid email'),
  address: z.string().trim().max(500),
  receiptPrefix: z.string().trim().regex(/^[A-Z0-9]{1,10}$/, '1-10 capital letters or digits'),
  dueReminderDays: z.string().regex(/^\d{1,2}$/, 'Enter 0-60').refine((v) => Number(v) <= 60, 'Enter 0-60'),
});
type LibraryValues = z.infer<typeof librarySchema>;

function LibrarySettings() {
  const { data, error, loading, reload } = useApi<Settings>('/settings');
  const form = useForm<LibraryValues>({ resolver: zodResolver(librarySchema) });
  const { errors, isSubmitting, isDirty } = form.formState;

  useEffect(() => {
    if (data) form.reset({ ...data, dueReminderDays: String(data.dueReminderDays) });
  }, [data, form]);

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading || !data) return <LoadingState />;

  const save = form.handleSubmit(async (v) => {
    try {
      const saved = await api.put<Settings>('/settings', { ...v, dueReminderDays: Number(v.dueReminderDays) });
      form.reset({ ...saved, dueReminderDays: String(saved.dueReminderDays) });
      toast.success('Settings saved');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  });

  return (
    <form onSubmit={save} noValidate className="space-y-5">
      <Card>
        <CardHeader title="Library details" />
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Library name" required error={errors.libraryName?.message} className="sm:col-span-2">
            {(p) => <Input {...p} {...form.register('libraryName')} />}
          </Field>
          <Field label="Contact phone" error={errors.contactPhone?.message}>
            {(p) => <Input {...p} type="tel" {...form.register('contactPhone')} />}
          </Field>
          <Field label="Contact email" error={errors.contactEmail?.message}>
            {(p) => <Input {...p} type="email" {...form.register('contactEmail')} />}
          </Field>
          <Field label="Address" error={errors.address?.message} className="sm:col-span-2">
            {(p) => <Textarea {...p} rows={2} {...form.register('address')} />}
          </Field>
        </CardContent>
      </Card>
      <Card>
        <CardHeader title="Fees" />
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Receipt number prefix" error={errors.receiptPrefix?.message} hint="Receipts look like SSSP-00123">
              {(p) => (
                <Input
                  {...p}
                  className="uppercase"
                  {...form.register('receiptPrefix', { onChange: (e) => form.setValue('receiptPrefix', e.target.value.toUpperCase()) })}
                />
              )}
            </Field>
            <Field label="Show fee as “Due” this many days early" error={errors.dueReminderDays?.message}>
              {(p) => <Input {...p} inputMode="numeric" {...form.register('dueReminderDays')} />}
            </Field>
          </div>
        </CardContent>
      </Card>
      <div className="flex justify-end">
        <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
          Save settings
        </Button>
      </div>
    </form>
  );
}

// ---------------- Fee plans ----------------
function FeePlanSettings() {
  const { data, error, loading, reload } = useApi<FeePlan[]>('/fee-plans');
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setAmounts(Object.fromEntries(data.map((p) => [p.code, String(p.defaultAmount)])));
  }, [data]);

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading || !data) return <LoadingState />;

  const invalid = data.some((p) => !/^\d+(\.\d{1,2})?$/.test(amounts[p.code] ?? ''));
  const save = async () => {
    setSaving(true);
    try {
      await api.put('/fee-plans', data.map((p) => ({ code: p.code, defaultAmount: Number(amounts[p.code]) })));
      toast.success('Default fees saved');
      reload();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="max-w-2xl">
      <CardHeader
        title="Default fee per plan"
        description="Pre-filled when adding a student. Existing students keep their own fee amount."
      />
      <CardContent className="space-y-4">
        {data.map((p) => (
          <Field key={p.code} label={`${p.label} (every ${p.months} month${p.months > 1 ? 's' : ''})`}>
            {(f) => (
              <div className="relative max-w-xs">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">₹</span>
                <Input
                  {...f}
                  inputMode="decimal"
                  className="pl-7"
                  value={amounts[p.code] ?? ''}
                  onChange={(e) => setAmounts((a) => ({ ...a, [p.code]: e.target.value }))}
                />
              </div>
            )}
          </Field>
        ))}
        <div className="flex justify-end">
          <Button onClick={save} loading={saving} disabled={invalid}>
            Save default fees
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------- Timings ----------------
const timingSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(50),
  startTime: z.string(),
  endTime: z.string(),
  sortOrder: z.string().regex(/^-?\d{0,3}$/),
  isActive: z.boolean(),
});
type TimingValues = z.infer<typeof timingSchema>;

function TimingSettings() {
  const { data, error, loading, reload } = useApi<Timing[]>('/timings');
  const [editing, setEditing] = useState<Timing | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Timing | null>(null);
  const [busy, setBusy] = useState(false);

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading || !data) return <LoadingState />;

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await api.delete(`/timings/${deleting._id}`);
      toast.success('Timing deleted');
      setDeleting(null);
      reload();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="max-w-3xl">
      <CardHeader
        title="Timings / shifts"
        description="Options shown when adding a student. Renaming a timing updates its students too."
        action={
          <Button size="sm" onClick={() => setEditing('new')}>
            <Plus /> Add timing
          </Button>
        }
      />
      <Table>
        <thead>
          <tr>
            <Th>Name</Th>
            <Th>Hours</Th>
            <Th>Status</Th>
            <Th className="text-right">Actions</Th>
          </tr>
        </thead>
        <tbody>
          {data.map((t) => (
            <Tr key={t._id}>
              <Td className="font-medium">{t.name}</Td>
              <Td className="whitespace-nowrap text-slate-600">{t.startTime && t.endTime ? `${t.startTime} – ${t.endTime}` : '—'}</Td>
              <Td>{t.isActive ? <Badge tone="green">Active</Badge> : <Badge>Hidden</Badge>}</Td>
              <Td>
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="icon" onClick={() => setEditing(t)} aria-label={`Edit ${t.name}`}>
                    <Pencil />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-red-600" onClick={() => setDeleting(t)} aria-label={`Delete ${t.name}`}>
                    <Trash2 />
                  </Button>
                </div>
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>
      <TimingDialog timing={editing} onClose={() => setEditing(null)} onSaved={reload} />
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        loading={busy}
        destructive
        title="Delete timing?"
        confirmLabel="Delete"
        message={`“${deleting?.name}” will be removed. If students still use it, you'll be asked to hide it instead.`}
      />
    </Card>
  );
}

function TimingDialog({ timing, onClose, onSaved }: { timing: Timing | 'new' | null; onClose: () => void; onSaved: () => void }) {
  const form = useForm<TimingValues>({ resolver: zodResolver(timingSchema) });
  const { errors, isSubmitting } = form.formState;
  useEffect(() => {
    if (!timing) return;
    const t = timing === 'new' ? null : timing;
    form.reset({
      name: t?.name ?? '',
      startTime: t?.startTime ?? '',
      endTime: t?.endTime ?? '',
      sortOrder: String(t?.sortOrder ?? 0),
      isActive: t?.isActive ?? true,
    });
  }, [timing, form]);

  const save = form.handleSubmit(async (v) => {
    const body = { ...v, sortOrder: Number(v.sortOrder) || 0 };
    try {
      if (timing === 'new') await api.post('/timings', body);
      else if (timing) await api.put(`/timings/${timing._id}`, body);
      toast.success('Timing saved');
      onSaved();
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  });

  return (
    <Dialog
      open={timing !== null}
      onClose={onClose}
      title={timing === 'new' ? 'Add timing' : 'Edit timing'}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} loading={isSubmitting}>Save</Button>
        </>
      }
    >
      <form onSubmit={save} noValidate className="space-y-4">
        <Field label="Name" required error={errors.name?.message}>
          {(p) => <Input {...p} placeholder="e.g. Morning" {...form.register('name')} />}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start time">{(p) => <Input {...p} type="time" {...form.register('startTime')} />}</Field>
          <Field label="End time">{(p) => <Input {...p} type="time" {...form.register('endTime')} />}</Field>
        </div>
        <Field label="Display order" hint="Lower numbers are shown first">
          {(p) => <Input {...p} inputMode="numeric" {...form.register('sortOrder')} />}
        </Field>
        <Checkbox label="Active" hint="Hidden timings can't be chosen for new students" {...form.register('isActive')} />
      </form>
    </Dialog>
  );
}

// ---------------- Seats ----------------
function SeatSettings() {
  const { data, error, loading, reload } = useApi<Seat[]>('/seats');
  const [prefix, setPrefix] = useState('A');
  const [from, setFrom] = useState('1');
  const [to, setTo] = useState('20');
  const [single, setSingle] = useState('');
  const [busy, setBusy] = useState(false);

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading || !data) return <LoadingState />;

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      reload();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const addRange = () =>
    run(async () => {
      const r = await api.post<{ created: number; skipped: number }>('/seats/range', { prefix, from: Number(from), to: Number(to) });
      if (r.skipped) toast.info(`${r.skipped} seat(s) already existed`);
    }, 'Seats added');

  const occupied = data.filter((s) => s.occupiedBy.length > 0).length;

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader title="Add seats" description="Seats are optional — they let the Add Student form suggest free seats and the dashboard count free seats." />
        <CardContent className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-700">Add a row of seats</p>
            <div className="flex flex-wrap items-end gap-2">
              <Field label="Row" className="w-20">{(p) => <Input {...p} value={prefix} maxLength={5} className="uppercase" onChange={(e) => setPrefix(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} />}</Field>
              <Field label="From" className="w-20">{(p) => <Input {...p} inputMode="numeric" value={from} onChange={(e) => setFrom(e.target.value.replace(/\D/g, ''))} />}</Field>
              <Field label="To" className="w-20">{(p) => <Input {...p} inputMode="numeric" value={to} onChange={(e) => setTo(e.target.value.replace(/\D/g, ''))} />}</Field>
              <Button onClick={addRange} loading={busy} disabled={!prefix || !from || !to || Number(to) < Number(from)}>
                <Plus /> Add
              </Button>
            </div>
            {prefix && from && to && Number(to) >= Number(from) && (
              <p className="text-xs text-slate-500">
                Creates {prefix}-{from.padStart(2, '0')} … {prefix}-{to.padStart(2, '0')} ({Number(to) - Number(from) + 1} seats)
              </p>
            )}
          </div>
          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-700">Add one seat</p>
            <div className="flex items-end gap-2">
              <Field label="Seat number" className="w-40">{(p) => <Input {...p} value={single} placeholder="B-07" className="uppercase" onChange={(e) => setSingle(e.target.value.toUpperCase())} />}</Field>
              <Button variant="outline" disabled={!single.trim() || busy} onClick={() => run(() => api.post('/seats', { number: single.trim() }).then(() => setSingle('')), 'Seat added')}>
                <Plus /> Add
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader title={`All seats (${data.length})`} description={data.length ? `${occupied} occupied · ${data.length - occupied} free` : undefined} />
        {data.length === 0 ? (
          <p className="p-5 text-sm text-slate-500">No seats added yet.</p>
        ) : (
          <CardContent>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              {data.map((s) => (
                <li
                  key={s._id}
                  className={`group relative rounded-lg border p-2.5 text-sm ${s.occupiedBy.length ? 'border-blue-200 bg-blue-50' : s.isActive ? 'border-slate-200 bg-white' : 'border-dashed border-slate-300 bg-slate-50 text-slate-400'}`}
                >
                  <p className="font-mono font-semibold">{s.number}</p>
                  {s.occupiedBy.length ? (
                    s.occupiedBy.map((o) => (
                      <p key={o.id} className="truncate text-xs text-slate-600" title={`${o.name} · ${o.timing}`}>
                        {o.name} <span className="text-slate-400">· {o.timing}</span>
                      </p>
                    ))
                  ) : (
                    <p className="text-xs text-slate-600">{s.isActive ? 'Free' : 'Disabled'}</p>
                  )}
                  {!s.occupiedBy.length && (
                    <div className="absolute right-1 top-1 flex gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                      <button
                        type="button"
                        className="rounded p-1 text-xs text-slate-500 hover:bg-slate-200"
                        title={s.isActive ? 'Disable seat' : 'Enable seat'}
                        onClick={() => run(() => api.put(`/seats/${s._id}`, { number: s.number, isActive: !s.isActive }), s.isActive ? 'Seat disabled' : 'Seat enabled')}
                      >
                        {s.isActive ? 'Off' : 'On'}
                      </button>
                      <button
                        type="button"
                        className="rounded p-1 text-red-600 hover:bg-red-100"
                        aria-label={`Delete seat ${s.number}`}
                        onClick={() => run(() => api.delete(`/seats/${s._id}`), 'Seat deleted')}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

// ---------------- Account ----------------
function AccountSettings() {
  const { user, setUser } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [savingName, setSavingName] = useState(false);
  const form = useForm<z.infer<typeof changePasswordSchema>>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });
  const { errors, isSubmitting } = form.formState;

  const saveName = async () => {
    setSavingName(true);
    try {
      const r = await api.put<{ user: User }>('/auth/profile', { name: name.trim() });
      setUser(r.user);
      toast.success('Name updated');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSavingName(false);
    }
  };

  const changePassword = form.handleSubmit(async ({ currentPassword, newPassword }) => {
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword });
      form.reset();
      toast.success('Password changed', { description: 'Other devices have been signed out.' });
    } catch (e) {
      toast.error(errorMessage(e));
    }
  });

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader title="Profile" />
        <CardContent className="space-y-4">
          <Field label="Name">{(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} />}</Field>
          <Field label="Email" hint="Used to sign in">{(p) => <Input {...p} value={user?.email ?? ''} disabled />}</Field>
          <div className="flex justify-end">
            <Button onClick={saveName} loading={savingName} disabled={name.trim().length < 2 || name.trim() === user?.name}>
              Save name
            </Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader title="Change password" />
        <CardContent>
          <form onSubmit={changePassword} noValidate className="space-y-4">
            <Field label="Current password" error={errors.currentPassword?.message}>
              {(p) => <Input {...p} type="password" autoComplete="current-password" {...form.register('currentPassword')} />}
            </Field>
            <Field label="New password" error={errors.newPassword?.message} hint="At least 8 characters, with a letter and a number">
              {(p) => <Input {...p} type="password" autoComplete="new-password" {...form.register('newPassword')} />}
            </Field>
            <Field label="Confirm new password" error={errors.confirmPassword?.message}>
              {(p) => <Input {...p} type="password" autoComplete="new-password" {...form.register('confirmPassword')} />}
            </Field>
            <div className="flex justify-end">
              <Button type="submit" loading={isSubmitting}>Change password</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
