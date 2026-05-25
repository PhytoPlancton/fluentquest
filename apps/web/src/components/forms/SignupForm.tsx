import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/form-field';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { SdkError } from '@fluentquest/sdk';

const schema = z.object({
  displayName: z.string().min(1, 'Required').max(64),
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'At least 8 characters'),
});

type FormValues = z.infer<typeof schema>;

export function SignupForm() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [serverError, setServerError] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await api.signup(values);
      await refresh();
      void navigate({ to: '/dashboard' });
    } catch (err) {
      const code = err instanceof SdkError ? err.code : undefined;
      if (code === 'email_taken') {
        setServerError('An account already exists with this email.');
      } else {
        setServerError(
          err instanceof Error ? err.message : 'Unable to sign up. Please try again.',
        );
      }
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <FormField
        label="Display name"
        htmlFor="displayName"
        error={errors.displayName?.message}
      >
        <Input id="displayName" autoComplete="nickname" {...register('displayName')} />
      </FormField>
      <FormField label="Email" htmlFor="email" error={errors.email?.message}>
        <Input id="email" type="email" autoComplete="email" {...register('email')} />
      </FormField>
      <FormField
        label="Password"
        htmlFor="password"
        description="At least 8 characters."
        error={errors.password?.message}
      >
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          {...register('password')}
        />
      </FormField>
      {serverError && (
        <p role="alert" className="text-sm text-[var(--destructive)]">
          {serverError}
        </p>
      )}
      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? 'Creating account…' : 'Create account'}
      </Button>
    </form>
  );
}
