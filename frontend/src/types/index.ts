export type FeePlanCode = 'monthly' | 'half_yearly' | 'yearly';
export type FeeStatus = 'paid' | 'due' | 'overdue' | 'partial';
export type PaymentMode = 'cash' | 'upi' | 'card' | 'bank_transfer' | 'cheque' | 'other';
export type Gender = 'male' | 'female' | 'other';
export type StudentStatus = 'active' | 'inactive';

export type UserRole = 'admin' | 'user';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

/** A login account as listed on the admin-only Users page. */
export interface ManagedUser extends User {
  isActive: boolean;
  lastLoginAt: string | null;
}

export interface Student {
  id: string;
  name: string;
  photoUrl: string | null;
  hasPhoto: boolean;
  fatherName?: string;
  motherName?: string;
  dob?: string;
  age?: number;
  ageOverridden: boolean;
  gender?: Gender;
  seatNumber: string;
  timing: string;
  mobile: string;
  guardianMobile?: string;
  email?: string;
  address?: string;
  feePlan: FeePlanCode;
  feeAmount: number;
  admissionDate: string;
  feeStartDate: string;
  nextDueDate: string;
  lastPaymentDate?: string;
  feeCredit: number;
  balanceDue: number;
  feeStatus: FeeStatus;
  status: StudentStatus;
  deactivatedAt?: string;
  createdAt: string;
}

export interface Payment {
  id: string;
  student: string;
  studentName: string;
  seatNumber: string;
  paymentDate: string;
  amount: number;
  feePlan: FeePlanCode;
  paymentMode: PaymentMode;
  receiptNumber: string;
  transactionId?: string;
  remarks?: string;
  dueDateBefore?: string;
  nextDueDateAfter?: string;
  isAdmissionPayment: boolean;
  createdAt: string;
}

export interface PaymentDetails extends Omit<Payment, 'student'> {
  student: Pick<Student, 'id' | 'name' | 'mobile' | 'seatNumber' | 'timing' | 'status'> & { email?: string } | null;
  canDelete: boolean;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface Settings {
  libraryName: string;
  contactPhone: string;
  contactEmail: string;
  address: string;
  receiptPrefix: string;
  dueReminderDays: number;
}

export interface Timing {
  _id: string;
  name: string;
  startTime?: string;
  endTime?: string;
  sortOrder: number;
  isActive: boolean;
}

export interface Seat {
  _id: string;
  number: string;
  isActive: boolean;
  /** Active students on this seat; several are allowed when their timings don't overlap. */
  occupiedBy: { id: string; name: string; timing: string }[];
}

export interface FeePlan {
  _id: string;
  code: FeePlanCode;
  label: string;
  months: number;
  defaultAmount: number;
}
