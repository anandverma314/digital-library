import type { Types } from 'mongoose';
import { ageFromDob } from '../common/dates.js';
import { computeFeeStatus, type FeeStatus } from '../common/fees.js';
import type { Student } from '../models/student.schema.js';

type StudentLike = Student & { _id: Types.ObjectId };

export type StudentView = Omit<StudentLike, '_id' | 'photo'> & {
  id: string;
  hasPhoto: boolean;
  photoUrl: string | null;
  feeStatus: FeeStatus;
  balanceDue: number;
};

/** Shapes a student for the API: id, photo URL, live age and fee status. */
export function presentStudent(s: StudentLike, dueWindowDays: number): StudentView {
  const { _id, photo, ...rest } = s as StudentLike & { __v?: number };
  delete (rest as { __v?: number }).__v;
  const id = String(_id);
  const age = !s.ageOverridden && s.dob ? ageFromDob(s.dob) : s.age;
  const feeStatus = computeFeeStatus(s.nextDueDate, s.feeCredit ?? 0, dueWindowDays);
  return {
    ...rest,
    id,
    age,
    hasPhoto: Boolean(photo),
    // Version query busts the browser cache when the photo changes.
    photoUrl: photo ? `/api/students/${id}/photo?v=${encodeURIComponent(photo)}` : null,
    feeStatus,
    balanceDue: feeStatus === 'paid' ? 0 : Math.max((s.feeAmount ?? 0) - (s.feeCredit ?? 0), 0),
  };
}

export function presentDoc<T extends { _id: Types.ObjectId }>(doc: T): Omit<T, '_id'> & { id: string } {
  const { _id, ...rest } = doc as T & { __v?: number };
  delete (rest as { __v?: number }).__v;
  return { ...rest, id: String(_id) };
}
