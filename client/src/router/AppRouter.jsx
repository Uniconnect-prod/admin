import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { LoginPage } from '../pages/auth/LoginPage';
import { DashboardPage } from '../pages/dashboard/DashboardPage';
import { SubscribersPage } from '../pages/subscribers/SubscribersPage';
import { ChurnPage } from '../pages/churn/ChurnPage';
import { ReportsHubPage } from '../pages/reports/ReportsHubPage';
import { RevenueReportPage } from '../pages/reports/RevenueReportPage';
import { GrowthReportPage } from '../pages/reports/GrowthReportPage';
import { PlatformPerformancePage } from '../pages/reports/PlatformPerformancePage';
import { QuizzesListPage } from '../pages/quizzes/QuizzesListPage';
import { QuizUploadPage } from '../pages/quizzes/QuizUploadPage';
import { UsersPage } from '../pages/users/UsersPage';
import { PlatformsPage } from '../pages/platforms/PlatformsPage';
import { ActivityLogsPage } from '../pages/activity/ActivityLogsPage';
import { SettingsPage } from '../pages/settings/SettingsPage';

// Protected Route Guard
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', color: '#64748b' }}>
        Authenticating enterprise session...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

// Role Guard for specific admin routes
const SuperAdminGuard = ({ children }) => {
  const { user } = useAuth();
  if (!user?.isSuperAdmin) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
};

export const AppRouter = () => {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<LoginPage />} />

      {/* Protected SaaS Layout Routes */}
      <Route
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/subscribers" element={<SubscribersPage />} />
        <Route path="/churn" element={<ChurnPage />} />

        {/* Reports */}
        <Route path="/reports" element={<ReportsHubPage />} />
        <Route path="/reports/revenue" element={<RevenueReportPage />} />
        <Route path="/reports/growth" element={<GrowthReportPage />} />
        <Route
          path="/reports/platform-comparison"
          element={
            <SuperAdminGuard>
              <PlatformPerformancePage />
            </SuperAdminGuard>
          }
        />

        {/* Content Management */}
        <Route path="/quizzes" element={<QuizzesListPage />} />
        <Route path="/quizzes/upload" element={<QuizUploadPage />} />

        {/* User Management */}
        <Route path="/users" element={<UsersPage />} />

        {/* Platform Management (Super Admin) */}
        <Route
          path="/platforms"
          element={
            <SuperAdminGuard>
              <PlatformsPage />
            </SuperAdminGuard>
          }
        />

        {/* System */}
        <Route path="/activity-logs" element={<ActivityLogsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

