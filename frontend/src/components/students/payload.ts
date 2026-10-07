import { compact } from '@/lib/utils';
import type { StudentFormValues } from '@/lib/validation';
import type { StudentFormSubmit } from './StudentForm';

/** Builds the multipart body the API expects: JSON in `data` + optional `photo`. */
export function studentFormData({ values, photo, removePhoto }: StudentFormSubmit, isEdit: boolean): FormData {
  const v: StudentFormValues = values;
  const base = {
    name: v.name,
    fatherName: v.fatherName,
    motherName: v.motherName,
    dob: v.dob,
    age: v.age ? Number(v.age) : undefined,
    ageOverridden: v.ageOverridden,
    gender: v.gender,
    seatNumber: v.seatNumber.toUpperCase(),
    timing: v.timing,
    mobile: v.mobile,
    guardianMobile: v.guardianMobile,
    email: v.email,
    address: v.address,
    feePlan: v.feePlan,
    feeAmount: Number(v.feeAmount),
    admissionDate: v.admissionDate,
    feeStartDate: v.feeStartDate,
    nextDueDate: v.nextDueDate,
  };
  const data = isEdit
    ? { ...compact(base), removePhoto }
    : {
        ...compact(base),
        recordInitialPayment: v.recordInitialPayment,
        initialPaymentMode: v.recordInitialPayment ? v.initialPaymentMode : undefined,
        initialTransactionId: v.recordInitialPayment ? v.initialTransactionId || undefined : undefined,
      };

  const form = new FormData();
  form.append('data', JSON.stringify(data));
  if (photo) form.append('photo', photo);
  return form;
}
