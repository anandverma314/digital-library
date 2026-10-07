import { Plus } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '@/components/common';
import { PaymentHistory } from '@/components/payments/PaymentHistory';
import { RecordPaymentDialog } from '@/components/payments/RecordPaymentDialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function PaymentsPage() {
  const [open, setOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <>
      <PageHeader
        title="Payments"
        description="Record fee payments and search all receipts."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus /> Record payment
          </Button>
        }
      />
      <Card>
        <PaymentHistory refreshKey={refreshKey} />
      </Card>
      <RecordPaymentDialog open={open} onClose={() => setOpen(false)} onRecorded={() => setRefreshKey((k) => k + 1)} />
    </>
  );
}
