import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard, Users, Calendar, ClipboardList,
  FileText, MessageSquare, User, LogOut, Search,
  Menu, X, ChevronRight
} from 'lucide-react';
import { BrainLogo } from '../common/BrainLogo';
import { ThemeToggle } from '../common/ThemeToggle';

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
}

const doctorNav: NavItem[] = [
  { path: '/doctor/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
  { path: '/doctor/patients', label: 'Patients', icon: <Users size={18} /> },
  { path: '/doctor/appointments', label: 'Appointments', icon: <Calendar size={18} /> },
  { path: '/doctor/questionnaires', label: 'Questionnaires', icon: <ClipboardList size={18} /> },
  { path: '/doctor/records', label: 'Medical Records', icon: <FileText size={18} /> },
  { path: '/doctor/messages', label: 'Messages', icon: <MessageSquare size={18} /> },
];

const patientNav: NavItem[] = [
  { path: '/patient/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
  { path: '/patient/find-doctors', label: 'Find Doctors', icon: <Search size={18} /> },
  { path: '/patient/connections', label: 'My Connections', icon: <Users size={18} /> },
  { path: '/patient/appointments', label: 'Appointments', icon: <Calendar size={18} /> },
  { path: '/patient/questionnaires', label: 'Questionnaires', icon: <ClipboardList size={18} /> },
  { path: '/patient/records', label: 'Medical Records', icon: <FileText size={18} /> },
  { path: '/patient/messages', label: 'Messages', icon: <MessageSquare size={18} /> },
];

const bottomNav: NavItem[] = [
  { path: '/profile', label: 'Profile', icon: <User size={18} /> },
];

interface SidebarLayoutProps {
  children: React.ReactNode;
}

export const SidebarLayout: React.FC<SidebarLayoutProps> = ({ children }) => {
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = profile?.role === 'doctor' ? doctorNav : patientNav;
  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const SidebarContent = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Brand */}
      <div style={{ padding: '1.5rem 1.25rem', borderBottom: '1px solid var(--slate-100)' }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <div style={{
            width: '2rem', height: '2rem', borderRadius: 'var(--radius-md)',
            background: 'linear-gradient(135deg, var(--primary-600), var(--primary-800))',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
            flexShrink: 0,
          }}>
            <BrainLogo size={18} color="#ffffff" />
          </div>
          <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--slate-900)', letterSpacing: '-0.02em' }}>
            Blue<span style={{ color: 'var(--primary-600)' }}>Mind</span>
          </span>
        </Link>
      </div>

      {/* User info */}
      <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--slate-100)' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          padding: '0.625rem 0.75rem', borderRadius: 'var(--radius-md)',
          background: 'var(--slate-50)',
        }}>
          <div style={{
            width: '2.25rem', height: '2.25rem', borderRadius: 'var(--radius-full)',
            background: 'linear-gradient(135deg, var(--primary-500), var(--primary-700))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 800, fontSize: '0.875rem', flexShrink: 0,
          }}>
            {(profile?.full_name || profile?.username || 'U').charAt(0).toUpperCase()}
          </div>
          <div style={{ overflow: 'hidden', flex: 1 }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--slate-800)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {profile?.full_name || profile?.username}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginTop: '0.125rem' }}>
              <span className={`badge ${profile?.role === 'doctor' ? 'badge-approved' : 'badge-pending'}`}
                style={{ fontSize: '0.6rem', padding: '0.1rem 0.375rem' }}>
                {profile?.role}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Nav */}
      <nav style={{ flex: 1, padding: '0.75rem 0.75rem', overflowY: 'auto' }}>
        <div style={{ marginBottom: '0.5rem' }}>
          {navItems.map(item => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setMobileOpen(false)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.625rem',
                padding: '0.625rem 0.75rem',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.875rem', fontWeight: 600,
                textDecoration: 'none',
                transition: 'all var(--transition-fast)',
                marginBottom: '0.125rem',
                color: isActive(item.path) ? 'var(--primary-700)' : 'var(--slate-600)',
                background: isActive(item.path) ? 'var(--primary-50)' : 'transparent',
                borderLeft: isActive(item.path) ? '3px solid var(--primary-600)' : '3px solid transparent',
              }}
            >
              <span style={{ color: isActive(item.path) ? 'var(--primary-600)' : 'var(--slate-400)' }}>
                {item.icon}
              </span>
              {item.label}
              {isActive(item.path) && (
                <ChevronRight size={14} style={{ marginLeft: 'auto', color: 'var(--primary-400)' }} />
              )}
            </Link>
          ))}
        </div>
      </nav>

      {/* Bottom nav */}
      <div style={{ padding: '0.75rem 0.75rem', borderTop: '1px solid var(--slate-100)' }}>
        {bottomNav.map(item => (
          <Link
            key={item.path}
            to={item.path}
            onClick={() => setMobileOpen(false)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.625rem',
              padding: '0.625rem 0.75rem',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.875rem', fontWeight: 600,
              textDecoration: 'none',
              color: isActive(item.path) ? 'var(--primary-700)' : 'var(--slate-600)',
              background: isActive(item.path) ? 'var(--primary-50)' : 'transparent',
              marginBottom: '0.125rem',
              transition: 'all var(--transition-fast)',
            }}
          >
            <span style={{ color: 'var(--slate-400)' }}>{item.icon}</span>
            {item.label}
          </Link>
        ))}
        {/* Theme Toggle */}
        <div style={{ marginBottom: '0.25rem' }}>
          <ThemeToggle showLabel style={{ width: '100%', justifyContent: 'flex-start', padding: '0.625rem 0.75rem', border: 'none', background: 'transparent', color: 'var(--slate-600)' }} />
        </div>

        <button
          onClick={handleLogout}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.625rem',
            padding: '0.625rem 0.75rem', width: '100%',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.875rem', fontWeight: 600,
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--danger-text)',
            transition: 'all var(--transition-fast)',
          }}
        >
          <LogOut size={18} style={{ color: 'var(--danger-text)' }} />
          Sign Out
        </button>
        <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', fontSize: '0.7rem', color: 'var(--slate-400)', fontFamily: 'monospace' }}>
          ID: {profile?.public_id}
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-body, #f1f5f9)' }}>
      {/* Desktop Sidebar */}
      <aside style={{
        width: '240px', flexShrink: 0,
        background: 'var(--bg-sidebar, #ffffff)',
        borderRight: '1px solid var(--slate-200)',
        position: 'fixed', top: 0, left: 0, bottom: 0,
        zIndex: 100, overflowY: 'auto',
        display: 'none',
        transition: 'background-color var(--transition-normal), border-color var(--transition-normal)'
      }} className="sidebar-desktop">
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(15, 23, 42, 0.5)',
            backdropFilter: 'blur(2px)',
          }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside style={{
        width: '240px', flexShrink: 0,
        background: 'var(--bg-sidebar, #ffffff)',
        borderRight: '1px solid var(--slate-200)',
        position: 'fixed', top: 0, left: 0, bottom: 0,
        zIndex: 300,
        transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform var(--transition-normal), background-color var(--transition-normal)',
      }} className="sidebar-mobile">
        <SidebarContent />
      </aside>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }} className="sidebar-main">
        {/* Mobile top bar */}
        <div className="mobile-topbar" style={{
          display: 'none',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.75rem 1rem',
          background: 'var(--bg-surface, #ffffff)',
          borderBottom: '1px solid var(--slate-200)',
          position: 'sticky', top: 0, zIndex: 50,
          boxShadow: 'var(--shadow-sm)',
          transition: 'background-color var(--transition-normal), border-color var(--transition-normal)'
        }}>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--slate-700)' }}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <BrainLogo size={20} color="var(--primary-600)" />
            <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--slate-900)' }}>BlueMind</span>
          </div>
          <ThemeToggle />
        </div>

        <main style={{ flex: 1, minWidth: 0 }}>
          {children}
        </main>
      </div>
    </div>
  );
};
