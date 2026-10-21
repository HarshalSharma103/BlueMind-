import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LogOut, User, Calendar, ClipboardList, Users, Search, FileText, MessageSquare } from 'lucide-react';
import { BrainLogo } from '../common/BrainLogo';
import { ThemeToggle } from '../common/ThemeToggle';

export const Navbar: React.FC = () => {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <nav style={{
      backgroundColor: 'var(--bg-surface, #ffffff)',
      borderBottom: '1px solid var(--slate-200)',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      boxShadow: 'var(--shadow-sm)',
      transition: 'background-color var(--transition-normal), border-color var(--transition-normal)'
    }}>
      <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1.5rem' }}>
        {/* Brand */}
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <div style={{
            width: '2.25rem',
            height: '2.25rem',
            borderRadius: 'var(--radius-md)',
            background: 'linear-gradient(135deg, var(--primary-600), var(--primary-800))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff'
          }}>
            <BrainLogo size={22} color="#ffffff" />
          </div>
          <div>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--slate-900)', letterSpacing: '-0.02em' }}>
              BlueMind <span style={{ color: 'var(--primary-600)' }}>Cares</span>
            </span>
          </div>
        </Link>

        {/* Links */}
        {user && profile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            {profile.role === 'patient' ? (
              <>
                <Link to="/patient/dashboard" className="btn btn-secondary" style={{ padding: '0.5rem 0.75rem' }}>
                  Dashboard
                </Link>
                <Link to="/patient/find-doctors" className="btn btn-secondary" style={{ padding: '0.5rem 0.75rem' }}>
                  <Search size={16} /> Find Doctors
                </Link>
                <Link to="/patient/connections" className="btn btn-secondary" style={{ padding: '0.5rem 0.75rem' }}>
                  <Users size={16} /> Doctors
                </Link>
                <Link to="/patient/appointments" className="btn btn-secondary" style={{ padding: '0.5rem 0.75rem' }}>
                  <Calendar size={16} /> Appointments
                </Link>
                <Link to="/patient/questionnaires" className="btn btn-secondary" style={{ padding: '0.5rem 0.75rem' }}>
                  <ClipboardList size={16} /> Questionnaires
                </Link>
                <Link to="/patient/records" className="btn btn-secondary" style={{ padding: '0.5rem 0.75rem' }}>
                  <FileText size={16} /> Records
                </Link>
                <Link to="/patient/messages" className="btn btn-secondary" style={{ padding: '0.5rem 0.75rem' }}>
                  <MessageSquare size={16} /> Messages
                </Link>
              </>
            ) : (
              <>
                <Link to="/doctor/dashboard" className="btn btn-secondary" style={{ padding: '0.5rem 0.75rem' }}>
                  Dashboard
                </Link>
                <Link to="/doctor/patients" className="btn btn-secondary" style={{ padding: '0.5rem 0.75rem' }}>
                  <Users size={16} /> Patients
                </Link>
                <Link to="/doctor/appointments" className="btn btn-secondary" style={{ padding: '0.5rem 0.75rem' }}>
                  <Calendar size={16} /> Appointments
                </Link>
                <Link to="/doctor/questionnaires" className="btn btn-secondary" style={{ padding: '0.5rem 0.75rem' }}>
                  <ClipboardList size={16} /> Questionnaires
                </Link>
                <Link to="/doctor/records" className="btn btn-secondary" style={{ padding: '0.5rem 0.75rem' }}>
                  <FileText size={16} /> Records
                </Link>
                <Link to="/doctor/messages" className="btn btn-secondary" style={{ padding: '0.5rem 0.75rem' }}>
                  <MessageSquare size={16} /> Messages
                </Link>
              </>
            )}

            {/* Profile & Role Badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginLeft: '0.5rem', paddingLeft: '0.75rem', borderLeft: '1px solid var(--slate-200)' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--slate-800)' }}>
                  {profile.full_name || profile.username}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', justifyContent: 'flex-end', marginTop: '0.125rem' }}>
                  <span className={`badge ${profile.role === 'doctor' ? 'badge-approved' : 'badge-pending'}`} style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem' }}>
                    {profile.role}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--slate-500)', fontFamily: 'monospace', fontWeight: 600 }}>
                    {profile.public_id}
                  </span>
                </div>
              </div>

              <ThemeToggle />

              <Link to="/profile" title="My Profile" className="btn btn-secondary" style={{ padding: '0.5rem' }}>
                <User size={18} />
              </Link>

              <button onClick={handleLogout} title="Log Out" className="btn btn-secondary" style={{ padding: '0.5rem' }}>
                <LogOut size={18} />
              </button>
            </div>
          </div>
        )}

        {!user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <ThemeToggle />
            <Link to="/login" className="btn btn-secondary">
              Log In
            </Link>
            <Link to="/register" className="btn btn-primary">
              Register
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
};
