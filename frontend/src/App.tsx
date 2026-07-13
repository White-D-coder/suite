import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Layout
import SidebarLayout from './components/SidebarLayout';

// Public Screen
import Login from './pages/Login';

// Private Screens
import DashboardOverview from './pages/DashboardOverview';
import Clients from './pages/Clients';
import ClientDetails from './pages/ClientDetails';
import Projects from './pages/Projects';
import ProjectDetails from './pages/ProjectDetails';
import Vault from './pages/Vault';
import Invoices from './pages/Invoices';
import Finance from './pages/Finance';
import AuditLogs from './pages/AuditLogs';

// Initialize TanStack React Query Client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Guard component to block unauthorized navigation locally before server check
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const token = localStorage.getItem('agency_jwt_token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />

          {/* Protected Dashboard Routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <SidebarLayout />
              </ProtectedRoute>
            }
          >
            <Route path="overview" element={<DashboardOverview />} />
            <Route path="clients" element={<Clients />} />
            <Route path="clients/:id" element={<ClientDetails />} />
            <Route path="projects" element={<Projects />} />
            <Route path="projects/:id" element={<ProjectDetails />} />
            <Route path="vault" element={<Vault />} />
            <Route path="invoices" element={<Invoices />} />
            <Route path="finance" element={<Finance />} />
            <Route path="audit-logs" element={<AuditLogs />} />
            {/* Catch-all redirect inside dashboard */}
            <Route path="*" element={<Navigate to="overview" replace />} />
          </Route>

          {/* Catch-all root redirects */}
          <Route path="/" element={<Navigate to="/dashboard/overview" replace />} />
          <Route path="*" element={<Navigate to="/dashboard/overview" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
