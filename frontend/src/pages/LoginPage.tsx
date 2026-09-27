import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { FormErrorBanner } from '../components/ui/FormErrorBanner';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const from = (location.state as { from?: string } | null)?.from;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login({ email: email.trim(), password });
      navigate(from ?? '/orders', { replace: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not sign in.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Sign in"
      description="Customers see their orders and refund requests. Support staff land in the review queue."
      footer={
        <>
          Need an account?{' '}
          <Link to="/signup" className="font-semibold text-[#e86438] hover:underline">
            Create one
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <FormErrorBanner message={error} />
        <Input
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <Input
          label="Password"
          type="password"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <Button type="submit" size="lg" className="w-full border-[#e86438] bg-[#e86438] hover:border-[#cc4d28] hover:bg-[#cc4d28]" loading={submitting} disabled={submitting}>
          Sign in
        </Button>
        <div className="rounded-2xl border border-[#1d241f]/10 bg-white/60 p-4 text-xs leading-5 text-[#657068] dark:border-white/10 dark:bg-white/5 dark:text-[#c4c9c3]">
          <p className="font-semibold text-[#1d241f] dark:text-white">Demo accounts (password: Password123!)</p>
          <p className="mt-1 font-mono">admin@refoond.dev</p>
          <p className="font-mono">amara.okafor@example.com</p>
        </div>
      </form>
    </AuthLayout>
  );
}
