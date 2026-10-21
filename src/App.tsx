import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SidebarLayout } from './components/layout/SidebarLayout';
import { Navbar } from './components/layout/Navbar';
import { ProtectedRoute } from './components/common/ProtectedRoute';

// Auth Pages
import { Login } from './pages/auth/Login';
import { Register } from './pages/auth/Register';
import { Profile } from './pages/profile/Profile';

// Doctor Pages
import { DoctorDashboard } from './pages/doctor/DoctorDashboard';
import { DoctorPatients } from './pages/doctor/DoctorPatients';
import { DoctorAppointments } from './pages/doctor/DoctorAppointments';
import { DoctorQuestionnaires } from './pages/doctor/DoctorQuestionnaires';
import { DoctorMedicalRecords } from './pages/doctor/DoctorMedicalRecords';
import { DoctorMessages } from './pages/doctor/DoctorMessages';

// Patient Pages
import { PatientDashboard } from './pages/patient/PatientDashboard';
import { FindDoctors } from './pages/patient/FindDoctors';
import { PatientConnections } from './pages/patient/PatientConnections';
import { PatientAppointments } from './pages/patient/PatientAppointments';
import { PatientQuestionnaires } from './pages/patient/PatientQuestionnaires';
import { TakeQuestionnaire } from './pages/patient/TakeQuestionnaire';
import { PatientMedicalRecords } from './pages/patient/PatientMedicalRecords';
import { PatientMessages } from './pages/patient/PatientMessages';

// Shared
import { QuestionnaireResults } from './pages/questionnaires/QuestionnaireResults';

const RootRedirect: React.FC = () => {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-body, #f1f5f9)' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="loading-spinner" style={{ width: '2.5rem', height: '2.5rem', margin: '0 auto 1rem' }} />
          <p style={{ color: 'var(--slate-500)', fontSize: '0.875rem' }}>Loading BlueMind Cares...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (profile?.role === 'doctor') return <Navigate to="/doctor/dashboard" replace />;
  return <Navigate to="/patient/dashboard" replace />;
};

// Wraps authenticated pages with sidebar layout
const AuthenticatedLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <SidebarLayout>{children}</SidebarLayout>;
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Root redirect */}
          <Route path="/" element={<RootRedirect />} />

          {/* Public Auth Routes — use Navbar, not Sidebar */}
          <Route
            path="/login"
            element={
              <>
                <Navbar />
                <Login />
              </>
            }
          />
          <Route
            path="/register"
            element={
              <>
                <Navbar />
                <Register />
              </>
            }
          />

          {/* Profile (Shared, with Sidebar) */}
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <AuthenticatedLayout>
                  <Profile />
                </AuthenticatedLayout>
              </ProtectedRoute>
            }
          />

          {/* ===== PATIENT ROUTES ===== */}
          <Route
            path="/patient/dashboard"
            element={
              <ProtectedRoute allowedRoles={['patient']}>
                <AuthenticatedLayout>
                  <PatientDashboard />
                </AuthenticatedLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/patient/find-doctors"
            element={
              <ProtectedRoute allowedRoles={['patient']}>
                <AuthenticatedLayout>
                  <FindDoctors />
                </AuthenticatedLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/patient/connections"
            element={
              <ProtectedRoute allowedRoles={['patient']}>
                <AuthenticatedLayout>
                  <PatientConnections />
                </AuthenticatedLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/patient/appointments"
            element={
              <ProtectedRoute allowedRoles={['patient']}>
                <AuthenticatedLayout>
                  <PatientAppointments />
                </AuthenticatedLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/patient/questionnaires"
            element={
              <ProtectedRoute allowedRoles={['patient']}>
                <AuthenticatedLayout>
                  <PatientQuestionnaires />
                </AuthenticatedLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/patient/questionnaires/take/:assignmentId"
            element={
              <ProtectedRoute allowedRoles={['patient']}>
                <AuthenticatedLayout>
                  <TakeQuestionnaire />
                </AuthenticatedLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/patient/records"
            element={
              <ProtectedRoute allowedRoles={['patient']}>
                <AuthenticatedLayout>
                  <PatientMedicalRecords />
                </AuthenticatedLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/patient/messages"
            element={
              <ProtectedRoute allowedRoles={['patient']}>
                <AuthenticatedLayout>
                  <PatientMessages />
                </AuthenticatedLayout>
              </ProtectedRoute>
            }
          />

          {/* ===== DOCTOR ROUTES ===== */}
          <Route
            path="/doctor/dashboard"
            element={
              <ProtectedRoute allowedRoles={['doctor']}>
                <AuthenticatedLayout>
                  <DoctorDashboard />
                </AuthenticatedLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/doctor/patients"
            element={
              <ProtectedRoute allowedRoles={['doctor']}>
                <AuthenticatedLayout>
                  <DoctorPatients />
                </AuthenticatedLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/doctor/appointments"
            element={
              <ProtectedRoute allowedRoles={['doctor']}>
                <AuthenticatedLayout>
                  <DoctorAppointments />
                </AuthenticatedLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/doctor/questionnaires"
            element={
              <ProtectedRoute allowedRoles={['doctor']}>
                <AuthenticatedLayout>
                  <DoctorQuestionnaires />
                </AuthenticatedLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/doctor/records"
            element={
              <ProtectedRoute allowedRoles={['doctor']}>
                <AuthenticatedLayout>
                  <DoctorMedicalRecords />
                </AuthenticatedLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/doctor/messages"
            element={
              <ProtectedRoute allowedRoles={['doctor']}>
                <AuthenticatedLayout>
                  <DoctorMessages />
                </AuthenticatedLayout>
              </ProtectedRoute>
            }
          />

          {/* Shared Questionnaire Results */}
          <Route
            path="/questionnaires/results/:assignmentId"
            element={
              <ProtectedRoute allowedRoles={['doctor', 'patient']}>
                <AuthenticatedLayout>
                  <QuestionnaireResults />
                </AuthenticatedLayout>
              </ProtectedRoute>
            }
          />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
};
