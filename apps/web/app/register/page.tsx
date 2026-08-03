import type { Metadata } from 'next';
import { AuthForm } from '../../src/components/auth-form';
export const metadata: Metadata = { title: 'Create an account' };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}): Promise<React.JSX.Element> {
  const { next } = await searchParams;
  const nextPath = Array.isArray(next) ? next[0] : next;
  return <AuthForm mode="register" {...(nextPath ? { nextPath } : {})} />;
}
