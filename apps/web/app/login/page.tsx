import type { Metadata } from 'next';
import { AuthForm } from '../../src/components/auth-form';
export const metadata: Metadata = { title: 'Sign in' };
export default function LoginPage(): React.JSX.Element {
  return <AuthForm mode="login" />;
}
