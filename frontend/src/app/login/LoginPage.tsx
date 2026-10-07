import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useLocation, useNavigate } from 'react-router';
import { toast } from 'sonner';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/form-controls';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth/AuthContext';
import { loginSchema } from '@/lib/validation';
import type { User } from '@/types';

export default function LoginPage() {
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<z.infer<typeof loginSchema>>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      const { user } = await api.post<{ user: User }>('/auth/login', values);
      setUser(user);
      toast.success(`Welcome back, ${user.name}`);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from && from !== '/login' ? from : '/dashboard', { replace: true });
    } catch (e) {
      setError(errorMessage(e));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Sign in</h2>
        <p className="text-sm text-slate-500">Enter your admin email and password.</p>
      </div>
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
      <Field label="Email" error={errors.email?.message}>
        {(p) => <Input {...p} type="email" autoComplete="username" autoFocus {...form.register('email')} />}
      </Field>
      <Field label="Password" error={errors.password?.message}>
        {(p) => <Input {...p} type="password" autoComplete="current-password" {...form.register('password')} />}
      </Field>
      <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
        Sign in
      </Button>
    </form>
  );
}
