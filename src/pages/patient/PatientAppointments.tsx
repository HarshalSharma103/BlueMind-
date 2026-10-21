import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import type { Appointment, DoctorPatientRelationship } from '../../types';
import { Calendar, Plus, Clock, CheckCircle2, AlertCircle, XCircle } from 'lucide-react';

export const PatientAppointments: React.FC = () => {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [activeRelationships, setActiveRelationships] = useState<DoctorPatientRelationship[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Booking modal
  const [showModal, setShowModal] = useState(false);
  const [selectedRelId, setSelectedRelId] = useState('');
  const [scheduledStart, setScheduledStart] = useState('');
  const [scheduledEnd, setScheduledEnd] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadAppointments = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      // 1. Fetch appointments
      const { data: apptData, error: apptError } = await supabase
        .from('appointments')
        .select(`
          *,
          doctor:profiles!appointments_doctor_id_fkey(full_name, username, public_id)
        `)
        .eq('patient_id', user.id)
        .order('scheduled_start', { ascending: false });

      if (apptError) throw apptError;
      setAppointments((apptData || []) as unknown as Appointment[]);

      // 2. Fetch ACTIVE relationships for booking
      const { data: relData } = await supabase
        .from('doctor_patient_relationships')
        .select(`
          *,
          doctor:profiles!doctor_patient_relationships_doctor_id_fkey(full_name, public_id)
        `)
        .eq('patient_id', user.id)
        .eq('status', 'ACTIVE');

      setActiveRelationships((relData || []) as unknown as DoctorPatientRelationship[]);
    } catch (err: unknown) {
      console.error('Error fetching appointments:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  const handleBookAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedRelId) return;

    if (new Date(scheduledEnd) <= new Date(scheduledStart)) {
      setFeedback({ type: 'error', text: 'Appointment end time must be after the start time.' });
      return;
    }

    const rel = activeRelationships.find((r) => r.id === selectedRelId);
    if (!rel) return;

    setSubmitting(true);
    setFeedback(null);

    try {
      const { error } = await supabase
        .from('appointments')
        .insert({
          relationship_id: rel.id,
          patient_id: user.id,
          doctor_id: rel.doctor_id,
          scheduled_start: new Date(scheduledStart).toISOString(),
          scheduled_end: new Date(scheduledEnd).toISOString(),
          reason_for_visit: reason.trim() || 'General Consultation',
          status: 'PENDING'
        });

      if (error) throw error;

      setFeedback({ type: 'success', text: 'Appointment requested successfully! Awaiting doctor approval.' });
      setShowModal(false);
      setSelectedRelId('');
      setScheduledStart('');
      setScheduledEnd('');
      setReason('');
      await loadAppointments();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error booking appointment';
      setFeedback({ type: 'error', text: msg });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelAppointment = async (apptId: string) => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: 'CANCELLED' })
        .eq('id', apptId);

      if (error) throw error;
      setFeedback({ type: 'success', text: 'Appointment cancelled.' });
      await loadAppointments();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to cancel appointment';
      setFeedback({ type: 'error', text: msg });
    }
  };

  return (
    <div className="container" style={{ padding: '2rem 1.5rem' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">My Appointments</h1>
          <p className="page-subtitle">Schedule clinical consultations with your connected healthcare providers</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setShowModal(true)}
          disabled={activeRelationships.length === 0}
        >
          <Plus size={16} /> Request Appointment
        </button>
      </div>

      {activeRelationships.length === 0 && !loading && (
        <div className="card" style={{ marginBottom: '1.5rem', background: 'var(--warning-bg)', border: '1px solid var(--warning-border)', color: 'var(--warning-text)' }}>
          <p style={{ fontSize: '0.875rem' }}>
            You need an active doctor relationship to schedule appointments. Please visit <strong>Find Doctors</strong> to request care first.
          </p>
        </div>
      )}

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

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <div className="loading-spinner" />
        </div>
      ) : appointments.length === 0 ? (
        <div className="empty-state">
          <h3>No appointments scheduled</h3>
          <p>Request an appointment slot with any of your actively connected doctors.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {appointments.map((appt) => {
            const start = new Date(appt.scheduled_start);
            const end = new Date(appt.scheduled_end);

            return (
              <div key={appt.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--slate-900)' }}>
                      {appt.doctor?.full_name || 'Dr. Specialist'}
                    </h3>
                    <span className={`badge badge-${appt.status.toLowerCase()}`}>
                      {appt.status}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: 'var(--slate-600)', fontSize: '0.875rem', margin: '0.5rem 0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                      <Calendar size={15} color="var(--primary-600)" />
                      <span>{start.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                      <Clock size={15} color="var(--primary-600)" />
                      <span>{start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>

                  {appt.reason_for_visit && (
                    <div style={{ fontSize: '0.85rem', color: 'var(--slate-700)' }}>
                      <strong>Reason:</strong> {appt.reason_for_visit}
                    </div>
                  )}

                  {appt.doctor_notes && (
                    <div style={{ fontSize: '0.85rem', color: 'var(--slate-700)', marginTop: '0.25rem' }}>
                      <strong>Doctor Notes:</strong> {appt.doctor_notes}
                    </div>
                  )}
                </div>

                <div>
                  {(appt.status === 'PENDING' || appt.status === 'APPROVED') && (
                    <button
                      className="btn btn-secondary"
                      style={{ color: 'var(--danger-text)', borderColor: 'var(--danger-border)' }}
                      onClick={() => handleCancelAppointment(appt.id)}
                    >
                      <XCircle size={16} /> Cancel Visit
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Booking Modal */}
      {showModal && (
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
              Request New Consultation
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--slate-500)', marginBottom: '1.25rem' }}>
              Select a connected doctor and desired consultation time slot.
            </p>

            <form onSubmit={handleBookAppointment}>
              <div className="form-group">
                <label className="form-label" htmlFor="docSelect">Select Doctor</label>
                <select
                  id="docSelect"
                  className="form-select"
                  value={selectedRelId}
                  onChange={(e) => setSelectedRelId(e.target.value)}
                  required
                >
                  <option value="">-- Choose Connected Doctor --</option>
                  {activeRelationships.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.doctor?.full_name} ({r.doctor?.public_id})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="startTime">Start Time</label>
                  <input
                    id="startTime"
                    type="datetime-local"
                    className="form-input"
                    value={scheduledStart}
                    onChange={(e) => setScheduledStart(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="endTime">End Time</label>
                  <input
                    id="endTime"
                    type="datetime-local"
                    className="form-input"
                    value={scheduledEnd}
                    onChange={(e) => setScheduledEnd(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="apptReason">Reason for Consultation</label>
                <textarea
                  id="apptReason"
                  rows={3}
                  className="form-textarea"
                  placeholder="Describe your symptoms or consultation purpose..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowModal(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                >
                  {submitting ? <span className="loading-spinner" /> : 'Request Appointment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
