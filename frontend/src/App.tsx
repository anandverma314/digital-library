import { lazy, Suspense } from 'react';
import { Navigate, Outlet, Route, Routes } from 'react-router';
import { EmptyState, LoadingState } from '@/components/common';
import { AppLayout, AuthLayout } from '@/components/layout/AppLayout';
import { useIsAdmin } from '@/lib/auth/AuthContext';

// Each page is loaded on demand, keeping the first download small on mobile data.
const LoginPage = lazy(() => import('@/app/login/LoginPage'));
const DashboardPage = lazy(() => import('@/app/dashboard/DashboardPage'));
const StudentsPage = lazy(() => import('@/app/students/StudentsPage'));
const StudentDetailsPage = lazy(() => import('@/app/students/StudentDetailsPage'));
const AddStudentPage = lazy(() => import('@/app/students/StudentFormPages').then((m) => ({ default: m.AddStudentPage })));
const EditStudentPage = lazy(() => import('@/app/students/StudentFormPages').then((m) => ({ default: m.EditStudentPage })));
const FeesPage = lazy(() => import('@/app/fees/FeesPage'));
const PaymentsPage = lazy(() => import('@/app/payments/PaymentsPage'));
const ReportsPage = lazy(() => import('@/app/reports/ReportsPage'));
const SettingsPage = lazy(() => import('@/app/settings/SettingsPage'));
const UsersPage = lazy(() => import('@/app/users/UsersPage'));

function Page() {
  return (
    <Suspense fallback={<LoadingState />}>
      <Outlet />
    </Suspense>
  );
}

/** Admin-only pages; the API enforces this too. */
function AdminOnly() {
  return useIsAdmin() ? <Outlet /> : <EmptyState title="Admins only" description="Ask an admin if you need access to this page." />;
}

export default function App() {
  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route element={<Page />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>
      </Route>
      <Route element={<AppLayout />}>
        <Route element={<Page />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/students" element={<StudentsPage />} />
          <Route path="/students/new" element={<AddStudentPage />} />
          <Route path="/students/:id" element={<StudentDetailsPage />} />
          <Route path="/students/:id/edit" element={<EditStudentPage />} />
          <Route path="/fees" element={<FeesPage />} />
          <Route path="/payments" element={<PaymentsPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route element={<AdminOnly />}>
            <Route path="/users" element={<UsersPage />} />
          </Route>
          <Route path="*" element={<EmptyState title="Page not found" description="The page you are looking for doesn't exist." />} />
        </Route>
      </Route>
    </Routes>
  );
}
