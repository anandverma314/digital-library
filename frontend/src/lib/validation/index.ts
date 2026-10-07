import { z } from 'zod';

/** Same rules as the backend. */
export const INDIAN_MOBILE_REGEX = /^(?:\+91[\s-]?|91[\s-]?|0)?[6-9]\d{9}$/;
export const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d).{8,72}$/;
export const PASSWORD_MESSAGE = 'At least 8 characters, with a letter and a number';

export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
export const PHOTO_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

const optionalText = (max: number) => z.string().trim().max(max, `Maximum ${max} characters`);
const money = z
  .string()
  .trim()
  .min(1, 'Fee amount is required')
  .regex(/^\d+(\.\d{1,2})?$/, 'Enter a valid amount, e.g. 1000');

export const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const newPasswordFields = {
  newPassword: z.string().regex(PASSWORD_REGEX, PASSWORD_MESSAGE),
  confirmPassword: z.string(),
};
const passwordsMatch = (d: { newPassword: string; confirmPassword: string }) => d.newPassword === d.confirmPassword;
const mismatch = { message: 'Passwords do not match', path: ['confirmPassword'] };

export const changePasswordSchema = z
  .object({ currentPassword: z.string().min(1, 'Enter your current password'), ...newPasswordFields })
  .refine(passwordsMatch, mismatch);

export const studentSchema = z
  .object({
    name: z.string().trim().min(2, 'Student name is required').max(100),
    fatherName: optionalText(100),
    motherName: optionalText(100),
    dob: z.string(),
    age: z.string().regex(/^(\d{1,3})?$/, 'Enter a valid age'),
    ageOverridden: z.boolean(),
    gender: z.enum(['', 'male', 'female', 'other']),
    seatNumber: z
      .string()
      .trim()
      .min(1, 'Seat number is required')
      .regex(/^[A-Za-z0-9-]{1,20}$/, 'Use letters, digits and "-" only, e.g. A-01'),
    timing: z.string().min(1, 'Select a timing'),
    mobile: z.string().trim().regex(INDIAN_MOBILE_REGEX, 'Enter a valid 10-digit mobile number (starts with 6-9)'),
    guardianMobile: z
      .string()
      .trim()
      .refine((v) => v === '' || INDIAN_MOBILE_REGEX.test(v), 'Enter a valid 10-digit phone number'),
    email: z
      .string()
      .trim()
      .refine((v) => v === '' || z.string().email().safeParse(v).success, 'Enter a valid email address'),
    address: optionalText(500),
    feePlan: z.enum(['monthly', 'half_yearly', 'yearly']),
    feeAmount: money,
    admissionDate: z.string().min(1, 'Admission date is required'),
    feeStartDate: z.string().min(1, 'Fee start date is required'),
    nextDueDate: z.string().min(1, 'Next due date is required'),
    recordInitialPayment: z.boolean(),
    initialPaymentMode: z.enum(['cash', 'upi', 'card', 'bank_transfer', 'cheque', 'other']),
    initialTransactionId: optionalText(100),
  })
  .refine((d) => !d.ageOverridden || (d.age !== '' && Number(d.age) >= 3 && Number(d.age) <= 100), {
    message: 'Enter an age between 3 and 100',
    path: ['age'],
  })
  .refine((d) => !d.dob || d.dob <= new Date().toISOString().slice(0, 10), {
    message: 'Date of birth cannot be in the future',
    path: ['dob'],
  })
  .refine((d) => !d.feeStartDate || !d.nextDueDate || d.nextDueDate >= d.feeStartDate, {
    message: 'Next due date cannot be before the fee start date',
    path: ['nextDueDate'],
  });

export type StudentFormValues = z.infer<typeof studentSchema>;

export const paymentSchema = z
  .object({
    studentId: z.string().min(1, 'Select a student'),
    paymentDate: z.string().min(1, 'Payment date is required'),
    amount: z
      .string()
      .trim()
      .regex(/^\d+(\.\d{1,2})?$/, 'Enter a valid amount')
      .refine((v) => Number(v) >= 1, 'Amount must be at least ₹1'),
    feePlan: z.enum(['monthly', 'half_yearly', 'yearly']),
    newFeeAmount: z.string().trim(),
    paymentMode: z.enum(['cash', 'upi', 'card', 'bank_transfer', 'cheque', 'other']),
    transactionId: optionalText(100),
    remarks: optionalText(500),
  })
  .refine((d) => d.paymentDate <= new Date(Date.now() + 86400000).toISOString().slice(0, 10), {
    message: 'Payment date cannot be in the future',
    path: ['paymentDate'],
  });

export type PaymentFormValues = z.infer<typeof paymentSchema>;
