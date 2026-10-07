import { Printer, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { ConfirmDialog, InfoRow, LoadingState } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { api, errorMessage } from '@/lib/api';
import { useIsAdmin } from '@/lib/auth/AuthContext';
import { useApi } from '@/lib/hooks';
import { formatCurrency, formatDate, formatDateTime, PAYMENT_MODE_LABELS, PLAN_LABELS } from '@/lib/utils';
import type { PaymentDetails } from '@/types';

export function PaymentDetailsDialog({ paymentId, onClose, onChanged }: { paymentId: string | null; onClose: () => void; onChanged?: () => void }) {
  const isAdmin = useIsAdmin();
  const { data: p, loading } = useApi<PaymentDetails>(paymentId ? `/payments/${paymentId}` : null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const remove = async () => {
    if (!p) return;
    setDeleting(true);
    try {
      await api.delete(`/payments/${p.id}`);
      toast.success('Payment deleted and the fee account restored');
      setConfirmDelete(false);
      onChanged?.();
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Dialog
        open={paymentId !== null}
        onClose={onClose}
        title={p ? `Receipt ${p.receiptNumber}` : 'Payment details'}
        footer={
          p && (
            <>
              {isAdmin && p.canDelete && (
                <Button variant="ghost" className="text-red-600 hover:bg-red-50 sm:mr-auto" onClick={() => setConfirmDelete(true)}>
                  <Trash2 /> Delete
                </Button>
              )}
              <Button variant="outline" onClick={() => window.print()}>
                <Printer /> Print
              </Button>
            </>
          )
        }
      >
        {loading || !p ? (
          <LoadingState />
        ) : (
          <dl className="divide-y divide-slate-100">
            <InfoRow
              label="Student"
              value={
                p.student ? (
                  <Link to={`/students/${p.student.id}`} className="text-primary hover:underline" onClick={onClose}>
                    {p.studentName}
                  </Link>
                ) : (
                  p.studentName
                )
              }
            />
            <InfoRow label="Seat number" value={p.seatNumber} />
            <InfoRow label="Amount" value={<span className="text-base">{formatCurrency(p.amount)}</span>} />
            <InfoRow label="Payment date" value={formatDate(p.paymentDate)} />
            <InfoRow label="Payment mode" value={PAYMENT_MODE_LABELS[p.paymentMode]} />
            <InfoRow label="Transaction / ref. no." value={p.transactionId} />
            <InfoRow label="Fee plan" value={PLAN_LABELS[p.feePlan]} />
            <InfoRow label="Due date before" value={formatDate(p.dueDateBefore)} />
            <InfoRow label="Next due date after" value={formatDate(p.nextDueDateAfter)} />
            <InfoRow label="Remarks" value={p.remarks} />
            <InfoRow label="Recorded on" value={formatDateTime(p.createdAt)} />
          </dl>
        )}
      </Dialog>
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={remove}
        loading={deleting}
        destructive
        title="Delete this payment?"
        confirmLabel="Delete payment"
        message={
          <p>
            Use this only for a payment entered by mistake. The student&apos;s next due date and balance will go back to what they were before
            this payment. This cannot be undone.
          </p>
        }
      />
    </>
  );
}
