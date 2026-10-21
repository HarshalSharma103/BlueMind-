import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import type { DoctorPatientRelationship, ConnectionRequest, OffboardingRequest } from '../../types';
import { UserCheck, UserX, AlertTriangle, CheckCircle2, AlertCircle, Calendar, ClipboardList, FileText, MessageSquare } from 'lucide-react';
import { Link } from 'react-router-dom';

export const DoctorPatients: React.FC = () => {
  const { user } = useAuth();
  const [inboundRequests, setInboundRequests] = useState<ConnectionRequest[]>([]);
  const [relationships, setRelationships] = useState<DoctorPatientRelationship[]>([]);
  const [offboardingRequests, setOffboardingRequests] = useState<OffboardingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Offboarding modal state
  const [offboardTarget, setOffboardTarget] = useState<DoctorPatientRelationship | null>(null);
  const [offboardReason, setOffboardReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadDoctorData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      // 1. Inbound connection requests
      const { data: reqs } = await supabase
        .from('connection_requests')
        .select(`
          *,
          patient:profiles!connection_requests_patient_id_fkey(full_name, username, public_id)
        `)
        .eq('doctor_id', user.id)
        .eq('status', 'PENDING')
        .order('created_at', { ascending: false });

      setInboundRequests((reqs || []) as unknown as ConnectionRequest[]);

      // 2. Active & historical relationships
      const { data: rels } = await supabase
        .from('doctor_patient_relationships')
        .select(`
          *,
          patient:profiles!doctor_patient_relationships_patient_id_fkey(full_name, username, public_id)
        `)
        .eq('doctor_id', user.id)
        .order('established_at', { ascending: false });

      setRelationships((rels || []) as unknown as DoctorPatientRelationship[]);

      // 3. Inbound offboarding requests where doctor is target
      const { data: offReqs } = await supabase
        .from('offboarding_requests')
        .select(`
          *,
          initiator:profiles!offboarding_requests_initiator_id_fkey(full_name, role)
        `)
        .eq('target_id', user.id)
        .eq('status', 'PENDING');

      setOffboardingRequests((offReqs || []) as unknown as OffboardingRequest[]);
    } catch (err: unknown) {
      console.error('Error fetching doctor patient data:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadDoctorData();
  }, [loadDoctorData]);

  // Handle connection request accept/reject
  const handleRespondRequest = async (requestId: string, accept: boolean) => {
    try {
      const { error } = await supabase
        .from('connection_requests')
        .update({ status: accept ? 'ACCEPTED' : 'REJECTED' })
        .eq('id', requestId);

      if (error) throw error;
      setFeedback({
        type: 'success',
        text: accept ? 'Patient connection accepted and active relationship established.' : 'Connection request rejected.'
      });
      await loadDoctorData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error processing request';
      setFeedback({ type: 'error', text: msg });
    }
  };

  // Handle doctor initiating offboard
  const handleInitiateDoctorOffboard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !offboardTarget) return;
    setSubmitting(true);

    try {
      const { error } = await supabase
        .from('offboarding_requests')
        .insert({
          relationship_id: offboardTarget.id,
          initiator_id: user.id,
          target_id: offboardTarget.patient_id,
          reason: offboardReason.trim() || 'Clinical care concluded or patient discharged.',
          status: 'PENDING'
        });

      if (error) throw error;
      setFeedback({ type: 'success', text: 'Offboarding request sent to patient. Relationship will close upon patient confirmation.' });
      setOffboardTarget(null);
      setOffboardReason('');
      await loadDoctorData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to request offboarding';
      setFeedback({ type: 'error', text: msg });
    } finally {
      setSubmitting(false);
    }
  };

  // Respond to patient's offboarding request
  const handleRespondOffboard = async (offboardingId: string, accept: boolean) => {
    try {
      const { error } = await supabase
        .from('offboarding_requests')
        .update({ status: accept ? 'ACCEPTED' : 'REJECTED' })
        .eq('id', offboardingId);

      if (error) throw error;
      setFeedback({
        type: 'success',
        text: accept ? 'Offboarding confirmed. Relationship moved to historical archive.' : 'Offboarding request declined. Relationship remains active.'
      });
      await loadDoctorData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error responding to offboarding';
      setFeedback({ type: 'error', text: msg });
    }
  };

  return (
    <div className="container" style={{ padding: '2rem 1.5rem' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Patient Management & Requests</h1>
          <p className="page-subtitle">Manage connected patients, review incoming connection invitations, and supervise care</p>
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

      {/* Patient Offboarding Requests Requiring Doctor Action */}
      {offboardingRequests.length > 0 && (
        <div className="card" style={{ marginBottom: '2rem', border: '1px solid var(--warning-border)', background: 'var(--warning-bg)' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--warning-text)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertTriangle size={20} /> Action Required: Patient Offboarding Requests ({offboardingRequests.length})
          </h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--slate-700)', margin: '0.5rem 0 1rem 0' }}>
            The following patients have requested to end their clinical relationship. Both parties must confirm before the relationship is archived.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {offboardingRequests.map((req) => (
              <div key={req.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-surface, #ffffff)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--warning-border)' }}>
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--slate-900)' }}>{req.initiator?.full_name || 'Patient'}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)' }}>Reason: {req.reason || 'None provided'}</div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn btn-danger" onClick={() => handleRespondOffboard(req.id, true)}>
                    Confirm Offboarding
                  </button>
                  <button className="btn btn-secondary" onClick={() => handleRespondOffboard(req.id, false)}>
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Inbound Connection Requests */}
      <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--slate-800)', marginBottom: '1rem' }}>
        Pending Connection Requests ({inboundRequests.length})
      </h2>

      {inboundRequests.length === 0 ? (
        <div className="card" style={{ padding: '1.5rem', marginBottom: '2.5rem', color: 'var(--slate-500)' }}>
          No pending connection requests from patients.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem', marginBottom: '2.5rem' }}>
          {inboundRequests.map((req) => (
            <div key={req.id} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--slate-900)' }}>
                    {req.patient?.full_name || 'Patient'}
                  </h3>
                  <span className="badge badge-pending">Pending</span>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)', fontFamily: 'monospace', marginBottom: '0.5rem' }}>
                  {req.patient?.public_id}
                </div>
                {req.message && (
                  <p style={{ fontSize: '0.85rem', color: 'var(--slate-600)', background: 'var(--slate-50)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', marginBottom: '1rem' }}>
                    "{req.message}"
                  </p>
                )}
                <div style={{ fontSize: '0.75rem', color: 'var(--slate-400)' }}>
                  Requested on {new Date(req.created_at).toLocaleDateString()}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--slate-100)' }}>
                <button
                  className="btn btn-primary"
                  style={{ flex: 1, padding: '0.5rem' }}
                  onClick={() => handleRespondRequest(req.id, true)}
                >
                  <UserCheck size={16} /> Accept
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ padding: '0.5rem', color: 'var(--danger-text)' }}
                  onClick={() => handleRespondRequest(req.id, false)}
                >
                  <UserX size={16} /> Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Connected Patients */}
      <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--slate-800)', marginBottom: '1rem' }}>
        Authorized Patients ({relationships.length})
      </h2>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <div className="loading-spinner" />
        </div>
      ) : relationships.length === 0 ? (
        <div className="empty-state">
          <h3>No connected patients yet</h3>
          <p>Patients will appear here once you accept their connection requests.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.5rem' }}>
          {relationships.map((rel) => (
            <div key={rel.id} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--slate-900)' }}>
                    {rel.patient?.full_name || 'Patient'}
                  </h3>
                  <span className={`badge ${rel.status === 'ACTIVE' ? 'badge-active' : rel.status === 'OFFBOARD_REQUESTED' ? 'badge-pending' : 'badge-offboarded'}`}>
                    {rel.status === 'ACTIVE' ? 'Active' : rel.status === 'OFFBOARD_REQUESTED' ? 'Offboard Requested' : 'Offboarded'}
                  </span>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)', fontFamily: 'monospace', marginBottom: '1rem' }}>
                  {rel.patient?.public_id}
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--slate-600)' }}>
                  Relationship established: {new Date(rel.established_at).toLocaleDateString()}
                </div>
              </div>

              <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--slate-100)', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {rel.status === 'ACTIVE' ? (
                  <>
                    <Link to="/doctor/appointments" className="btn btn-secondary" style={{ flex: 1, padding: '0.45rem 0.6rem', fontSize: '0.8rem' }}>
                      <Calendar size={13} /> Appt
                    </Link>
                    <Link to="/doctor/questionnaires" className="btn btn-secondary" style={{ flex: 1, padding: '0.45rem 0.6rem', fontSize: '0.8rem' }}>
                      <ClipboardList size={13} /> Assign
                    </Link>
                    <Link to="/doctor/records" className="btn btn-secondary" style={{ flex: 1, padding: '0.45rem 0.6rem', fontSize: '0.8rem' }}>
                      <FileText size={13} /> Records
                    </Link>
                    <Link to="/doctor/messages" className="btn btn-secondary" style={{ flex: 1, padding: '0.45rem 0.6rem', fontSize: '0.8rem' }}>
                      <MessageSquare size={13} /> Chat
                    </Link>
                    <button
                      className="btn btn-danger"
                      style={{ padding: '0.45rem 0.6rem', fontSize: '0.8rem' }}
                      title="Offboard Patient"
                      onClick={() => setOffboardTarget(rel)}
                    >
                      Offboard
                    </button>
                  </>
                ) : (
                  <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)', fontStyle: 'italic' }}>
                    {rel.status === 'OFFBOARDED' ? 'Offboarded relationship — historical clinical records preserved.' : 'Offboarding pending mutual consensus.'}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Doctor Initiating Offboarding Modal */}
      {offboardTarget && (
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
          <div className="card" style={{ width: '100%', maxWidth: '480px', padding: '2rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--slate-900)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <UserX size={20} color="var(--danger-text)" /> Offboard Patient: {offboardTarget.patient?.full_name}
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--slate-600)', marginBottom: '1.25rem' }}>
              Offboarding moves the persistent relationship to the archived state. Both parties retain access to historical appointments and records, but no new assignments or visits can be created. The patient must confirm this request.
            </p>

            <form onSubmit={handleInitiateDoctorOffboard}>
              <div className="form-group">
                <label className="form-label" htmlFor="docOffboardReason">Clinical Reason for Offboarding</label>
                <textarea
                  id="docOffboardReason"
                  rows={3}
                  className="form-textarea"
                  placeholder="e.g. Care completed, referral to another specialist, patient request..."
                  value={offboardReason}
                  onChange={(e) => setOffboardReason(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setOffboardTarget(null)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-danger"
                  disabled={submitting}
                >
                  {submitting ? <span className="loading-spinner" /> : 'Submit Offboarding Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
