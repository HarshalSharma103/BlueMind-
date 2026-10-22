import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import type { DoctorProfile, PatientProfile } from '../../types';
import { User, CheckCircle2, AlertCircle, Save } from 'lucide-react';

export const Profile: React.FC = () => {
  const { profile, user, refreshProfile, loading: authLoading } = useAuth();

  const effectiveRole = profile?.role || (user?.user_metadata?.role === 'doctor' ? 'doctor' : 'patient');
  const effectiveUsername = profile?.username || user?.user_metadata?.username || user?.email?.split('@')[0] || 'User';
  const effectivePublicId = profile?.public_id || user?.user_metadata?.public_id || (effectiveRole === 'doctor' ? `DR-${(user?.id || '000000').slice(0, 6).toUpperCase()}` : `PT-${(user?.id || '000000').slice(0, 6).toUpperCase()}`);

  const [fullName, setFullName] = useState(profile?.full_name || user?.user_metadata?.full_name || '');
  const [doctorData, setDoctorData] = useState<Partial<DoctorProfile>>({});
  const [patientData, setPatientData] = useState<Partial<PatientProfile>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (authLoading) return;

    if (profile) {
      setFullName(profile.full_name || '');
    } else if (user) {
      setFullName(user.user_metadata?.full_name || user.email?.split('@')[0] || '');
    }

    const loadRoleProfile = async () => {
      const targetId = profile?.id || user?.id;
      if (!targetId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        if (effectiveRole === 'doctor') {
          const { data } = await supabase
            .from('doctor_profiles')
            .select('*')
            .eq('id', targetId)
            .maybeSingle();
          if (data) setDoctorData(data);
        } else if (effectiveRole === 'patient') {
          const { data } = await supabase
            .from('patient_profiles')
            .select('*')
            .eq('id', targetId)
            .maybeSingle();
          if (data) setPatientData(data);
        }
      } catch (err) {
        console.warn('Error reading role-specific profile:', err);
      } finally {
        setLoading(false);
      }
    };

    loadRoleProfile();
  }, [profile, user, authLoading, effectiveRole]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetId = profile?.id || user?.id;
    if (!targetId) return;

    setSaving(true);
    setMessage(null);

    try {
      // 1. Upsert base profile so missing rows are automatically created
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: targetId,
          username: effectiveUsername,
          role: effectiveRole,
          full_name: fullName.trim(),
          public_id: effectivePublicId
        }, { onConflict: 'id' });

      if (profileError) throw profileError;

      // 2. Upsert role specific profile
      if (effectiveRole === 'doctor') {
        const { error: docError } = await supabase
          .from('doctor_profiles')
          .upsert({
            id: targetId,
            specialty: doctorData.specialty || 'General Practice',
            bio: doctorData.bio || '',
            consultation_fee: Number(doctorData.consultation_fee) || 0,
            years_of_experience: Number(doctorData.years_of_experience) || 0,
            is_accepting_patients: doctorData.is_accepting_patients ?? true
          }, { onConflict: 'id' });
        if (docError) throw docError;
      } else if (effectiveRole === 'patient') {
        const { error: patError } = await supabase
          .from('patient_profiles')
          .upsert({
            id: targetId,
            date_of_birth: patientData.date_of_birth || null,
            gender: patientData.gender || null,
            blood_group: patientData.blood_group || null,
            emergency_contact_name: patientData.emergency_contact_name || '',
            emergency_contact_phone: patientData.emergency_contact_phone || '',
            medical_allergies: patientData.medical_allergies || ''
          }, { onConflict: 'id' });
        if (patError) throw patError;
      }

      await refreshProfile();
      setMessage({ type: 'success', text: 'Profile updated and synchronized successfully!' });
    } catch (err: unknown) {
      const errMessage = err instanceof Error ? err.message : 'Error updating profile';
      setMessage({ type: 'error', text: errMessage });
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || (loading && !profile && !user)) {
    return (
      <div className="container" style={{ textAlign: 'center', padding: '4rem 1rem' }}>
        <div className="loading-spinner" style={{ margin: '0 auto 1rem' }} />
        <p style={{ color: 'var(--slate-500)', fontSize: '0.875rem' }}>Loading profile information...</p>
      </div>
    );
  }

  return (
    <div className="container" style={{ maxWidth: '800px', padding: '2rem 1.5rem' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">My Profile</h1>
          <p className="page-subtitle">Manage your personal and clinical details</p>
        </div>
      </div>

      {message && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.875rem 1rem',
          background: message.type === 'success' ? 'var(--success-bg)' : 'var(--danger-bg)',
          border: `1px solid ${message.type === 'success' ? 'var(--success-border)' : 'var(--danger-border)'}`,
          borderRadius: 'var(--radius-md)',
          color: message.type === 'success' ? 'var(--success-text)' : 'var(--danger-text)',
          marginBottom: '1.5rem'
        }}>
          {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{message.text}</span>
        </div>
      )}

      {!profile && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '1rem',
          background: 'var(--warning-bg, #fffbeb)',
          border: '1px solid var(--warning-border, #fde68a)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--warning-text, #92400e)',
          marginBottom: '1.5rem'
        }}>
          <AlertCircle size={20} style={{ flexShrink: 0 }} />
          <div style={{ fontSize: '0.875rem' }}>
            <strong>Profile Setup in Progress:</strong> Your profile record has not yet been initialized in the database. Save your personal details below to establish your profile.
          </div>
        </div>
      )}

      {/* Account Details */}
      <div style={{ marginBottom: '1.75rem' }}>
        <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--slate-900)', marginBottom: '0.5rem' }}>
          {effectiveRole === 'doctor' ? 'Professional' : 'Personal Information'}
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.9rem' }}>
          <div>
            <span style={{ fontWeight: 600, color: 'var(--slate-500)', marginRight: '0.5rem' }}>
              {effectiveRole === 'doctor' ? 'Doctor ID:' : 'Patient ID:'}
            </span>
            <span style={{ fontWeight: 700, fontFamily: 'monospace', color: 'var(--primary-600)' }}>
              {effectivePublicId}
            </span>
          </div>
          <div>
            <span style={{ fontWeight: 600, color: 'var(--slate-500)', marginRight: '0.5rem' }}>Username:</span>
            <span style={{ fontWeight: 600, color: 'var(--slate-800)' }}>@{effectiveUsername}</span>
          </div>
          <div>
            <span style={{ fontWeight: 600, color: 'var(--slate-500)', marginRight: '0.5rem' }}>Email:</span>
            <span style={{ color: 'var(--slate-700)' }}>{user?.email}</span>
          </div>
        </div>
      </div>

      {/* Editable Profile Information */}
      <form onSubmit={handleSave} className="card">
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--slate-800)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <User size={18} color="var(--primary-600)" />
          {effectiveRole === 'doctor' ? 'Practice & Clinical Details' : 'Profile Details'}
        </h3>

        <div className="form-group">
          <label className="form-label" htmlFor="fullName">Full Display Name</label>
          <input
            id="fullName"
            type="text"
            className="form-input"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
        </div>

        {effectiveRole === 'doctor' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="specialty">Medical Specialty</label>
                <input
                  id="specialty"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Cardiology, Psychiatry"
                  value={doctorData.specialty || ''}
                  onChange={(e) => setDoctorData({ ...doctorData, specialty: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="experience">Years of Experience</label>
                <input
                  id="experience"
                  type="number"
                  min="0"
                  className="form-input"
                  value={doctorData.years_of_experience ?? 0}
                  onChange={(e) => setDoctorData({ ...doctorData, years_of_experience: Number(e.target.value) })}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="fee">Consultation Fee ($)</label>
                <input
                  id="fee"
                  type="number"
                  min="0"
                  step="0.01"
                  className="form-input"
                  value={doctorData.consultation_fee ?? 0}
                  onChange={(e) => setDoctorData({ ...doctorData, consultation_fee: Number(e.target.value) })}
                />
              </div>

              <div className="form-group" style={{ justifyContent: 'center' }}>
                <label className="form-label" style={{ marginBottom: '0.5rem' }}>Patient Acceptance Status</label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }}>
                  <input
                    type="checkbox"
                    checked={doctorData.is_accepting_patients ?? true}
                    onChange={(e) => setDoctorData({ ...doctorData, is_accepting_patients: e.target.checked })}
                    style={{ width: '1.125rem', height: '1.125rem', accentColor: 'var(--primary-600)' }}
                  />
                  Currently Accepting New Patients
                </label>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="bio">Professional Bio & Credentials</label>
              <textarea
                id="bio"
                rows={4}
                className="form-textarea"
                placeholder="Share your background, clinical interests, and approach to care..."
                value={doctorData.bio || ''}
                onChange={(e) => setDoctorData({ ...doctorData, bio: e.target.value })}
              />
            </div>
          </>
        )}

        {effectiveRole === 'patient' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="dob">Date of Birth</label>
                <input
                  id="dob"
                  type="date"
                  className="form-input"
                  value={patientData.date_of_birth || ''}
                  onChange={(e) => setPatientData({ ...patientData, date_of_birth: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="gender">Gender</label>
                <select
                  id="gender"
                  className="form-select"
                  value={patientData.gender || ''}
                  onChange={(e) => setPatientData({ ...patientData, gender: e.target.value })}
                >
                  <option value="">Select gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="bloodGroup">Blood Group</label>
                <select
                  id="bloodGroup"
                  className="form-select"
                  value={patientData.blood_group || ''}
                  onChange={(e) => setPatientData({ ...patientData, blood_group: e.target.value })}
                >
                  <option value="">Select blood group</option>
                  {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (
                    <option key={bg} value={bg}>{bg}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="contactPhone">Emergency Contact Phone</label>
                <input
                  id="contactPhone"
                  type="tel"
                  className="form-input"
                  placeholder="+1 (555) 000-0000"
                  value={patientData.emergency_contact_phone || ''}
                  onChange={(e) => setPatientData({ ...patientData, emergency_contact_phone: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="contactName">Emergency Contact Name</label>
              <input
                id="contactName"
                type="text"
                className="form-input"
                placeholder="Full name of emergency contact"
                value={patientData.emergency_contact_name || ''}
                onChange={(e) => setPatientData({ ...patientData, emergency_contact_name: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="allergies">Known Medical Allergies</label>
              <textarea
                id="allergies"
                rows={3}
                className="form-textarea"
                placeholder="List any drug, food, or environmental allergies..."
                value={patientData.medical_allergies || ''}
                onChange={(e) => setPatientData({ ...patientData, medical_allergies: e.target.value })}
              />
            </div>
          </>
        )}

        <button
          type="submit"
          className="btn btn-primary"
          style={{ marginTop: '1rem' }}
          disabled={saving}
        >
          {saving ? <span className="loading-spinner" /> : <><Save size={16} /> Save Changes</>}
        </button>
      </form>
    </div>
  );
};
