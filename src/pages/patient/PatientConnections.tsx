import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import type { DoctorPatientRelationship, ConnectionRequest, OffboardingRequest } from '../../types';
import { AlertTriangle, CheckCircle2, AlertCircle, UserX, UserMinus, Calendar, ClipboardList, FileText, MessageSquare } from 'lucide-react';
import { Link } from 'react-router-dom';

export const PatientConnections: React.FC = () => {
  const { user } = useAuth();
  const [relationships, setRelationships] = useState<DoctorPatientRelationship[]>([]);
  const [pendingRequests, setPendingRequests] = useState<ConnectionRequest[]>([]);
  const [offboardingRequests, setOffboardingRequests] = useState<OffboardingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Offboarding modal state
  const [offboardingRel, setOffboardingRel] = useState<DoctorPatientRelationship | null>(null);
  const [offboardingReason, setOffboardingReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      // 1. Load relationships
      const { data: rels } = await supabase
        .from('doctor_patient_relationships')
        .select(`
          *,
          doctor:profiles!doctor_patient_relationships_doctor_id_fkey(full_name, username, public_id)
        `)
        .eq('patient_id', user.id)
        .order('created_at', { ascending: false });

      setRelationships((rels || []) as unknown as DoctorPatientRelationship[]);

      // 2. Load pending connection requests sent by patient
      const { data: reqs } = await supabase
        .from('connection_requests')
        .select(`
          *,
          doctor:profiles!connection_requests_doctor_id_fkey(full_name, username, public_id)
        `)
        .eq('patient_id', user.id)
        .eq('status', 'PENDING')
        .order('created_at', { ascending: false });

      setPendingRequests((reqs || []) as unknown as ConnectionRequest[]);

      // 3. Load pending offboarding requests involving this patient
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
      console.error('Error loading connections:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Cancel pending request
  const handleCancelRequest = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from('connection_requests')
        .update({ status: 'CANCELLED' })
        .eq('id', requestId);

      if (error) throw error;
      setFeedback({ type: 'success', text: 'Connection request cancelled.' });
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error cancelling request';
      setFeedback({ type: 'error', text: msg });
    }
  };

  // Initiate offboarding
  const handleInitiateOffboard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !offboardingRel) return;
    setSubmitting(true);

    try {
      const { error } = await supabase
        .from('offboarding_requests')
        .insert({
          relationship_id: offboardingRel.id,
          initiator_id: user.id,
          target_id: offboardingRel.doctor_id,
          reason: offboardingReason.trim() || 'Patient requested to end relationship.',
          status: 'PENDING'
        });

      if (error) throw error;
      setFeedback({ type: 'success', text: 'Offboarding request submitted. Awaiting doctor confirmation.' });
      setOffboardingRel(null);
      setOffboardingReason('');
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to request offboarding';
      setFeedback({ type: 'error', text: msg });
    } finally {
      setSubmitting(false);
    }
  };

  // Respond to doctor's offboarding request
  const handleRespondOffboard = async (offboardingId: string, accept: boolean) => {
    try {
      const { error } = await supabase
        .from('offboarding_requests')
        .update({ status: accept ? 'ACCEPTED' : 'REJECTED' })
        .eq('id', offboardingId);

      if (error) throw error;
      setFeedback({
        type: 'success',
        text: accept ? 'Relationship successfully offboarded. Historical data preserved.' : 'Offboarding declined. Relationship remains active.'
      });
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error responding to offboarding';
      setFeedback({ type: 'error', text: msg });
    }
  };

  return (
    <div className="container" style={{ padding: '2rem 1.5rem' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">My Doctor Connections</h1>
          <p className="page-subtitle">Manage persistent clinical relationships and active care partnerships</p>
        </div>
        <Link to="/patient/find-doctors" className="btn btn-primary">
          Find More Doctors
        </Link>
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

      {/* Inbound Offboarding Requests Banner */}
      {offboardingRequests.length > 0 && (
        <div className="card" style={{ marginBottom: '2rem', border: '1px solid var(--warning-border)', background: 'var(--warning-bg)' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--warning-text)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertTriangle size={20} /> Action Required: Doctor Offboarding Request
          </h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--slate-700)', margin: '0.5rem 0 1rem 0' }}>
            Your doctor has requested to conclude your active clinical relationship. Neither party may unilaterally terminate an active relationship. You may accept or reject this request.
          </p>

          {offboardingRequests.map((req) => (
            <div key={req.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-surface, #ffffff)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--warning-border)' }}>
              <div>
                <div style={{ fontWeight: 700, color: 'var(--slate-900)' }}>{req.initiator?.full_name || 'Your Doctor'}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)' }}>Reason: {req.reason || 'No specific reason provided'}</div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-danger" onClick={() => handleRespondOffboard(req.id, true)}>
                  Accept & Conclude
                </button>
                <button className="btn btn-secondary" onClick={() => handleRespondOffboard(req.id, false)}>
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Active & Established Relationships */}
      <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--slate-800)', marginBottom: '1rem' }}>
        Established Relationships ({relationships.length})
      </h2>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <div className="loading-spinner" />
        </div>
      ) : relationships.length === 0 ? (
        <div className="empty-state" style={{ marginBottom: '2rem' }}>
          <h3>No connected doctors yet</h3>
          <p>Find clinical specialists and request connection to access appointments and questionnaires.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
          {relationships.map((rel) => (
            <div key={rel.id} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--slate-900)' }}>
                    {rel.doctor?.full_name || 'Dr. Specialist'}
                  </h3>
                  <span className={`badge ${rel.status === 'ACTIVE' ? 'badge-active' : rel.status === 'OFFBOARD_REQUESTED' ? 'badge-pending' : 'badge-offboarded'}`}>
                    {rel.status === 'ACTIVE' ? 'Active Care' : rel.status === 'OFFBOARD_REQUESTED' ? 'Offboard Pending' : 'Offboarded'}
                  </span>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)', fontFamily: 'monospace', marginBottom: '1rem' }}>
                  {rel.doctor?.public_id}
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--slate-600)' }}>
                  Connected on {new Date(rel.established_at).toLocaleDateString()}
                </div>
              </div>

              <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--slate-100)', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {rel.status === 'ACTIVE' ? (
                  <>
                    <Link to="/patient/appointments" className="btn btn-secondary" style={{ flex: 1, padding: '0.45rem 0.6rem', fontSize: '0.8rem' }}>
                      <Calendar size={13} /> Appt
                    </Link>
                    <Link to="/patient/questionnaires" className="btn btn-secondary" style={{ flex: 1, padding: '0.45rem 0.6rem', fontSize: '0.8rem' }}>
                      <ClipboardList size={13} /> Tests
                    </Link>
                    <Link to="/patient/records" className="btn btn-secondary" style={{ flex: 1, padding: '0.45rem 0.6rem', fontSize: '0.8rem' }}>
                      <FileText size={13} /> Records
                    </Link>
                    <Link to="/patient/messages" className="btn btn-secondary" style={{ flex: 1, padding: '0.45rem 0.6rem', fontSize: '0.8rem' }}>
                      <MessageSquare size={13} /> Chat
                    </Link>
                    <button
                      className="btn btn-danger"
                      style={{ padding: '0.45rem 0.6rem', fontSize: '0.8rem' }}
                      title="End Doctor Relationship"
                      onClick={() => setOffboardingRel(rel)}
                    >
                      <UserMinus size={13} /> End Care
                    </button>
                  </>
                ) : rel.status === 'OFFBOARDED' ? (
                  <div style={{ width: '100%', fontSize: '0.8rem', color: 'var(--slate-500)', fontStyle: 'italic' }}>
                    Historical care archive preserved. Reconnection requires sending a new request.
                  </div>
                ) : (
                  <div style={{ width: '100%', fontSize: '0.85rem', color: 'var(--warning-text)', fontWeight: 600 }}>
                    Offboarding awaiting review.
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pending Connection Requests Sent */}
      <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--slate-800)', marginBottom: '1rem' }}>
        Pending Connection Requests Sent ({pendingRequests.length})
      </h2>

      {pendingRequests.length === 0 ? (
        <p style={{ color: 'var(--slate-500)', fontSize: '0.9rem' }}>No pending connection requests.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
          {pendingRequests.map((req) => (
            <div key={req.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, color: 'var(--slate-900)' }}>{req.doctor?.full_name || 'Dr. Specialist'}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)' }}>
                  Sent on {new Date(req.created_at).toLocaleDateString()}
                </div>
              </div>
              <button
                className="btn btn-secondary"
                style={{ color: 'var(--danger-text)', borderColor: 'var(--danger-border)' }}
                onClick={() => handleCancelRequest(req.id)}
              >
                Cancel
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Offboarding Modal */}
      {offboardingRel && (
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
              <UserX size={20} color="var(--danger-text)" /> End Doctor Relationship
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--slate-600)', marginBottom: '1.25rem' }}>
              Ending a relationship requires mutual doctor confirmation. Once finalized, no new appointments or questionnaires may be assigned, but historical medical records and clinical logs remain preserved.
            </p>

            <form onSubmit={handleInitiateOffboard}>
              <div className="form-group">
                <label className="form-label" htmlFor="offboardReason">Reason for Ending Care</label>
                <textarea
                  id="offboardReason"
                  rows={3}
                  className="form-textarea"
                  placeholder="e.g. Relocating, completed therapy, or seeking other specialist..."
                  value={offboardingReason}
                  onChange={(e) => setOffboardingReason(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setOffboardingRel(null)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-danger"
                  disabled={submitting}
                >
                  {submitting ? <span className="loading-spinner" /> : 'Request Offboarding'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
