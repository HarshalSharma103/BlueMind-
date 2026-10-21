import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import type { Appointment, AppointmentStatus } from '../../types';
import { Calendar, Clock, CheckCircle2, AlertCircle, XCircle, FileText, Check } from 'lucide-react';

export const DoctorAppointments: React.FC = () => {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Notes modal
  const [editingNotesAppt, setEditingNotesAppt] = useState<Appointment | null>(null);
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  const loadAppointments = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          *,
          patient:profiles!appointments_patient_id_fkey(full_name, username, public_id)
        `)
        .eq('doctor_id', user.id)
        .order('scheduled_start', { ascending: false });

      if (error) throw error;
      setAppointments((data || []) as unknown as Appointment[]);
    } catch (err: unknown) {
      console.error('Error fetching doctor appointments:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  const handleUpdateStatus = async (apptId: string, newStatus: AppointmentStatus) => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: newStatus })
        .eq('id', apptId);

      if (error) throw error;

      setFeedback({ type: 'success', text: `Appointment status updated to ${newStatus}.` });
      await loadAppointments();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error updating status';
      setFeedback({ type: 'error', text: msg });
    }
  };

  const handleSaveNotes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNotesAppt) return;
    setSavingNotes(true);

    try {
      const { error } = await supabase
        .from('appointments')
        .update({ doctor_notes: notes.trim() })
        .eq('id', editingNotesAppt.id);

      if (error) throw error;

      setFeedback({ type: 'success', text: 'Clinical consultation notes saved.' });
      setEditingNotesAppt(null);
      await loadAppointments();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error saving notes';
      setFeedback({ type: 'error', text: msg });
    } finally {
      setSavingNotes(false);
    }
  };

  const filtered = appointments.filter((a) => {
    if (selectedStatus === 'ALL') return true;
    return a.status === selectedStatus;
  });

  return (
    <div className="container" style={{ padding: '2rem 1.5rem' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Doctor Consultation Schedule</h1>
          <p className="page-subtitle">Review, approve, and record clinical visits with your connected patients</p>
        </div>
      </div>

      {feedback && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.875rem 1rem',
          background: feedback.type === 'success' ? 'var(--success-bg)' : 'var(--danger-bg)',
          border: `1px solid ${feedback.type === 'success' ? 'var(--success-border)' : 'var(--danger-border)'}`,
          borderRadius: 'var(--radius-md)',
          color: feedback.type === 'success' ? 'var(--success-text)' : 'var(--danger-text)',
          marginBottom: '1.5rem'
        }}>
          {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {['ALL', 'PENDING', 'APPROVED', 'COMPLETED', 'CANCELLED'].map((st) => (
          <button
            key={st}
            className={`btn ${selectedStatus === st ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.4rem 0.875rem', fontSize: '0.8rem' }}
            onClick={() => setSelectedStatus(st)}
          >
            {st} {st !== 'ALL' && `(${appointments.filter((a) => a.status === st).length})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <div className="loading-spinner" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <h3>No appointments in this category</h3>
          <p>Consultations requested by your patients will appear here.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filtered.map((appt) => {
            const start = new Date(appt.scheduled_start);
            const end = new Date(appt.scheduled_end);

            return (
              <div key={appt.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.25rem' }}>
                <div style={{ flex: '1', minWidth: '280px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--slate-900)' }}>
                      {appt.patient?.full_name || 'Patient'}
                    </h3>
                    <span className={`badge badge-${appt.status.toLowerCase()}`}>
                      {appt.status}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)', fontFamily: 'monospace', marginBottom: '0.5rem' }}>
                    {appt.patient?.public_id}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: 'var(--slate-600)', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                      <Calendar size={15} color="var(--primary-600)" />
                      <span>{start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                      <Clock size={15} color="var(--primary-600)" />
                      <span>{start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>

                  {appt.reason_for_visit && (
                    <div style={{ fontSize: '0.85rem', color: 'var(--slate-700)', marginBottom: '0.5rem' }}>
                      <strong>Patient Reason:</strong> {appt.reason_for_visit}
                    </div>
                  )}

                  {appt.doctor_notes && (
                    <div style={{ fontSize: '0.85rem', color: 'var(--slate-700)', background: 'var(--slate-50)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)' }}>
                      <strong>Clinical Notes:</strong> {appt.doctor_notes}
                    </div>
                  )}
                </div>

                {/* State Machine Transition Actions */}
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {appt.status === 'PENDING' && (
                    <>
                      <button
                        className="btn btn-primary"
                        style={{ padding: '0.45rem 0.75rem', fontSize: '0.8rem' }}
                        onClick={() => handleUpdateStatus(appt.id, 'APPROVED')}
                      >
                        <Check size={14} /> Approve Visit
                      </button>
                      <button
                        className="btn btn-secondary"
                        style={{ color: 'var(--danger-text)', padding: '0.45rem 0.75rem', fontSize: '0.8rem' }}
                        onClick={() => handleUpdateStatus(appt.id, 'REJECTED')}
                      >
                        <XCircle size={14} /> Decline
                      </button>
                    </>
                  )}

                  {appt.status === 'APPROVED' && (
                    <>
                      <button
                        className="btn btn-success"
                        style={{ padding: '0.45rem 0.75rem', fontSize: '0.8rem' }}
                        onClick={() => handleUpdateStatus(appt.id, 'COMPLETED')}
                      >
                        <CheckCircle2 size={14} /> Mark Completed
                      </button>
                      <button
                        className="btn btn-secondary"
                        style={{ color: 'var(--danger-text)', padding: '0.45rem 0.75rem', fontSize: '0.8rem' }}
                        onClick={() => handleUpdateStatus(appt.id, 'CANCELLED')}
                      >
                        Cancel
                      </button>
                    </>
                  )}

                  <button
                    className="btn btn-secondary"
                    style={{ padding: '0.45rem 0.75rem', fontSize: '0.8rem' }}
                    onClick={() => {
                      setEditingNotesAppt(appt);
                      setNotes(appt.doctor_notes || '');
                    }}
                  >
                    <FileText size={14} /> {appt.doctor_notes ? 'Edit Notes' : 'Add Notes'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Doctor Notes Modal */}
      {editingNotesAppt && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
          zIndex: 100
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '500px', padding: '2rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--slate-900)', marginBottom: '0.5rem' }}>
              Clinical Notes for {editingNotesAppt.patient?.full_name}
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--slate-500)', marginBottom: '1rem' }}>
              Add consultation summary, diagnoses, or follow-up instructions.
            </p>

            <form onSubmit={handleSaveNotes}>
              <div className="form-group">
                <textarea
                  rows={5}
                  className="form-textarea"
                  placeholder="Record clinical observations and treatment plan..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditingNotesAppt(null)}
                  disabled={savingNotes}
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={savingNotes}
                >
                  {savingNotes ? <span className="loading-spinner" /> : 'Save Notes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
