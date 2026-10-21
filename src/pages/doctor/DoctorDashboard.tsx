import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import {
  Users, Calendar, Clock, ArrowRight, ShieldCheck, ClipboardList,
  FileText, MessageSquare, CheckCircle, AlertCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface DashboardStats {
  activePatients: number;
  pendingRequests: number;
  upcomingAppointments: number;
  pendingQuestionnaires: number;
  totalRecords: number;
  unreadMessages: number;
}

interface RecentActivity {
  type: 'appointment' | 'request' | 'questionnaire';
  label: string;
  detail: string;
  time: string;
  status: string;
}

export const DoctorDashboard: React.FC = () => {
  const { profile } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    activePatients: 0, pendingRequests: 0, upcomingAppointments: 0,
    pendingQuestionnaires: 0, totalRecords: 0, unreadMessages: 0,
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    loadDashboard();
  }, [profile]);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const [
        { count: patCount },
        { count: reqCount },
        { count: apptCount },
        { count: qCount },
        { count: recCount },
        recentAppts,
        recentReqs,
      ] = await Promise.all([
        supabase.from('doctor_patient_relationships').select('*', { count: 'exact', head: true }).eq('doctor_id', profile!.id).eq('status', 'ACTIVE'),
        supabase.from('connection_requests').select('*', { count: 'exact', head: true }).eq('doctor_id', profile!.id).eq('status', 'PENDING'),
        supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('doctor_id', profile!.id).in('status', ['PENDING', 'APPROVED']),
        supabase.from('questionnaire_assignments').select('*', { count: 'exact', head: true }).eq('doctor_id', profile!.id).eq('status', 'PENDING'),
        supabase.from('medical_records').select('*', { count: 'exact', head: true }).eq('doctor_id', profile!.id),
        supabase.from('appointments').select('*, patient:profiles!appointments_patient_id_fkey(full_name, username)').eq('doctor_id', profile!.id).in('status', ['PENDING', 'APPROVED']).order('scheduled_start', { ascending: true }).limit(3),
        supabase.from('connection_requests').select('*, patient:profiles!connection_requests_patient_id_fkey(full_name, username)').eq('doctor_id', profile!.id).eq('status', 'PENDING').order('created_at', { ascending: false }).limit(3),
      ]);

      setStats({
        activePatients: patCount || 0,
        pendingRequests: reqCount || 0,
        upcomingAppointments: apptCount || 0,
        pendingQuestionnaires: qCount || 0,
        totalRecords: recCount || 0,
        unreadMessages: 0,
      });

      const activity: RecentActivity[] = [];
      (recentReqs.data || []).forEach((r: any) => {
        activity.push({
          type: 'request',
          label: `Connection from ${r.patient?.full_name || r.patient?.username}`,
          detail: 'Patient sent a connection request',
          time: r.created_at,
          status: 'PENDING',
        });
      });
      (recentAppts.data || []).forEach((a: any) => {
        activity.push({
          type: 'appointment',
          label: `Appointment with ${a.patient?.full_name || a.patient?.username}`,
          detail: new Date(a.scheduled_start).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
          time: a.created_at,
          status: a.status,
        });
      });
      activity.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
      setRecentActivity(activity.slice(0, 5));
    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const metricCards = [
    { label: 'Active Patients', value: stats.activePatients, icon: <Users size={22} />, color: 'var(--primary-600)', bg: 'var(--primary-50)', link: '/doctor/patients' },
    { label: 'Pending Requests', value: stats.pendingRequests, icon: <Clock size={22} />, color: 'var(--warning-text)', bg: 'var(--warning-bg)', link: '/doctor/patients' },
    { label: 'Upcoming Visits', value: stats.upcomingAppointments, icon: <Calendar size={22} />, color: 'var(--success-text)', bg: 'var(--success-bg)', link: '/doctor/appointments' },
    { label: 'Pending Assessments', value: stats.pendingQuestionnaires, icon: <ClipboardList size={22} />, color: '#7c3aed', bg: '#f5f3ff', link: '/doctor/questionnaires' },
    { label: 'Medical Records', value: stats.totalRecords, icon: <FileText size={22} />, color: '#0d9488', bg: '#f0fdfa', link: '/doctor/records' },
    { label: 'Messages', value: stats.unreadMessages, icon: <MessageSquare size={22} />, color: '#db2777', bg: '#fdf2f8', link: '/doctor/messages' },
  ];

  const quickActions = [
    { path: '/doctor/patients', icon: <Users size={22} />, label: 'Patients & Requests', desc: 'Manage patient connections and accept new requests', color: 'var(--primary-100)', iconColor: 'var(--primary-700)' },
    { path: '/doctor/appointments', icon: <Calendar size={22} />, label: 'Appointments', desc: 'Approve visits, complete consultations, add clinical notes', color: '#e0f2fe', iconColor: '#0369a1' },
    { path: '/doctor/questionnaires', icon: <ClipboardList size={22} />, label: 'Questionnaires', desc: 'Assign PHQ-D, GAD-7, Pediatric surveys, or Google Forms', color: '#f3e8ff', iconColor: '#7c3aed' },
    { path: '/doctor/records', icon: <FileText size={22} />, label: 'Medical Records', desc: 'Upload and manage clinical records for patients', color: '#f0fdfa', iconColor: '#0d9488' },
    { path: '/doctor/messages', icon: <MessageSquare size={22} />, label: 'Secure Messages', desc: 'Real-time encrypted messaging with your patients', color: '#fdf2f8', iconColor: '#db2777' },
  ];

  return (
    <div style={{ animation: 'slideInUp 200ms ease-out' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--slate-900)', letterSpacing: '-0.03em' }}>
              Clinical Portal
            </h1>
            <p style={{ fontSize: '0.875rem', color: 'var(--slate-500)', marginTop: '0.25rem' }}>
              Welcome back, Dr. {profile?.full_name || profile?.username}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-surface, #ffffff)', padding: '0.5rem 0.875rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--slate-200)', boxShadow: 'var(--shadow-sm)' }}>
            <ShieldCheck size={16} color="var(--primary-600)" />
            <span style={{ fontSize: '0.75rem', color: 'var(--slate-500)', fontWeight: 600 }}>Doctor ID:</span>
            <span style={{ fontSize: '0.8rem', fontWeight: 800, fontFamily: 'monospace', color: 'var(--primary-700)' }}>{profile?.public_id}</span>
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(175px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '1.5rem', alignItems: 'start' }}>
        {/* Quick Actions */}
        <div>
          <h2 style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--slate-700)', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Clinical Actions
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {quickActions.map(action => (
              <Link key={action.path} to={action.path} style={{ textDecoration: 'none' }}>
                <div className="card" style={{
                  display: 'flex', alignItems: 'center', gap: '1.25rem',
                  padding: '1.25rem', cursor: 'pointer',
                  transition: 'all var(--transition-normal)',
                }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateX(4px)'; (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-md)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = ''; }}
                >
                  <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: 'var(--radius-md)', background: action.color, color: action.iconColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {action.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--slate-900)' }}>{action.label}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)', marginTop: '0.15rem' }}>{action.desc}</div>
                  </div>
                  <ArrowRight size={16} color="var(--slate-400)" />
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div>
          <h2 style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--slate-700)', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Recent Activity
          </h2>
          <div className="card" style={{ padding: '1rem' }}>
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '1.5rem' }}>
                <div className="loading-spinner" />
              </div>
            ) : recentActivity.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--slate-400)' }}>
                <CheckCircle size={24} style={{ margin: '0 auto 0.5rem' }} />
                <p style={{ fontSize: '0.8rem' }}>All caught up!</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                {recentActivity.map((a, i) => (
                  <div key={i} style={{ display: 'flex', gap: '0.75rem', padding: '0.75rem 0', borderBottom: i < recentActivity.length - 1 ? '1px solid var(--slate-100)' : 'none' }}>
                    <div style={{ marginTop: '0.125rem', flexShrink: 0 }}>
                      {a.type === 'request' ? <AlertCircle size={16} color="var(--warning-text)" /> :
                       a.type === 'appointment' ? <Calendar size={16} color="var(--primary-600)" /> :
                       <ClipboardList size={16} color="#7c3aed" />}
                    </div>
                    <div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--slate-800)' }}>{a.label}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)', marginTop: '0.1rem' }}>{a.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
