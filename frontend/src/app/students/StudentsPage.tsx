import { Download, Eye, MoreVertical, Pencil, Plus, Power, Trash2, UserCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { Avatar, ConfirmDialog, EmptyState, ErrorState, LoadingState, PageHeader, Pagination, SearchInput } from '@/components/common';
import { FeeStatusBadge, StudentStatusBadge } from '@/components/fees/StatusBadges';
import { Button, buttonClass } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/form-controls';
import { Table, Td, Th, Tr } from '@/components/ui/table';
import { api, errorMessage } from '@/lib/api';
import { useIsAdmin } from '@/lib/auth/AuthContext';
import { useApi, useDebounced } from '@/lib/hooks';
import { buildQuery, FEE_STATUS_LABELS } from '@/lib/utils';
import type { Paginated, Student, Timing } from '@/types';

type PendingAction = { kind: 'deactivate' | 'activate' | 'delete'; student: Student } | null;

export default function StudentsPage() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get('search') ?? '');
  const status = params.get('status') ?? 'active';
  const timing = params.get('timing') ?? '';
  const feeStatus = params.get('feeStatus') ?? '';
  const page = Number(params.get('page') ?? 1);
  const q = useDebounced(search);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };
  // Keep the (debounced) search in the URL so Back returns to the same list.
  const urlSearch = params.get('search') ?? '';
  useEffect(() => {
    if (q !== urlSearch) setParam('search', q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const timings = useApi<Timing[]>('/timings');
  const { data, error, loading, reload } = useApi<Paginated<Student>>(
    `/students${buildQuery({ search: q, status, timing, feeStatus, page, limit: 20 })}`,
  );

  const [pending, setPending] = useState<PendingAction>(null);
  const [busy, setBusy] = useState(false);

  const runAction = async () => {
    if (!pending) return;
    const { kind, student } = pending;
    setBusy(true);
    try {
      if (kind === 'delete') await api.delete(`/students/${student.id}`);
      else await api.patch(`/students/${student.id}/${kind}`);
      toast.success(
        kind === 'delete' ? `${student.name} deleted` : kind === 'activate' ? `${student.name} is active again` : `${student.name} deactivated`,
      );
      setPending(null);
      reload();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Students"
        description="All library members, their seats and fee status."
        actions={
          <>
            <a href={`/api/reports/students.csv${buildQuery({ status })}`} className={buttonClass('outline')}>
              <Download /> Export
            </a>
            <Link to="/students/new" className={buttonClass()}>
              <Plus /> Add student
            </Link>
          </>
        }
      />

      <Card>
        <div className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <SearchInput value={search} onChange={setSearch} placeholder="Name, seat, mobile or email" className="sm:col-span-2 lg:col-span-1" />
          <Select value={status} onChange={(e) => setParam('status', e.target.value)} aria-label="Student status">
            <option value="active">Active students</option>
            <option value="inactive">Inactive students</option>
            <option value="all">All students</option>
          </Select>
          <Select value={timing} onChange={(e) => setParam('timing', e.target.value)} aria-label="Timing">
            <option value="">All timings</option>
            {timings.data?.map((t) => (
              <option key={t._id} value={t.name}>{t.name}</option>
            ))}
          </Select>
          <Select value={feeStatus} onChange={(e) => setParam('feeStatus', e.target.value)} aria-label="Fee status">
            <option value="">All fee statuses</option>
            {Object.entries(FEE_STATUS_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </Select>
        </div>

        {error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : loading && !data ? (
          <LoadingState />
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            title={q || timing || feeStatus ? 'No students match your search' : 'No students yet'}
            description={q || timing || feeStatus ? 'Try a different name or clear the filters.' : 'Add your first student to get started.'}
            action={
              !q && !timing && !feeStatus && status === 'active' ? (
                <Link to="/students/new" className={buttonClass()}>
                  <Plus /> Add student
                </Link>
              ) : undefined
            }
          />
        ) : (
          <>
            <StudentCards students={data.items} onAction={setPending} />
            <div className="hidden md:block">
              <Table>
                <thead>
                  <tr>
                    <Th>Photo</Th>
                    <Th>Student Name</Th>
                    <Th>Seat</Th>
                    <Th>Timing</Th>
                    <Th>Mobile</Th>
                    <Th>Guardian</Th>
                    <Th>Fee Status</Th>
                    <Th>Status</Th>
                    <Th className="text-right">Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((s) => (
                    <Tr key={s.id}>
                      <Td>
                        <Avatar name={s.name} src={s.photoUrl} size="sm" />
                      </Td>
                      <Td>
                        <Link to={`/students/${s.id}`} className="font-medium text-slate-900 hover:text-primary hover:underline">
                          {s.name}
                        </Link>
                      </Td>
                      <Td className="font-mono text-xs font-semibold">{s.seatNumber}</Td>
                      <Td>{s.timing}</Td>
                      <Td className="whitespace-nowrap">{s.mobile}</Td>
                      <Td className="whitespace-nowrap">{s.guardianMobile || '—'}</Td>
                      <Td>
                        <FeeStatusBadge status={s.feeStatus} />
                      </Td>
                      <Td>
                        <StudentStatusBadge status={s.status} />
                      </Td>
                      <Td>
                        <RowActions student={s} onAction={setPending} />
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </div>
            <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onChange={(p) => setParam('page', String(p))} />
          </>
        )}
      </Card>

      <ConfirmDialog
        open={pending !== null}
        onClose={() => setPending(null)}
        onConfirm={runAction}
        loading={busy}
        destructive={pending?.kind !== 'activate'}
        title={
          pending?.kind === 'delete' ? 'Delete student permanently?' : pending?.kind === 'activate' ? 'Reactivate student?' : 'Deactivate student?'
        }
        confirmLabel={pending?.kind === 'delete' ? 'Delete' : pending?.kind === 'activate' ? 'Reactivate' : 'Deactivate'}
        message={
          pending?.kind === 'delete' ? (
            <p>
              <strong>{pending.student.name}</strong> will be removed completely. Students who have made payments can&apos;t be deleted — deactivate
              them instead to keep their payment history.
            </p>
          ) : pending?.kind === 'activate' ? (
            <p>
              <strong>{pending.student.name}</strong> will get seat <strong>{pending.student.seatNumber}</strong> back, if it is still free.
            </p>
          ) : (
            <p>
              <strong>{pending?.student.name}</strong> will be marked inactive and seat <strong>{pending?.student.seatNumber}</strong> becomes free.
              Their details and payment history are kept, and you can reactivate them later.
            </p>
          )
        }
      />
    </>
  );
}

function RowActions({ student, onAction }: { student: Student; onAction: (a: PendingAction) => void }) {
  const navigate = useNavigate();
  return (
    <div className="flex justify-end gap-1">
      <Button variant="ghost" size="icon" onClick={() => navigate(`/students/${student.id}`)} aria-label={`View ${student.name}`} title="View">
        <Eye />
      </Button>
      <Button variant="ghost" size="icon" onClick={() => navigate(`/students/${student.id}/edit`)} aria-label={`Edit ${student.name}`} title="Edit">
        <Pencil />
      </Button>
      <OverflowMenu student={student} onAction={onAction} />
    </div>
  );
}

function OverflowMenu({ student, onAction }: { student: Student; onAction: (a: PendingAction) => void }) {
  const isAdmin = useIsAdmin();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const item = 'flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 [&_svg]:size-4';
  return (
    <div className="relative" ref={ref}>
      <Button variant="ghost" size="icon" onClick={() => setOpen((v) => !v)} aria-label="More actions" aria-expanded={open} title="More">
        <MoreVertical />
      </Button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-48 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg" role="menu">
          {student.status === 'active' ? (
            <button role="menuitem" className={item} onClick={() => { setOpen(false); onAction({ kind: 'deactivate', student }); }}>
              <Power /> Deactivate
            </button>
          ) : (
            <button role="menuitem" className={item} onClick={() => { setOpen(false); onAction({ kind: 'activate', student }); }}>
              <UserCheck /> Reactivate
            </button>
          )}
          {isAdmin && (
            <button role="menuitem" className={`${item} text-red-600`} onClick={() => { setOpen(false); onAction({ kind: 'delete', student }); }}>
              <Trash2 /> Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Phone layout: one card per student. */
function StudentCards({ students, onAction }: { students: Student[]; onAction: (a: PendingAction) => void }) {
  return (
    <ul className="divide-y divide-slate-100 md:hidden">
      {students.map((s) => (
        <li key={s.id} className="flex items-start gap-3 p-4">
          <Link to={`/students/${s.id}`} className="shrink-0">
            <Avatar name={s.name} src={s.photoUrl} />
          </Link>
          <div className="min-w-0 flex-1">
            <Link to={`/students/${s.id}`} className="block truncate font-medium text-slate-900">
              {s.name}
            </Link>
            <p className="text-sm text-slate-600">
              Seat <span className="font-semibold">{s.seatNumber}</span> · {s.timing}
            </p>
            <a href={`tel:${s.mobile}`} className="text-sm text-primary">
              {s.mobile}
            </a>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <FeeStatusBadge status={s.feeStatus} />
              {s.status === 'inactive' && <StudentStatusBadge status={s.status} />}
            </div>
          </div>
          <RowActions student={s} onAction={onAction} />
        </li>
      ))}
    </ul>
  );
}
