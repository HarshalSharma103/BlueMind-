import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import type { AppRole } from '../../types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: AppRole[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="loading-spinner" style={{ width: '2.5rem', height: '2.5rem', borderWidth: '3px' }} />
          <p style={{ marginTop: '1rem', color: 'var(--slate-500)', fontWeight: 500 }}>Authenticating session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
    // Redirect user to their own role dashboard if they try to access the other role's pages
    if (profile.role === 'doctor') {
      return <Navigate to="/doctor/dashboard" replace />;
    } else {
      return <Navigate to="/patient/dashboard" replace />;
    }
  }

  return <>{children}</>;
};
