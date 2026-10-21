import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import {
  Users, Calendar, ClipboardList, Search, ArrowRight, ShieldCheck,
  FileText, MessageSquare, CheckCircle, Bell
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface DashboardStats {
  activeDoctors: number;
  pendingRequests: number;
  upcomingAppointments: number;
  pendingQuestionnaires: number;
  totalRecords: number;
}

export const PatientDashboard: React.FC = () => {
  const { profile } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    activeDoctors: 0, pendingRequests: 0, upcomingAppointments: 0,
    pendingQuestionnaires: 0, totalRecords: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    loadDashboard();
  }, [profile]);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const [
        { count: docCount },
        { count: reqCount },
        { count: apptCount },
        { count: qCount },
        { count: recCount },
      ] = await Promise.all([
        supabase.from('doctor_patient_relationships').select('*', { count: 'exact', head: true }).eq('patient_id', profile!.id).eq('status', 'ACTIVE'),
        supabase.from('connection_requests').select('*', { count: 'exact', head: true }).eq('patient_id', profile!.id).eq('status', 'PENDING'),
        supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('patient_id', profile!.id).in('status', ['PENDING', 'APPROVED']),
        supabase.from('questionnaire_assignments').select('*', { count: 'exact', head: true }).eq('patient_id', profile!.id).eq('status', 'PENDING'),
        supabase.from('medical_records').select('*', { count: 'exact', head: true }).eq('patient_id', profile!.id),
      ]);

      setStats({
        activeDoctors: docCount || 0,
        pendingRequests: reqCount || 0,
        upcomingAppointments: apptCount || 0,
        pendingQuestionnaires: qCount || 0,
        totalRecords: recCount || 0,
      });
    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const metricCards = [
    { label: 'My Doctors', value: stats.activeDoctors, icon: <Users size={22} />, color: 'var(--primary-600)', bg: 'var(--primary-50)', link: '/patient/connections' },
    { label: 'Pending Requests', value: stats.pendingRequests, icon: <Bell size={22} />, color: 'var(--warning-text)', bg: 'var(--warning-bg)', link: '/patient/connections' },
    { label: 'Appointments', value: stats.upcomingAppointments, icon: <Calendar size={22} />, color: 'var(--success-text)', bg: 'var(--success-bg)', link: '/patient/appointments' },
    { label: 'Questionnaires', value: stats.pendingQuestionnaires, icon: <ClipboardList size={22} />, color: '#7c3aed', bg: '#f5f3ff', link: '/patient/questionnaires' },
    { label: 'My Records', value: stats.totalRecords, icon: <FileText size={22} />, color: '#0d9488', bg: '#f0fdfa', link: '/patient/records' },
  ];

  const quickActions = [
    { path: '/patient/find-doctors', icon: <Search size={22} />, label: 'Find a Doctor', desc: 'Search specialists and send connection requests', color: 'var(--primary-100)', iconColor: 'var(--primary-700)', highlight: stats.activeDoctors === 0 },
    { path: '/patient/connections', icon: <Users size={22} />, label: 'My Connections', desc: 'View active doctors, pending requests, and offboarding status', color: '#e0f2fe', iconColor: '#0369a1', highlight: false },
    { path: '/patient/appointments', icon: <Calendar size={22} />, label: 'Appointments', desc: 'Schedule and manage consultations with your doctors', color: '#f0fdf4', iconColor: '#16a34a', highlight: false },
    { path: '/patient/questionnaires', icon: <ClipboardList size={22} />, label: 'Health Assessments', desc: 'Complete assigned questionnaires and view your scores', color: '#f3e8ff', iconColor: '#7c3aed', highlight: stats.pendingQuestionnaires > 0 },
    { path: '/patient/records', icon: <FileText size={22} />, label: 'Medical Records', desc: 'View clinical documents uploaded by your doctors', color: '#f0fdfa', iconColor: '#0d9488', highlight: false },
    { path: '/patient/messages', icon: <MessageSquare size={22} />, label: 'Secure Messages', desc: 'Real-time encrypted messaging with your doctors', color: '#fdf2f8', iconColor: '#db2777', highlight: false },
  ];

  return (
    <div style={{ animation: 'slideInUp 200ms ease-out' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--slate-900)', letterSpacing: '-0.03em' }}>
              Health Portal
            </h1>
            <p style={{ fontSize: '0.875rem', color: 'var(--slate-500)', marginTop: '0.25rem' }}>
              Welcome back, {profile?.full_name || profile?.username}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-surface, #ffffff)', padding: '0.5rem 0.875rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--slate-200)', boxShadow: 'var(--shadow-sm)' }}>
            <ShieldCheck size={16} color="var(--primary-600)" />
            <span style={{ fontSize: '0.75rem', color: 'var(--slate-500)', fontWeight: 600 }}>Patient ID:</span>
            <span style={{ fontSize: '0.8rem', fontWeight: 800, fontFamily: 'monospace', color: 'var(--primary-700)' }}>{profile?.public_id}</span>
          </div>
        </div>
      </div>

      {/* Pending questionnaire alert */}
      {!loading && stats.pendingQuestionnaires > 0 && (
        <Link to="/patient/questionnaires" style={{ textDecoration: 'none', display: 'block', marginBottom: '1.5rem' }}>
          <div style={{
            background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 'var(--radius-lg)',
            padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.875rem',
            transition: 'all var(--transition-fast)',
          }}>
            <ClipboardList size={20} color="#92400e" />
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 700, fontSize: '0.875rem', color: '#92400e' }}>
                You have {stats.pendingQuestionnaires} pending questionnaire{stats.pendingQuestionnaires > 1 ? 's' : ''}
              </p>
              <p style={{ fontSize: '0.8rem', color: '#a16207', marginTop: '0.15rem' }}>
                Your doctor is waiting for your response. Tap to complete.
              </p>
            </div>
            <ArrowRight size={18} color="#92400e" />
          </div>
        </Link>
      )}

      {/* Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(165px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        {metricCards.map(m => (
          <Link key={m.link + m.label} to={m.link} style={{ textDecoration: 'none' }}>
            <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem', cursor: 'pointer', transition: 'all var(--transition-normal)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-md)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = ''; }}
            >
              <div style={{ width: '2.75rem', height: '2.75rem', borderRadius: 'var(--radius-md)', background: m.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: m.color, flexShrink: 0 }}>
                {m.icon}
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--slate-500)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{m.label}</div>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--slate-900)', lineHeight: 1.2 }}>
                  {loading ? <span style={{ fontSize: '1rem', color: 'var(--slate-300)' }}>···</span> : m.value}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Quick Actions */}
      <h2 style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--slate-700)', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Quick Navigation
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.875rem' }}>
        {quickActions.map(action => (
          <Link key={action.path} to={action.path} style={{ textDecoration: 'none' }}>
            <div className="card" style={{
              display: 'flex', alignItems: 'center', gap: '1rem',
              padding: '1.25rem', cursor: 'pointer',
              transition: 'all var(--transition-normal)',
              border: action.highlight ? '2px solid var(--warning-border)' : undefined,
              background: action.highlight ? 'var(--warning-bg)' : undefined,
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-md)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = ''; }}
            >
              <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: 'var(--radius-md)', background: action.color, color: action.iconColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {action.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--slate-900)' }}>{action.label}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--slate-500)', marginTop: '0.15rem' }}>{action.desc}</div>
              </div>
              <ArrowRight size={16} color="var(--slate-400)" />
            </div>
          </Link>
        ))}
      </div>

      {/* Empty state for new users */}
      {!loading && stats.activeDoctors === 0 && (
        <div style={{ marginTop: '2rem' }}>
          <div className="card" style={{ background: 'linear-gradient(135deg, var(--primary-50), #f0fdfa)', border: '1px solid var(--primary-200)', textAlign: 'center', padding: '2.5rem' }}>
            <CheckCircle size={40} style={{ margin: '0 auto 1rem', color: 'var(--primary-500)' }} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--slate-800)', marginBottom: '0.5rem' }}>
              Get Started
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--slate-600)', marginBottom: '1.25rem', maxWidth: '400px', margin: '0 auto 1.25rem' }}>
              You're all set up! Start by finding a doctor and sending a connection request.
            </p>
            <Link to="/patient/find-doctors" className="btn btn-primary">
              <Search size={16} /> Find a Doctor
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};
