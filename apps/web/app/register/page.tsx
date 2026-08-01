import type { Metadata } from 'next';
import { AuthForm } from '../../src/components/auth-form';
export const metadata: Metadata = { title: 'Create an account' };
export default function RegisterPage(): React.JSX.Element {
  return <AuthForm mode="register" />;
}
