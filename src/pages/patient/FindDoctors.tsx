import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import type { DoctorProfile, ConnectionRequest, DoctorPatientRelationship } from '../../types';
import { Search, UserCheck, Clock, CheckCircle2, AlertCircle, Stethoscope, Briefcase, DollarSign } from 'lucide-react';

export const FindDoctors: React.FC = () => {
  const { user } = useAuth();
  const [doctors, setDoctors] = useState<(DoctorProfile & { profile: { full_name: string; username: string; public_id: string } })[]>([]);
  const [existingRequests, setExistingRequests] = useState<Record<string, ConnectionRequest>>({});
  const [existingRelationships, setExistingRelationships] = useState<Record<string, DoctorPatientRelationship>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState('');
  const [loading, setLoading] = useState(true);

  // Connection modal state
  const [connectingDoctor, setConnectingDoctor] = useState<{ id: string; name: string } | null>(null);
  const [connectMessage, setConnectMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadDoctorsAndStatus = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      // 1. Fetch all doctors and their base profile
      const { data: docData, error: docError } = await supabase
        .from('doctor_profiles')
        .select(`
          *,
          profile:profiles!inner(full_name, username, public_id, role)
        `)
        .eq('is_accepting_patients', true);

      if (docError) throw docError;
      setDoctors((docData || []) as unknown as (DoctorProfile & { profile: { full_name: string; username: string; public_id: string } })[]);

      // 2. Fetch existing connection requests for this patient
      const { data: reqData } = await supabase
        .from('connection_requests')
        .select('*')
        .eq('patient_id', user.id);

      const reqMap: Record<string, ConnectionRequest> = {};
      (reqData || []).forEach((req) => {
        if (req.status === 'PENDING') {
          reqMap[req.doctor_id] = req;
        }
      });
      setExistingRequests(reqMap);

      // 3. Fetch active or offboarded relationships
      const { data: relData } = await supabase
        .from('doctor_patient_relationships')
        .select('*')
        .eq('patient_id', user.id);

      const relMap: Record<string, DoctorPatientRelationship> = {};
      (relData || []).forEach((rel) => {
        relMap[rel.doctor_id] = rel;
      });
      setExistingRelationships(relMap);
    } catch (err: unknown) {
      console.error('Error fetching doctors:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadDoctorsAndStatus();
  }, [loadDoctorsAndStatus]);

  const handleSendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !connectingDoctor) return;
    setSubmitting(true);
    setFeedback(null);

    try {
      const { error } = await supabase
        .from('connection_requests')
        .insert({
          patient_id: user.id,
          doctor_id: connectingDoctor.id,
          message: connectMessage.trim() || 'I would like to connect for clinical care.',
          status: 'PENDING'
        });

      if (error) throw error;

      setFeedback({ type: 'success', text: `Connection request sent to ${connectingDoctor.name}!` });
      setConnectingDoctor(null);
      setConnectMessage('');
      await loadDoctorsAndStatus();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send request';
      setFeedback({ type: 'error', text: msg });
    } finally {
      setSubmitting(false);
    }
  };

  const filteredDoctors = doctors.filter((doc) => {
    const matchesSearch =
      doc.profile?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.specialty?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.profile?.public_id?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesSpecialty = selectedSpecialty ? doc.specialty === selectedSpecialty : true;
    return matchesSearch && matchesSpecialty;
  });

  const uniqueSpecialties = Array.from(new Set(doctors.map((d) => d.specialty).filter(Boolean)));

  return (
    <div className="container" style={{ padding: '2rem 1.5rem' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Find Clinical Specialists</h1>
          <p className="page-subtitle">Search verified healthcare providers and request clinical care connections</p>
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

      {/* Search & Filter Bar */}
      <div className="card" style={{ marginBottom: '2rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ flex: '1', minWidth: '260px', position: 'relative' }}>
          <input
            type="text"
            className="form-input"
            placeholder="Search by doctor name, specialty, or Public ID (e.g. DR-XXXXXX)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '2.5rem' }}
          />
          <Search size={18} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--slate-400)' }} />
        </div>

        <select
          className="form-select"
          style={{ width: 'auto', minWidth: '200px' }}
          value={selectedSpecialty}
          onChange={(e) => setSelectedSpecialty(e.target.value)}
        >
          <option value="">All Specialties</option>
          {uniqueSpecialties.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Doctors Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <div className="loading-spinner" />
          <p style={{ marginTop: '0.75rem', color: 'var(--slate-500)' }}>Finding doctors...</p>
        </div>
      ) : filteredDoctors.length === 0 ? (
        <div className="empty-state">
          <h3>No doctors found</h3>
          <p>Try adjusting your search criteria or specialty filter.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
          {filteredDoctors.map((doc) => {
            const rel = existingRelationships[doc.id];
            const pendingReq = existingRequests[doc.id];

            return (
              <div key={doc.id} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                    <div>
                      <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--slate-900)' }}>
                        {doc.profile?.full_name || 'Dr. Specialist'}
                      </h3>
                      <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)', fontFamily: 'monospace', fontWeight: 600 }}>
                        {doc.profile?.public_id}
                      </div>
                    </div>
                    <span className="badge badge-approved" style={{ fontSize: '0.7rem' }}>
                      Accepting
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem', color: 'var(--slate-600)', fontSize: '0.875rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Stethoscope size={16} color="var(--primary-600)" />
                      <span style={{ fontWeight: 600, color: 'var(--slate-800)' }}>{doc.specialty}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Briefcase size={16} color="var(--slate-400)" />
                      <span>{doc.years_of_experience} years clinical experience</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <DollarSign size={16} color="var(--slate-400)" />
                      <span>${doc.consultation_fee} per consultation</span>
                    </div>
                  </div>

                  {doc.bio && (
                    <p style={{ fontSize: '0.875rem', color: 'var(--slate-600)', marginBottom: '1.25rem', lineHeight: '1.4' }}>
                      {doc.bio}
                    </p>
                  )}
                </div>

                <div style={{ paddingTop: '1rem', borderTop: '1px solid var(--slate-100)' }}>
                  {rel?.status === 'ACTIVE' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--success-text)', fontWeight: 700, fontSize: '0.875rem' }}>
                      <CheckCircle2 size={18} /> Connected Doctor
                    </div>
                  ) : rel?.status === 'OFFBOARD_REQUESTED' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--warning-text)', fontWeight: 600, fontSize: '0.875rem' }}>
                      <Clock size={18} /> Offboarding In Progress
                    </div>
                  ) : pendingReq ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--warning-text)', fontWeight: 600, fontSize: '0.875rem' }}>
                      <Clock size={18} /> Connection Request Pending
                    </div>
                  ) : (
                    <button
                      className="btn btn-primary"
                      style={{ width: '100%' }}
                      onClick={() => setConnectingDoctor({ id: doc.id, name: doc.profile?.full_name || 'the doctor' })}
                    >
                      <UserCheck size={16} /> Request Connection
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Connect Request Modal */}
      {connectingDoctor && (
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
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--slate-900)', marginBottom: '0.5rem' }}>
              Connect with {connectingDoctor.name}
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--slate-500)', marginBottom: '1.25rem' }}>
              Sending a connection request establishes a persistent doctor-patient healthcare relationship upon approval.
            </p>

            <form onSubmit={handleSendRequest}>
              <div className="form-group">
                <label className="form-label" htmlFor="connectMsg">Introductory Note (Optional)</label>
                <textarea
                  id="connectMsg"
                  rows={4}
                  className="form-textarea"
                  placeholder="Introduce yourself or share reason for seeking care..."
                  value={connectMessage}
                  onChange={(e) => setConnectMessage(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setConnectingDoctor(null)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                >
                  {submitting ? <span className="loading-spinner" /> : 'Send Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
