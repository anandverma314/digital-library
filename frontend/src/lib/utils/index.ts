import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { FeePlanCode, FeeStatus, Gender, PaymentMode } from '@/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const PLAN_LABELS: Record<FeePlanCode, string> = {
  monthly: 'Monthly',
  half_yearly: 'Half-Yearly',
  yearly: 'Yearly',
};
export const PLAN_MONTHS: Record<FeePlanCode, number> = { monthly: 1, half_yearly: 6, yearly: 12 };

export const FEE_STATUS_LABELS: Record<FeeStatus, string> = {
  paid: 'Paid',
  due: 'Due',
  overdue: 'Overdue',
  partial: 'Partially Paid',
};

export const PAYMENT_MODE_LABELS: Record<PaymentMode, string> = {
  cash: 'Cash',
  upi: 'UPI',
  card: 'Card',
  bank_transfer: 'Bank Transfer',
  cheque: 'Cheque',
  other: 'Other',
};

export const GENDER_LABELS: Record<Gender, string> = { male: 'Male', female: 'Female', other: 'Other' };

/** Dates from the API are UTC-midnight ISO strings; show them as DD-MM-YYYY. */
export function formatDate(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${d.getUTCFullYear()}`;
}

export function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

export function formatCurrency(amount?: number | null): string {
  if (amount === undefined || amount === null) return '—';
  return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

/** YYYY-MM-DD for <input type="date"> */
export function toInputDate(value?: string | null): string {
  return value ? value.slice(0, 10) : '';
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Adds months to a YYYY-MM-DD date, clamping the day (31 Jan + 1 month = 28/29 Feb). */
export function addMonthsISO(iso: string, months: number): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const lastDay = new Date(Date.UTC(y, m - 1 + months + 1, 0)).getUTCDate();
  const r = new Date(Date.UTC(y, m - 1 + months, Math.min(d, lastDay)));
  return r.toISOString().slice(0, 10);
}

export function ageFromDob(iso: string): number | null {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  const now = new Date();
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age--;
  return age >= 0 ? age : null;
}

/** Mirrors the backend: each full fee moves the due date by one period, remainder is credit. */
export function previewPayment(
  nextDueDate: string,
  feeCredit: number,
  feeAmount: number,
  plan: FeePlanCode,
  amount: number,
) {
  let credit = Math.round((feeCredit + amount) * 100) / 100;
  let due = nextDueDate.slice(0, 10);
  let periods = 0;
  if (feeAmount > 0) {
    while (credit >= feeAmount && periods < 120) {
      credit = Math.round((credit - feeAmount) * 100) / 100;
      due = addMonthsISO(due, PLAN_MONTHS[plan]);
      periods++;
    }
  }
  return { nextDueDate: due, credit, periods };
}

/** Same rule as the backend: part of one period, or whole periods exactly - never extra left over. */
export function extraPaymentError(feeCredit: number, feeAmount: number, amount: number): string | null {
  const credit = Math.round(feeCredit * 100);
  const fee = Math.round(feeAmount * 100);
  const total = credit + Math.round(amount * 100);
  if (fee <= 0 || total < fee || total % fee === 0) return null;
  const periods = Math.floor(total / fee);
  return (
    `This leaves ${formatCurrency((total % fee) / 100)} extra. Pay ${formatCurrency((periods * fee - credit) / 100)} for ${periods} period(s)` +
    ` or ${formatCurrency(((periods + 1) * fee - credit) / 100)} for ${periods + 1}.`
  );
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}

/** Removes empty-string values so optional fields are sent as "not provided". */
export function compact<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== '' && v !== undefined && v !== null)) as Partial<T>;
}

export function buildQuery(params: Record<string, string | number | undefined | null>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}
