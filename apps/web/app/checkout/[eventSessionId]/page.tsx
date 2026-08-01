import type { Metadata } from 'next';
import { Container } from '@eventory/ui';
import { CheckoutPanel } from '../../../src/components/checkout-panel';

interface CheckoutPageProps {
  params: Promise<{ eventSessionId: string }>;
}

export const metadata: Metadata = { title: 'Checkout' };

export default async function CheckoutPage({
  params,
}: CheckoutPageProps): Promise<React.JSX.Element> {
  const { eventSessionId } = await params;
  return (
    <div className="page-shell">
      <Container>
        <CheckoutPanel eventSessionId={eventSessionId} />
      </Container>
    </div>
  );
}
