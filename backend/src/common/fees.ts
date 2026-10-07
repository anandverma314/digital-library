import { addDays, addMonths, today } from './dates.js';

export const FEE_PLANS = ['monthly', 'half_yearly', 'yearly'] as const;
export type FeePlanCode = (typeof FEE_PLANS)[number];

export const PLAN_MONTHS: Record<FeePlanCode, number> = {
  monthly: 1,
  half_yearly: 6,
  yearly: 12,
};

export const PLAN_LABELS: Record<FeePlanCode, string> = {
  monthly: 'Monthly',
  half_yearly: 'Half-Yearly',
  yearly: 'Yearly',
};

export const FEE_STATUSES = ['paid', 'due', 'overdue', 'partial'] as const;
export type FeeStatus = (typeof FEE_STATUSES)[number];

export const FEE_STATUS_LABELS: Record<FeeStatus, string> = {
  paid: 'Paid',
  due: 'Due',
  overdue: 'Overdue',
  partial: 'Partially Paid',
};

export const PAYMENT_MODES = ['cash', 'upi', 'card', 'bank_transfer', 'cheque', 'other'] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];

export const PAYMENT_MODE_LABELS: Record<PaymentMode, string> = {
  cash: 'Cash',
  upi: 'UPI',
  card: 'Card',
  bank_transfer: 'Bank Transfer',
  cheque: 'Cheque',
  other: 'Other',
};

export function nextDueFrom(date: Date, plan: FeePlanCode): Date {
  return addMonths(date, PLAN_MONTHS[plan]);
}

/**
 * Fee status rules
 *  - Paid:           next due date is more than `dueWindowDays` away
 *  - Due:            next due date is today or within the next `dueWindowDays`
 *  - Overdue:        next due date has passed
 *  - Partially Paid: Due/Overdue, but part of the current period's fee has been paid
 */
export function computeFeeStatus(
  nextDueDate: Date,
  feeCredit: number,
  dueWindowDays: number,
): FeeStatus {
  const t = today();
  if (nextDueDate > addDays(t, dueWindowDays)) return 'paid';
  if (feeCredit > 0) return 'partial';
  return nextDueDate < t ? 'overdue' : 'due';
}

/** MongoDB filter equivalent of computeFeeStatus, so lists can be filtered and paginated in the DB. */
export function feeStatusFilter(status: FeeStatus, dueWindowDays: number): Record<string, unknown> {
  const t = today();
  const windowEnd = addDays(t, dueWindowDays);
  switch (status) {
    case 'paid':
      return { nextDueDate: { $gt: windowEnd } };
    case 'partial':
      return { nextDueDate: { $lte: windowEnd }, feeCredit: { $gt: 0 } };
    case 'overdue':
      return { nextDueDate: { $lt: t }, feeCredit: { $lte: 0 } };
    case 'due':
      return { nextDueDate: { $gte: t, $lte: windowEnd }, feeCredit: { $lte: 0 } };
  }
}

/**
 * Applies a payment to a student's fee account. Each full fee amount moves the
 * next due date forward by one plan period; any remainder is kept as credit
 * (shown as "Partially Paid" once the due date arrives).
 */
export function applyPayment(
  current: { nextDueDate: Date; feeCredit: number; feeAmount: number; feePlan: FeePlanCode },
  amount: number,
): { nextDueDate: Date; feeCredit: number; periodsCovered: number } {
  let credit = round2(current.feeCredit + amount);
  let nextDueDate = current.nextDueDate;
  let periodsCovered = 0;
  if (current.feeAmount > 0) {
    while (credit >= current.feeAmount) {
      credit = round2(credit - current.feeAmount);
      nextDueDate = nextDueFrom(nextDueDate, current.feePlan);
      periodsCovered++;
    }
  }
  return { nextDueDate, feeCredit: credit, periodsCovered };
}

/**
 * A payment may be part of one period (kept as credit) or clear whole periods exactly, but never
 * leave extra money over once at least one period is covered. Returns an error message, or null when allowed.
 */
export function extraPaymentError(feeCredit: number, feeAmount: number, amount: number): string | null {
  const credit = Math.round(feeCredit * 100);
  const fee = Math.round(feeAmount * 100);
  const total = credit + Math.round(amount * 100);
  if (fee <= 0 || total < fee || total % fee === 0) return null;
  const periods = Math.floor(total / fee);
  const rupees = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN')}`;
  return (
    `This leaves ${rupees(total % fee)} extra. Pay ${rupees(periods * fee - credit)} for ${periods} period(s)` +
    ` or ${rupees((periods + 1) * fee - credit)} for ${periods + 1}.`
  );
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
