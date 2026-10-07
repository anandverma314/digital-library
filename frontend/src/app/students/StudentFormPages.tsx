import { ArrowLeft } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { ErrorState, LoadingState, PageHeader } from '@/components/common';
import { studentFormData } from '@/components/students/payload';
import { StudentForm, type StudentFormSubmit } from '@/components/students/StudentForm';
import { api, ApiError, errorMessage } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import type { Student } from '@/types';

function BackLink({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className="mb-2 inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
      <ArrowLeft className="size-4" /> {label}
    </Link>
  );
}

function showError(e: unknown) {
  if (e instanceof ApiError && e.details.length > 1) {
    toast.error('Please check the form', { description: e.details.join(' · ') });
  } else {
    toast.error(errorMessage(e));
  }
}

export function AddStudentPage() {
  const navigate = useNavigate();

  const submit = async (data: StudentFormSubmit) => {
    try {
      const res = await api.postForm<{ student: Student; initialPayment: { receiptNumber: string } | null }>(
        '/students',
        studentFormData(data, false),
      );
      toast.success(`${res.student.name} added to seat ${res.student.seatNumber}`, {
        description: res.initialPayment ? `Receipt ${res.initialPayment.receiptNumber} created` : undefined,
      });
      navigate(`/students/${res.student.id}`, { replace: true });
    } catch (e) {
      showError(e);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Add student" back={<BackLink to="/students" label="Students" />} />
      <StudentForm onSubmit={submit} onCancel={() => navigate('/students')} />
    </div>
  );
}

export function EditStudentPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: student, error, loading, reload } = useApi<Student>(`/students/${id}`);

  const submit = async (data: StudentFormSubmit) => {
    try {
      await api.putForm<Student>(`/students/${id}`, studentFormData(data, true));
      toast.success('Changes saved');
      navigate(`/students/${id}`, { replace: true });
    } catch (e) {
      showError(e);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={student ? `Edit ${student.name}` : 'Edit student'} back={<BackLink to={`/students/${id}`} label="Back to profile" />} />
      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading || !student ? (
        <LoadingState />
      ) : (
        <StudentForm key={student.id} student={student} onSubmit={submit} onCancel={() => navigate(`/students/${id}`)} />
      )}
    </div>
  );
}
