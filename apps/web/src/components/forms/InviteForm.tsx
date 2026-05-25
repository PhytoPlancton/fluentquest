import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/form-field';
import { api } from '@/lib/api';
import { SdkError } from '@fluentquest/sdk';

const schema = z.object({
  email: z.string().email('Invalid email'),
  role: z.enum(['admin', 'member']),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  workspaceId: string;
  onInvited: () => void;
}

export function InviteForm({ workspaceId, onInvited }: Props) {
  const [serverError, setServerError] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { role: 'member' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await api.createInvitation(workspaceId, values);
      reset({ email: '', role: 'member' });
      onInvited();
      toast.success('Invitation sent');
    } catch (err) {
      const code = err instanceof SdkError ? err.code : undefined;
      if (code === 'already_member') {
        setServerError('This person is already a member.');
      } else if (code === 'invitation_already_pending') {
        setServerError('An invitation is already pending for this email.');
      } else {
        setServerError(err instanceof Error ? err.message : 'Failed to send invitation.');
      }
    }
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <FormField
        label="Email"
        htmlFor="invite-email"
        error={errors.email?.message}
        className="flex-1"
      >
        <Input id="invite-email" type="email" placeholder="teammate@company.com" {...register('email')} />
      </FormField>
      <FormField label="Role" htmlFor="invite-role" error={errors.role?.message}>
        <select
          id="invite-role"
          className="flex h-9 rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ring)]"
          {...register('role')}
        >
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </select>
      </FormField>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Inviting…' : 'Invite'}
      </Button>
      {serverError && (
        <p role="alert" className="text-sm text-[var(--destructive)] sm:w-full">
          {serverError}
        </p>
      )}
    </form>
  );
}
