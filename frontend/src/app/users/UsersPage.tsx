import { zodResolver } from '@hookform/resolvers/zod';
import { KeyRound, Pencil, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { ErrorState, LoadingState, PageHeader } from '@/components/common';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Checkbox, Field, Input, Select } from '@/components/ui/form-controls';
import { Table, Td, Th, Tr } from '@/components/ui/table';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth/AuthContext';
import { useApi } from '@/lib/hooks';
import { formatDateTime } from '@/lib/utils';
import { PASSWORD_MESSAGE, PASSWORD_REGEX } from '@/lib/validation';
import type { ManagedUser, UserRole } from '@/types';

const ROLE_LABELS: Record<UserRole, string> = { admin: 'Admin', user: 'User' };

export default function UsersPage() {
  const { user: me } = useAuth();
  const { data, error, loading, reload } = useApi<ManagedUser[]>('/users');
  const [editing, setEditing] = useState<ManagedUser | 'new' | null>(null);
  const [passwordFor, setPasswordFor] = useState<ManagedUser | null>(null);

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading && !data) return <LoadingState />;

  return (
    <>
      <PageHeader
        title="Users"
        description="Admins have full access. Users can do day-to-day work but cannot change settings or manage users."
        actions={
          <Button onClick={() => setEditing('new')}>
            <Plus /> Add user
          </Button>
        }
      />
      <Card>
        <Table>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Email</Th>
              <Th>Role</Th>
              <Th>Status</Th>
              <Th>Last login</Th>
              <Th className="text-right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {data?.map((u) => (
              <Tr key={u.id}>
                <Td className="font-medium">
                  {u.name}
                  {u.id === me?.id && <span className="ml-1.5 text-xs text-slate-500">(you)</span>}
                </Td>
                <Td className="whitespace-nowrap">{u.email}</Td>
                <Td>{u.role === 'admin' ? <Badge tone="blue">Admin</Badge> : <Badge>User</Badge>}</Td>
                <Td>{u.isActive ? <Badge tone="green">Active</Badge> : <Badge tone="red">Disabled</Badge>}</Td>
                <Td className="whitespace-nowrap text-slate-600">{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : 'Never'}</Td>
                <Td>
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setEditing(u)} aria-label={`Edit ${u.name}`} title="Edit">
                      <Pencil />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setPasswordFor(u)} aria-label={`Set password for ${u.name}`} title="Set password">
                      <KeyRound />
                    </Button>
                  </div>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Card>
      <UserDialog user={editing} isSelf={editing !== 'new' && editing?.id === me?.id} onClose={() => setEditing(null)} onSaved={reload} />
      <PasswordDialog user={passwordFor} onClose={() => setPasswordFor(null)} />
    </>
  );
}

const userSchema = z.object({
  name: z.string().trim().min(2, 'Name is required').max(80),
  email: z.string().trim().email('Enter a valid email address'),
  // Only required when creating; checked in the submit handler.
  password: z.string(),
  role: z.enum(['admin', 'user']),
  isActive: z.boolean(),
});
type UserValues = z.infer<typeof userSchema>;

function UserDialog({ user, isSelf, onClose, onSaved }: { user: ManagedUser | 'new' | null; isSelf: boolean; onClose: () => void; onSaved: () => void }) {
  const isNew = user === 'new';
  const form = useForm<UserValues>({ resolver: zodResolver(userSchema) });
  const { errors, isSubmitting } = form.formState;

  useEffect(() => {
    if (!user) return;
    const u = user === 'new' ? null : user;
    form.reset({ name: u?.name ?? '', email: u?.email ?? '', password: '', role: u?.role ?? 'user', isActive: u?.isActive ?? true });
  }, [user, form]);

  const save = form.handleSubmit(async (v) => {
    try {
      if (isNew) {
        if (!PASSWORD_REGEX.test(v.password)) {
          form.setError('password', { message: PASSWORD_MESSAGE });
          return;
        }
        await api.post('/users', { name: v.name, email: v.email, password: v.password, role: v.role });
        toast.success('User created');
      } else if (user) {
        await api.put(`/users/${user.id}`, isSelf ? { name: v.name } : { name: v.name, role: v.role, isActive: v.isActive });
        toast.success('User updated');
      }
      onSaved();
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  });

  return (
    <Dialog
      open={user !== null}
      onClose={onClose}
      title={isNew ? 'Add user' : 'Edit user'}
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
          {(p) => <Input {...p} {...form.register('name')} />}
        </Field>
        <Field label="Email" required error={errors.email?.message} hint={isNew ? 'Used to sign in' : 'Email cannot be changed'}>
          {(p) => <Input {...p} type="email" autoComplete="off" disabled={!isNew} {...form.register('email')} />}
        </Field>
        {isNew && (
          <Field label="Password" required error={errors.password?.message} hint={PASSWORD_MESSAGE}>
            {(p) => <Input {...p} type="password" autoComplete="new-password" {...form.register('password')} />}
          </Field>
        )}
        <Field label="Role" hint={isSelf ? 'You cannot change your own role' : undefined}>
          {(p) => (
            <Select {...p} disabled={isSelf} {...form.register('role')}>
              {Object.entries(ROLE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </Select>
          )}
        </Field>
        {!isNew && !isSelf && <Checkbox label="Active" hint="Disabled users cannot sign in" {...form.register('isActive')} />}
      </form>
    </Dialog>
  );
}

const passwordSchema = z
  .object({ password: z.string().regex(PASSWORD_REGEX, PASSWORD_MESSAGE), confirmPassword: z.string() })
  .refine((d) => d.password === d.confirmPassword, { message: 'Passwords do not match', path: ['confirmPassword'] });

function PasswordDialog({ user, onClose }: { user: ManagedUser | null; onClose: () => void }) {
  const form = useForm<z.infer<typeof passwordSchema>>({ resolver: zodResolver(passwordSchema) });
  const { errors, isSubmitting } = form.formState;

  useEffect(() => {
    if (user) form.reset({ password: '', confirmPassword: '' });
  }, [user, form]);

  const save = form.handleSubmit(async ({ password }) => {
    if (!user) return;
    try {
      await api.post(`/users/${user.id}/password`, { password });
      toast.success(`Password updated for ${user.name}`, { description: 'They have been signed out everywhere.' });
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  });

  return (
    <Dialog
      open={user !== null}
      onClose={onClose}
      title="Set password"
      description={user ? `New password for ${user.name}` : undefined}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} loading={isSubmitting}>Set password</Button>
        </>
      }
    >
      <form onSubmit={save} noValidate className="space-y-4">
        <Field label="New password" error={errors.password?.message} hint={PASSWORD_MESSAGE}>
          {(p) => <Input {...p} type="password" autoComplete="new-password" {...form.register('password')} />}
        </Field>
        <Field label="Confirm password" error={errors.confirmPassword?.message}>
          {(p) => <Input {...p} type="password" autoComplete="new-password" {...form.register('confirmPassword')} />}
        </Field>
      </form>
    </Dialog>
  );
}
