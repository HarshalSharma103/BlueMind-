import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import type { ConnectionRequest, DoctorPatientRelationship } from '../../types';
import {
  Search, UserCheck, Clock, CheckCircle2, AlertCircle,
  Stethoscope, Briefcase, X, Sparkles, User, ChevronDown,
  ChevronUp, IndianRupee, ShieldCheck
} from 'lucide-react';

interface DoctorWithProfile {
  id: string;
  specialty?: string;
  bio?: string | null;
  consultation_fee?: number;
  years_of_experience?: number;
  is_accepting_patients?: boolean;
  profile?: {
    id?: string;
    full_name: string;
    username: string;
    public_id: string;
    role?: string;
    avatar_url?: string | null;
  };
}

export const FindDoctors: React.FC = () => {
  const { user } = useAuth();
  const [doctors, setDoctors] = useState<DoctorWithProfile[]>([]);
  const [existingRequests, setExistingRequests] = useState<Record<string, ConnectionRequest>>({});
  const [existingRelationships, setExistingRelationships] = useState<Record<string, DoctorPatientRelationship>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [initialLoading, setInitialLoading] = useState(true);
  const [expandedDoctorId, setExpandedDoctorId] = useState<string | null>(null);

  // Connection modal state
  const [connectingDoctor, setConnectingDoctor] = useState<{ id: string; name: string; username?: string } | null>(null);
  const [connectMessage, setConnectMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadDoctorsAndStatus = useCallback(async () => {
    if (!user) return;

    try {
      // 1. Fetch doctors joined with their base profiles
      const { data: docData, error: docError } = await supabase
        .from('doctor_profiles')
        .select(`
          *,
          profile:profiles!inner(full_name, username, public_id, role, avatar_url)
        `)
        .eq('is_accepting_patients', true);

      if (docError) {
        console.warn('Note loading doctor_profiles:', docError.message);
        // Fallback: query profiles where role is doctor
        const { data: fallbackProfiles } = await supabase
          .from('profiles')
          .select('id, full_name, username, public_id, role, avatar_url')
          .eq('role', 'doctor');

        if (fallbackProfiles && fallbackProfiles.length > 0) {
          const synthesized: DoctorWithProfile[] = fallbackProfiles.map((p) => ({
            id: p.id,
            specialty: 'Clinical Specialist',
            years_of_experience: 1,
            consultation_fee: 500,
            is_accepting_patients: true,
            profile: {
              full_name: p.full_name,
              username: p.username,
              public_id: p.public_id,
              role: p.role,
              avatar_url: p.avatar_url
            }
          }));
          setDoctors(synthesized);
        }
      } else if (docData) {
        setDoctors(docData as unknown as DoctorWithProfile[]);
      }

      // 2. Fetch existing connection requests for this patient
      try {
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
      } catch {
        // Table might not exist yet
      }

      // 3. Fetch active or offboarded relationships
      try {
        const { data: relData } = await supabase
          .from('doctor_patient_relationships')
          .select('*')
          .eq('patient_id', user.id);

        const relMap: Record<string, DoctorPatientRelationship> = {};
        (relData || []).forEach((rel) => {
          relMap[rel.doctor_id] = rel;
        });
        setExistingRelationships(relMap);
      } catch {
        // Table might not exist yet
      }
    } catch (err: unknown) {
      console.warn('Error loading doctors:', err);
    } finally {
      setInitialLoading(false);
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

      setFeedback({ type: 'success', text: `Connection request sent to ${connectingDoctor.name} (@${connectingDoctor.username || 'doctor'})!` });
      setConnectingDoctor(null);
      setConnectMessage('');
      await loadDoctorsAndStatus();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send request. Please ensure the connection_requests table is created.';
      setFeedback({ type: 'error', text: msg });
    } finally {
      setSubmitting(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedDoctorId((prev) => (prev === id ? null : id));
  };

  // Instagram-style query cleanup (strips leading '@')
  const cleanQuery = searchQuery.trim().toLowerCase().replace(/^@/, '');
  const hasQuery = cleanQuery.length > 0;

  // Recommendations filtered when username/name is entered
  const recommendedDoctors = hasQuery
    ? doctors.filter((doc) => {
        const username = doc.profile?.username?.toLowerCase() || '';
        const fullName = doc.profile?.full_name?.toLowerCase() || '';
        const publicId = doc.profile?.public_id?.toLowerCase() || '';
        const specialty = doc.specialty?.toLowerCase() || '';

        return (
          username.includes(cleanQuery) ||
          fullName.includes(cleanQuery) ||
          publicId.includes(cleanQuery) ||
          specialty.includes(cleanQuery)
        );
      })
    : [];

  return (
    <div className="container" style={{ maxWidth: '820px', padding: '2rem 1.5rem' }}>
      {/* Page Header */}
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h1 className="page-title" style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '0.35rem' }}>
          Explore Specialists
        </h1>
        <p className="page-subtitle" style={{ fontSize: '0.95rem', color: 'var(--slate-500)' }}>
          Search for doctors by username and connect for personalized clinical care
        </p>
      </div>

      {feedback && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.625rem',
          padding: '0.875rem 1.25rem',
          background: feedback.type === 'success' ? 'var(--success-bg)' : 'var(--danger-bg)',
          border: `1px solid ${feedback.type === 'success' ? 'var(--success-border)' : 'var(--danger-border)'}`,
          borderRadius: 'var(--radius-md)',
          color: feedback.type === 'success' ? 'var(--success-text)' : 'var(--danger-text)',
          marginBottom: '1.5rem',
          boxShadow: 'var(--shadow-sm)'
        }}>
          {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{feedback.text}</span>
        </div>
      )}

      {/* Instagram-style Search Bar */}
      <div style={{
        position: 'relative',
        maxWidth: '560px',
        margin: '0 auto 2.5rem',
      }}>
        <div style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          background: 'var(--bg-surface, #ffffff)',
          borderRadius: '9999px',
          border: '1.5px solid var(--slate-300)',
          boxShadow: '0 2px 10px rgba(15, 23, 42, 0.06)',
          transition: 'all 0.2s ease',
          padding: '0.35rem 0.75rem 0.35rem 1.25rem'
        }}>
          <Search size={20} style={{ color: 'var(--slate-400)', marginRight: '0.75rem', flexShrink: 0 }} />
          <input
            id="doctor-username-search"
            type="text"
            placeholder="Search doctor by @username or name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: '0.95rem',
              color: 'var(--slate-800)',
              padding: '0.5rem 0',
              fontWeight: 500
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              style={{
                background: 'var(--slate-100)',
                border: 'none',
                borderRadius: '50%',
                width: '1.75rem',
                height: '1.75rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--slate-500)',
                marginLeft: '0.5rem'
              }}
              title="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Content Area */}
      {initialLoading ? (
        <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
          <div className="loading-spinner" style={{ margin: '0 auto 1rem' }} />
          <p style={{ color: 'var(--slate-500)', fontSize: '0.9rem' }}>Loading specialist directory...</p>
        </div>
      ) : !hasQuery ? (
        /* INITIAL BLANK / PROMPT STATE (Instagram Browse Style) */
        <div style={{
          textAlign: 'center',
          padding: '4.5rem 1.5rem',
          maxWidth: '480px',
          margin: '0 auto',
          background: 'var(--bg-surface, #ffffff)',
          borderRadius: 'var(--radius-lg, 14px)',
          border: '1px solid var(--border-subtle, #e2e8f0)',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{
            width: '4rem',
            height: '4rem',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.15), rgba(99, 102, 241, 0.15))',
            border: '2px dashed var(--primary-500)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.5rem',
            color: 'var(--primary-600)'
          }}>
            <Search size={26} />
          </div>

          <h3 style={{
            fontSize: '1.25rem',
            fontWeight: 800,
            color: 'var(--slate-900)',
            marginBottom: '0.5rem',
            letterSpacing: '-0.01em'
          }}>
            Enter the doctor username
          </h3>

          <p style={{
            fontSize: '0.875rem',
            color: 'var(--slate-500)',
            lineHeight: 1.5,
            marginBottom: '1.5rem'
          }}>
            Type a doctor's username (e.g. <span style={{ fontWeight: 600, color: 'var(--primary-600)' }}>@dr_alpha</span>) or name above to view recommended doctors and request care.
          </p>

          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 1rem',
            background: 'var(--slate-50)',
            borderRadius: '9999px',
            fontSize: '0.8rem',
            color: 'var(--slate-600)',
            fontWeight: 500
          }}>
            <Sparkles size={14} color="var(--primary-600)" />
            Search triggers instant recommendations
          </div>
        </div>
      ) : recommendedDoctors.length === 0 ? (
        /* NO RESULTS STATE */
        <div style={{
          textAlign: 'center',
          padding: '4rem 1.5rem',
          maxWidth: '480px',
          margin: '0 auto',
          background: 'var(--bg-surface, #ffffff)',
          borderRadius: 'var(--radius-lg, 14px)',
          border: '1px solid var(--border-subtle, #e2e8f0)'
        }}>
          <div style={{
            width: '3.5rem',
            height: '3.5rem',
            borderRadius: '50%',
            background: 'var(--slate-100)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.25rem',
            color: 'var(--slate-400)'
          }}>
            <User size={24} />
          </div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--slate-800)', marginBottom: '0.35rem' }}>
            No doctors found matching "@{cleanQuery}"
          </h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--slate-500)' }}>
            Please check the spelling of the username or try searching by specialty or name.
          </p>
        </div>
      ) : (
        /* INSTAGRAM-STYLE SEARCH RESULT ROWS WITH EXPANDABLE DETAILS */
        <div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem',
            padding: '0 0.5rem'
          }}>
            <span style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--slate-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Found {recommendedDoctors.length} {recommendedDoctors.length === 1 ? 'Specialist' : 'Specialists'}
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--slate-400)' }}>
              Click any row to view experience & hourly fees
            </span>
          </div>

          <div style={{
            background: 'var(--bg-surface, #ffffff)',
            borderRadius: 'var(--radius-lg, 14px)',
            border: '1px solid var(--border-subtle, #e2e8f0)',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-sm)'
          }}>
            {recommendedDoctors.map((doc, index) => {
              const rel = existingRelationships[doc.id];
              const pendingReq = existingRequests[doc.id];
              const isExpanded = expandedDoctorId === doc.id;
              const doctorName = doc.profile?.full_name || 'Dr. Specialist';
              const doctorUsername = doc.profile?.username || 'doctor';
              const consultationFeeRupees = Number(doc.consultation_fee) || 0;
              const experienceYears = Number(doc.years_of_experience) || 0;

              const doctorInitials = doctorName
                .split(' ')
                .map((n) => n[0])
                .slice(0, 2)
                .join('')
                .toUpperCase() || 'DR';

              return (
                <div
                  key={doc.id}
                  style={{
                    borderBottom: index < recommendedDoctors.length - 1 ? '1px solid var(--border-subtle, #f1f5f9)' : 'none',
                    transition: 'background-color 0.15s ease'
                  }}
                >
                  {/* Clean Instagram-style row */}
                  <div
                    onClick={() => toggleExpand(doc.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '1rem 1.25rem',
                      cursor: 'pointer',
                      gap: '1rem',
                      background: isExpanded ? 'var(--slate-50, #f8fafc)' : 'transparent',
                      transition: 'background-color 0.15s ease'
                    }}
                  >
                    {/* Left: Avatar + Names */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', flex: 1, minWidth: 0 }}>
                      {/* Avatar with Instagram story gradient ring */}
                      <div style={{
                        width: '3.125rem',
                        height: '3.125rem',
                        borderRadius: '50%',
                        padding: '2px',
                        background: 'linear-gradient(135deg, var(--primary-500), #6366f1)',
                        flexShrink: 0
                      }}>
                        <div style={{
                          width: '100%',
                          height: '100%',
                          borderRadius: '50%',
                          background: 'var(--bg-surface, #ffffff)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          fontSize: '0.95rem',
                          color: 'var(--primary-700)'
                        }}>
                          {doctorInitials}
                        </div>
                      </div>

                      <div style={{ minWidth: 0, overflow: 'hidden' }}>
                        {/* Doctor Full Name */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{
                            fontSize: '0.975rem',
                            fontWeight: 700,
                            color: 'var(--slate-900)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            {doctorName}
                          </span>
                          <ShieldCheck size={15} color="var(--primary-600)" style={{ flexShrink: 0 }} />
                        </div>

                        {/* Doctor Username + Specialty Subtext */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.15rem', flexWrap: 'wrap' }}>
                          <span style={{
                            fontSize: '0.825rem',
                            fontWeight: 600,
                            color: 'var(--primary-600)',
                            fontFamily: 'monospace'
                          }}>
                            @{doctorUsername}
                          </span>
                          <span style={{ color: 'var(--slate-300)', fontSize: '0.75rem' }}>•</span>
                          <span style={{
                            fontSize: '0.8rem',
                            color: 'var(--slate-600)',
                            fontWeight: 500
                          }}>
                            {doc.specialty || 'General Practice'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Connect Action + Expand Caret */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
                      {rel?.status === 'ACTIVE' ? (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          padding: '0.35rem 0.85rem',
                          borderRadius: '9999px',
                          background: 'var(--success-bg)',
                          color: 'var(--success-text)',
                          border: '1px solid var(--success-border)',
                          fontWeight: 700,
                          fontSize: '0.75rem'
                        }}>
                          <CheckCircle2 size={14} /> Connected
                        </span>
                      ) : rel?.status === 'OFFBOARD_REQUESTED' ? (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          padding: '0.35rem 0.85rem',
                          borderRadius: '9999px',
                          background: 'var(--warning-bg)',
                          color: 'var(--warning-text)',
                          border: '1px solid var(--warning-border)',
                          fontWeight: 600,
                          fontSize: '0.75rem'
                        }}>
                          <Clock size={14} /> Offboarding
                        </span>
                      ) : pendingReq ? (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          padding: '0.35rem 0.85rem',
                          borderRadius: '9999px',
                          background: 'var(--slate-100)',
                          color: 'var(--slate-700)',
                          border: '1px solid var(--slate-300)',
                          fontWeight: 600,
                          fontSize: '0.75rem'
                        }}>
                          <Clock size={14} /> Requested
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-primary"
                          style={{
                            borderRadius: '9999px',
                            padding: '0.4rem 1rem',
                            fontSize: '0.8rem',
                            fontWeight: 700
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setConnectingDoctor({
                              id: doc.id,
                              name: doctorName,
                              username: doctorUsername
                            });
                          }}
                        >
                          <UserCheck size={14} /> Connect
                        </button>
                      )}

                      {/* Expand / Collapse Icon */}
                      <button
                        type="button"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--slate-400)',
                          display: 'flex',
                          alignItems: 'center',
                          padding: '0.25rem'
                        }}
                        title={isExpanded ? 'Hide details' : 'Show experience and consultation fee'}
                      >
                        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </button>
                    </div>
                  </div>

                  {/* EXPANDED DETAILS (Experience, Hourly Consultation in Rupees ₹, Bio, etc.) */}
                  {isExpanded && (
                    <div style={{
                      padding: '1.25rem 1.5rem',
                      background: 'var(--slate-50, #f8fafc)',
                      borderTop: '1px dashed var(--border-subtle, #e2e8f0)',
                      animation: 'fadeIn 0.2s ease-in-out'
                    }}>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: '1rem',
                        marginBottom: '1rem'
                      }}>
                        {/* Hour-wise Consultation in Rupees */}
                        <div style={{
                          padding: '0.875rem 1rem',
                          background: 'var(--bg-surface, #ffffff)',
                          borderRadius: 'var(--radius-md, 10px)',
                          border: '1px solid var(--border-subtle, #e2e8f0)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.75rem'
                        }}>
                          <div style={{
                            width: '2.5rem',
                            height: '2.5rem',
                            borderRadius: '50%',
                            background: 'rgba(14, 165, 233, 0.12)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--primary-600)',
                            flexShrink: 0
                          }}>
                            <IndianRupee size={20} />
                          </div>
                          <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                              Hourly Consultation
                            </div>
                            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--slate-900)', marginTop: '0.1rem' }}>
                              ₹{consultationFeeRupees.toLocaleString('en-IN')}{' '}
                              <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--slate-500)' }}>/ hr</span>
                            </div>
                          </div>
                        </div>

                        {/* Experience Details */}
                        <div style={{
                          padding: '0.875rem 1rem',
                          background: 'var(--bg-surface, #ffffff)',
                          borderRadius: 'var(--radius-md, 10px)',
                          border: '1px solid var(--border-subtle, #e2e8f0)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.75rem'
                        }}>
                          <div style={{
                            width: '2.5rem',
                            height: '2.5rem',
                            borderRadius: '50%',
                            background: 'rgba(20, 184, 166, 0.12)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--teal-600)',
                            flexShrink: 0
                          }}>
                            <Briefcase size={20} />
                          </div>
                          <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                              Clinical Experience
                            </div>
                            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--slate-900)', marginTop: '0.1rem' }}>
                              {experienceYears}{' '}
                              <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--slate-500)' }}>
                                {experienceYears === 1 ? 'year experience' : 'years experience'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Specialty & Public ID */}
                        <div style={{
                          padding: '0.875rem 1rem',
                          background: 'var(--bg-surface, #ffffff)',
                          borderRadius: 'var(--radius-md, 10px)',
                          border: '1px solid var(--border-subtle, #e2e8f0)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.75rem'
                        }}>
                          <div style={{
                            width: '2.5rem',
                            height: '2.5rem',
                            borderRadius: '50%',
                            background: 'rgba(99, 102, 241, 0.12)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#6366f1',
                            flexShrink: 0
                          }}>
                            <Stethoscope size={20} />
                          </div>
                          <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                              Specialty & ID
                            </div>
                            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--slate-900)', marginTop: '0.1rem' }}>
                              {doc.specialty || 'General Practice'}
                            </div>
                            {doc.profile?.public_id && (
                              <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--primary-600)', fontWeight: 600 }}>
                                {doc.profile.public_id}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Doctor Bio if available */}
                      {doc.bio ? (
                        <div style={{
                          padding: '0.875rem 1rem',
                          background: 'var(--bg-surface, #ffffff)',
                          borderRadius: 'var(--radius-md, 10px)',
                          border: '1px solid var(--border-subtle, #e2e8f0)',
                          fontSize: '0.85rem',
                          color: 'var(--slate-600)',
                          lineHeight: 1.5
                        }}>
                          <strong style={{ color: 'var(--slate-800)', display: 'block', marginBottom: '0.25rem' }}>
                            About Doctor:
                          </strong>
                          {doc.bio}
                        </div>
                      ) : (
                        <div style={{
                          padding: '0.75rem 1rem',
                          background: 'var(--bg-surface, #ffffff)',
                          borderRadius: 'var(--radius-md, 10px)',
                          border: '1px solid var(--border-subtle, #e2e8f0)',
                          fontSize: '0.825rem',
                          color: 'var(--slate-500)'
                        }}>
                          Specialist verified for clinical consultations. Accepting new patients.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
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
          <div className="card" style={{ width: '100%', maxWidth: '480px', padding: '2rem', borderRadius: 'var(--radius-lg, 14px)' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--slate-900)', marginBottom: '0.35rem' }}>
              Connect with {connectingDoctor.name}
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--primary-600)', fontWeight: 600, marginBottom: '0.75rem' }}>
              @{connectingDoctor.username}
            </p>
            <p style={{ fontSize: '0.875rem', color: 'var(--slate-500)', marginBottom: '1.25rem', lineHeight: 1.4 }}>
              Sending a connection request establishes a confidential doctor-patient healthcare relationship once approved.
            </p>

            <form onSubmit={handleSendRequest}>
              <div className="form-group">
                <label className="form-label" htmlFor="connectMsg">Introductory Note (Optional)</label>
                <textarea
                  id="connectMsg"
                  rows={4}
                  className="form-textarea"
                  placeholder="Introduce yourself or share your reason for seeking care..."
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
