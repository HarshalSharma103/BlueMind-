import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import type { DoctorProfile, PatientProfile } from '../../types';
import { User, Shield, CheckCircle2, AlertCircle, Save } from 'lucide-react';

export const Profile: React.FC = () => {
  const { profile, user, refreshProfile } = useAuth();

  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [doctorData, setDoctorData] = useState<Partial<DoctorProfile>>({});
  const [patientData, setPatientData] = useState<Partial<PatientProfile>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name);

    const loadRoleProfile = async () => {
      setLoading(true);
      if (profile.role === 'doctor') {
        const { data } = await supabase
          .from('doctor_profiles')
          .select('*')
          .eq('id', profile.id)
          .single();
        if (data) setDoctorData(data);
      } else if (profile.role === 'patient') {
        const { data } = await supabase
          .from('patient_profiles')
          .select('*')
          .eq('id', profile.id)
          .single();
        if (data) setPatientData(data);
      }
      setLoading(false);
    };

    loadRoleProfile();
  }, [profile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    setMessage(null);

    try {
      // 1. Update base profile full_name
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ full_name: fullName.trim() })
        .eq('id', profile.id);

      if (profileError) throw profileError;

      // 2. Update role specific profile
      if (profile.role === 'doctor') {
        const { error: docError } = await supabase
          .from('doctor_profiles')
          .update({
            specialty: doctorData.specialty || 'General Practice',
            bio: doctorData.bio || '',
            consultation_fee: Number(doctorData.consultation_fee) || 0,
            years_of_experience: Number(doctorData.years_of_experience) || 0,
            is_accepting_patients: doctorData.is_accepting_patients ?? true
          })
          .eq('id', profile.id);
        if (docError) throw docError;
      } else if (profile.role === 'patient') {
        const { error: patError } = await supabase
          .from('patient_profiles')
          .update({
            date_of_birth: patientData.date_of_birth || null,
            gender: patientData.gender || null,
            blood_group: patientData.blood_group || null,
            emergency_contact_name: patientData.emergency_contact_name || '',
            emergency_contact_phone: patientData.emergency_contact_phone || '',
            medical_allergies: patientData.medical_allergies || ''
          })
          .eq('id', profile.id);
        if (patError) throw patError;
      }

      await refreshProfile();
      setMessage({ type: 'success', text: 'Profile updated successfully!' });
    } catch (err: unknown) {
      const errMessage = err instanceof Error ? err.message : 'Error updating profile';
      setMessage({ type: 'error', text: errMessage });
    } finally {
      setSaving(false);
    }
  };

  if (!profile || loading) {
    return (
      <div className="container" style={{ textAlign: 'center', padding: '4rem 1rem' }}>
        <div className="loading-spinner" />
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

      {/* Identity Card (Immutable identifiers) */}
      <div className="card" style={{ marginBottom: '1.5rem', background: '#f8fafc' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--slate-800)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Shield size={18} color="var(--primary-600)" />
          Authoritative Identity & Credentials
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--slate-500)', textTransform: 'uppercase' }}>
              Public ID
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--primary-700)', fontFamily: 'monospace', marginTop: '0.25rem' }}>
              {profile.public_id}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--slate-500)', textTransform: 'uppercase' }}>
              Username
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--slate-800)', marginTop: '0.25rem' }}>
              @{profile.username}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--slate-500)', textTransform: 'uppercase' }}>
              Account Role
            </div>
            <div style={{ marginTop: '0.25rem' }}>
              <span className={`badge ${profile.role === 'doctor' ? 'badge-approved' : 'badge-pending'}`}>
                {profile.role}
              </span>
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--slate-500)', textTransform: 'uppercase' }}>
              Email
            </div>
            <div style={{ fontSize: '0.875rem', color: 'var(--slate-700)', marginTop: '0.25rem' }}>
              {user?.email}
            </div>
          </div>
        </div>
        <p style={{ fontSize: '0.75rem', color: 'var(--slate-400)', marginTop: '1rem' }}>
          Public ID, role, and username are cryptographically and database-enforced and cannot be modified.
        </p>
      </div>

      {/* Editable Profile Information */}
      <form onSubmit={handleSave} className="card">
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--slate-800)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <User size={18} color="var(--primary-600)" />
          Personal & Professional Information
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

        {profile.role === 'doctor' && (
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

        {profile.role === 'patient' && (
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
