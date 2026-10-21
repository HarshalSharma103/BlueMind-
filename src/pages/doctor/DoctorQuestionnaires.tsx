import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import type { QuestionnaireAssignment, Questionnaire, QuestionnaireVersion, DoctorPatientRelationship } from '../../types';
import { Plus, CheckCircle2, AlertCircle, ExternalLink, Eye } from 'lucide-react';
import { Link } from 'react-router-dom';

export const DoctorQuestionnaires: React.FC = () => {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<QuestionnaireAssignment[]>([]);
  const [activeRelationships, setActiveRelationships] = useState<DoctorPatientRelationship[]>([]);
  const [availableQuestionnaires, setAvailableQuestionnaires] = useState<(Questionnaire & { versions: QuestionnaireVersion[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Assignment Modal
  const [showModal, setShowModal] = useState(false);
  const [selectedRelId, setSelectedRelId] = useState('');
  const [assignmentType, setAssignmentType] = useState<'INBUILT' | 'EXTERNAL_GOOGLE_FORM'>('INBUILT');
  const [selectedQuestionnaireId, setSelectedQuestionnaireId] = useState('');
  const [externalTitle, setExternalTitle] = useState('');
  const [externalDesc, setExternalDesc] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      // 1. Fetch assignments made by doctor
      const { data: assignData, error: assignError } = await supabase
        .from('questionnaire_assignments')
        .select(`
          *,
          patient:profiles!questionnaire_assignments_patient_id_fkey(full_name, username, public_id),
          questionnaire:questionnaires(title, description)
        `)
        .eq('doctor_id', user.id)
        .order('assigned_at', { ascending: false });

      if (assignError) throw assignError;
      setAssignments((assignData || []) as unknown as QuestionnaireAssignment[]);

      // 2. Fetch ACTIVE relationships
      const { data: relData } = await supabase
        .from('doctor_patient_relationships')
        .select(`
          *,
          patient:profiles!doctor_patient_relationships_patient_id_fkey(full_name, public_id)
        `)
        .eq('doctor_id', user.id)
        .eq('status', 'ACTIVE');

      setActiveRelationships((relData || []) as unknown as DoctorPatientRelationship[]);

      // 3. Fetch Questionnaires Catalog & Versions
      const { data: qData } = await supabase
        .from('questionnaires')
        .select(`
          *,
          versions:questionnaire_versions(*)
        `)
        .eq('is_active', true);

      setAvailableQuestionnaires((qData || []) as unknown as (Questionnaire & { versions: QuestionnaireVersion[] })[]);
    } catch (err: unknown) {
      console.error('Error fetching questionnaire data:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedRelId) return;

    const rel = activeRelationships.find((r) => r.id === selectedRelId);
    if (!rel) return;

    setSubmitting(true);
    setFeedback(null);

    try {
      if (assignmentType === 'INBUILT') {
        const q = availableQuestionnaires.find((item) => item.id === selectedQuestionnaireId);
        const version = q?.versions.find((v) => v.is_published) || q?.versions[0];

        if (!q || !version) {
          throw new Error('Please select a valid inbuilt questionnaire.');
        }

        const { error } = await supabase
          .from('questionnaire_assignments')
          .insert({
            relationship_id: rel.id,
            doctor_id: user.id,
            patient_id: rel.patient_id,
            assignment_type: 'INBUILT',
            questionnaire_id: q.id,
            version_id: version.id,
            due_date: dueDate ? new Date(dueDate).toISOString() : null,
            status: 'PENDING'
          });

        if (error) throw error;
      } else {
        if (!externalUrl.trim() || !externalTitle.trim()) {
          throw new Error('Please provide both title and external Google Form URL.');
        }

        const { error } = await supabase
          .from('questionnaire_assignments')
          .insert({
            relationship_id: rel.id,
            doctor_id: user.id,
            patient_id: rel.patient_id,
            assignment_type: 'EXTERNAL_GOOGLE_FORM',
            external_title: externalTitle.trim(),
            external_description: externalDesc.trim(),
            external_form_url: externalUrl.trim(),
            due_date: dueDate ? new Date(dueDate).toISOString() : null,
            status: 'PENDING'
          });

        if (error) throw error;
      }

      setFeedback({ type: 'success', text: 'Questionnaire assigned to patient successfully!' });
      setShowModal(false);
      setSelectedRelId('');
      setSelectedQuestionnaireId('');
      setExternalTitle('');
      setExternalDesc('');
      setExternalUrl('');
      setDueDate('');
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error assigning questionnaire';
      setFeedback({ type: 'error', text: msg });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container" style={{ padding: '2rem 1.5rem' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Clinical Questionnaire Management</h1>
          <p className="page-subtitle">Assign standardized instruments (Adult PHQ-D, GAD-7, Pediatric) or external clinical forms</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setShowModal(true)}
          disabled={activeRelationships.length === 0}
        >
          <Plus size={16} /> Assign Questionnaire
        </button>
      </div>

      {activeRelationships.length === 0 && !loading && (
        <div className="card" style={{ marginBottom: '1.5rem', background: 'var(--warning-bg)', border: '1px solid var(--warning-border)', color: 'var(--warning-text)' }}>
          <p style={{ fontSize: '0.875rem' }}>
            You need at least one actively connected patient to assign questionnaires.
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

      {/* Assignments History */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <div className="loading-spinner" />
        </div>
      ) : assignments.length === 0 ? (
        <div className="empty-state">
          <h3>No questionnaires assigned yet</h3>
          <p>Assign clinical instruments to evaluate physical symptoms, anxiety, or depression.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {assignments.map((asgn) => {
            const isCompleted = asgn.status === 'COMPLETED';

            return (
              <div key={asgn.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--slate-900)' }}>
                      {asgn.assignment_type === 'INBUILT' ? asgn.questionnaire?.title : asgn.external_title}
                    </h3>
                    <span className={`badge ${isCompleted ? 'badge-completed' : 'badge-pending'}`}>
                      {asgn.status}
                    </span>
                    <span className="badge" style={{ background: 'var(--slate-100)', color: 'var(--slate-700)', fontSize: '0.65rem' }}>
                      {asgn.assignment_type === 'INBUILT' ? 'Database Instrument' : 'Google Form'}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.875rem', color: 'var(--slate-600)', margin: '0.25rem 0' }}>
                    Patient: <strong>{asgn.patient?.full_name}</strong> ({asgn.patient?.public_id})
                  </div>

                  <div style={{ display: 'flex', gap: '1rem', color: 'var(--slate-500)', fontSize: '0.8rem' }}>
                    <span>Assigned: {new Date(asgn.assigned_at).toLocaleDateString()}</span>
                    {asgn.due_date && <span>Due: {new Date(asgn.due_date).toLocaleDateString()}</span>}
                    {asgn.completed_at && <span>Completed: {new Date(asgn.completed_at).toLocaleDateString()}</span>}
                  </div>
                </div>

                <div>
                  {isCompleted && asgn.assignment_type === 'INBUILT' && (
                    <Link to={`/questionnaires/results/${asgn.id}`} className="btn btn-primary" style={{ padding: '0.5rem 0.875rem' }}>
                      <Eye size={16} /> View Scores & Responses
                    </Link>
                  )}
                  {asgn.assignment_type === 'EXTERNAL_GOOGLE_FORM' && asgn.external_form_url && (
                    <a
                      href={asgn.external_form_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary"
                      style={{ padding: '0.5rem 0.875rem' }}
                    >
                      <ExternalLink size={16} /> Open External Form
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Assignment Modal */}
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
          <div className="card" style={{ width: '100%', maxWidth: '520px', padding: '2rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--slate-900)', marginBottom: '0.5rem' }}>
              Assign Clinical Assessment
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--slate-500)', marginBottom: '1.25rem' }}>
              Assign a database-driven validated instrument or an external Google Form.
            </p>

            <form onSubmit={handleAssign}>
              <div className="form-group">
                <label className="form-label" htmlFor="patientSelect">Select Patient</label>
                <select
                  id="patientSelect"
                  className="form-select"
                  value={selectedRelId}
                  onChange={(e) => setSelectedRelId(e.target.value)}
                  required
                >
                  <option value="">-- Choose Connected Patient --</option>
                  {activeRelationships.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.patient?.full_name} ({r.patient?.public_id})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Instrument Type</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.625rem 0.875rem',
                    border: `2px solid ${assignmentType === 'INBUILT' ? 'var(--primary-600)' : 'var(--slate-200)'}`,
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: assignmentType === 'INBUILT' ? 'var(--primary-50)' : 'var(--bg-surface, #ffffff)',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: 600
                  }}>
                    <input
                      type="radio"
                      name="asgnType"
                      checked={assignmentType === 'INBUILT'}
                      onChange={() => setAssignmentType('INBUILT')}
                    />
                    Database Inbuilt
                  </label>

                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.625rem 0.875rem',
                    border: `2px solid ${assignmentType === 'EXTERNAL_GOOGLE_FORM' ? 'var(--primary-600)' : 'var(--slate-200)'}`,
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: assignmentType === 'EXTERNAL_GOOGLE_FORM' ? 'var(--primary-50)' : 'var(--bg-surface, #ffffff)',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: 600
                  }}>
                    <input
                      type="radio"
                      name="asgnType"
                      checked={assignmentType === 'EXTERNAL_GOOGLE_FORM'}
                      onChange={() => setAssignmentType('EXTERNAL_GOOGLE_FORM')}
                    />
                    External Google Form
                  </label>
                </div>
              </div>

              {assignmentType === 'INBUILT' ? (
                <div className="form-group">
                  <label className="form-label" htmlFor="inbuiltSelect">Select Questionnaire</label>
                  <select
                    id="inbuiltSelect"
                    className="form-select"
                    value={selectedQuestionnaireId}
                    onChange={(e) => setSelectedQuestionnaireId(e.target.value)}
                    required
                  >
                    <option value="">-- Choose Standardized Instrument --</option>
                    {availableQuestionnaires.map((q) => (
                      <option key={q.id} value={q.id}>
                        {q.title} ({q.target_demographic})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <>
                  <div className="form-group">
                    <label className="form-label" htmlFor="extTitle">Form Title</label>
                    <input
                      id="extTitle"
                      type="text"
                      className="form-input"
                      placeholder="e.g. Sleep & Lifestyle Survey"
                      value={externalTitle}
                      onChange={(e) => setExternalTitle(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="extUrl">Google Form URL</label>
                    <input
                      id="extUrl"
                      type="url"
                      className="form-input"
                      placeholder="https://docs.google.com/forms/d/e/.../viewform"
                      value={externalUrl}
                      onChange={(e) => setExternalUrl(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="extDesc">Description / Instructions</label>
                    <textarea
                      id="extDesc"
                      rows={2}
                      className="form-textarea"
                      placeholder="Instructions for the patient..."
                      value={externalDesc}
                      onChange={(e) => setExternalDesc(e.target.value)}
                    />
                  </div>
                </>
              )}

              <div className="form-group">
                <label className="form-label" htmlFor="dueDt">Due Date (Optional)</label>
                <input
                  id="dueDt"
                  type="date"
                  className="form-input"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
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
                  {submitting ? <span className="loading-spinner" /> : 'Assign Instrument'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
