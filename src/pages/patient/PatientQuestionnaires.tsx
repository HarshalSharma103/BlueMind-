import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import type { QuestionnaireAssignment } from '../../types';
import { ClipboardList, Play, CheckCircle2, AlertCircle, ExternalLink, Eye, Check } from 'lucide-react';
import { Link } from 'react-router-dom';

export const PatientQuestionnaires: React.FC = () => {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<QuestionnaireAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadAssignments = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('questionnaire_assignments')
        .select(`
          *,
          doctor:profiles!questionnaire_assignments_doctor_id_fkey(full_name, username, public_id),
          questionnaire:questionnaires(title, description, target_demographic)
        `)
        .eq('patient_id', user.id)
        .order('assigned_at', { ascending: false });

      if (error) throw error;
      setAssignments((data || []) as unknown as QuestionnaireAssignment[]);
    } catch (err: unknown) {
      console.error('Error fetching patient questionnaires:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  const handleMarkExternalCompleted = async (assignmentId: string) => {
    try {
      const { error } = await supabase
        .from('questionnaire_assignments')
        .update({
          status: 'COMPLETED',
          completed_at: new Date().toISOString()
        })
        .eq('id', assignmentId);

      if (error) throw error;
      setFeedback({ type: 'success', text: 'External questionnaire marked as completed.' });
      await loadAssignments();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error updating status';
      setFeedback({ type: 'error', text: msg });
    }
  };

  const pending = assignments.filter((a) => a.status === 'PENDING');
  const completed = assignments.filter((a) => a.status === 'COMPLETED');

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Health Questionnaires</h1>
          <p className="page-subtitle">Complete clinical assessments assigned by your doctor</p>
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

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <div className="loading-spinner" />
        </div>
      ) : assignments.length === 0 ? (
        <div className="empty-state">
          <h3>No assigned questionnaires</h3>
          <p>When your doctor assigns clinical assessments, they will appear here.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* Pending Section */}
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--slate-800)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ClipboardList size={20} color="var(--primary-600)" />
              Action Required: Pending Questionnaires ({pending.length})
            </h2>

            {pending.length === 0 ? (
              <div className="card" style={{ padding: '1.25rem', color: 'var(--slate-500)', fontSize: '0.9rem' }}>
                All assigned questionnaires have been completed.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.25rem' }}>
                {pending.map((asgn) => (
                  <div key={asgn.id} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderLeft: '4px solid var(--primary-600)' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                        <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--slate-900)' }}>
                          {asgn.assignment_type === 'INBUILT' ? asgn.questionnaire?.title : asgn.external_title}
                        </h3>
                        <span className="badge badge-pending">Pending</span>
                      </div>

                      <div style={{ fontSize: '0.85rem', color: 'var(--slate-600)', marginBottom: '0.5rem' }}>
                        Assigned by <strong>{asgn.doctor?.full_name}</strong>
                      </div>

                      <p style={{ fontSize: '0.85rem', color: 'var(--slate-500)', marginBottom: '1rem', lineHeight: '1.4' }}>
                        {asgn.assignment_type === 'INBUILT' ? asgn.questionnaire?.description : asgn.external_description || 'External clinical questionnaire.'}
                      </p>

                      <div style={{ fontSize: '0.8rem', color: 'var(--slate-400)' }}>
                        Assigned: {new Date(asgn.assigned_at).toLocaleDateString()}
                        {asgn.due_date && ` • Due: ${new Date(asgn.due_date).toLocaleDateString()}`}
                      </div>
                    </div>

                    <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--slate-100)' }}>
                      {asgn.assignment_type === 'INBUILT' ? (
                        <Link to={`/patient/questionnaires/take/${asgn.id}`} className="btn btn-primary" style={{ width: '100%' }}>
                          <Play size={16} /> Start Assessment
                        </Link>
                      ) : (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <a
                            href={asgn.external_form_url || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-secondary"
                            style={{ flex: 1 }}
                          >
                            <ExternalLink size={16} /> Open Form
                          </a>
                          <button
                            className="btn btn-success"
                            style={{ flex: 1 }}
                            onClick={() => handleMarkExternalCompleted(asgn.id)}
                          >
                            <Check size={16} /> Completed
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Completed Section */}
          {completed.length > 0 && (
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--slate-800)', marginBottom: '1rem' }}>
                Completed Assessments ({completed.length})
              </h2>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.25rem' }}>
                {completed.map((asgn) => (
                  <div key={asgn.id} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--slate-900)' }}>
                          {asgn.assignment_type === 'INBUILT' ? asgn.questionnaire?.title : asgn.external_title}
                        </h3>
                        <span className="badge badge-completed">Completed</span>
                      </div>

                      <div style={{ fontSize: '0.85rem', color: 'var(--slate-600)', marginBottom: '0.5rem' }}>
                        Evaluated with <strong>{asgn.doctor?.full_name}</strong>
                      </div>

                      <div style={{ fontSize: '0.8rem', color: 'var(--slate-400)' }}>
                        Completed on: {asgn.completed_at ? new Date(asgn.completed_at).toLocaleDateString() : 'Recorded'}
                      </div>
                    </div>

                    <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--slate-100)' }}>
                      {asgn.assignment_type === 'INBUILT' ? (
                        <Link to={`/questionnaires/results/${asgn.id}`} className="btn btn-secondary" style={{ width: '100%' }}>
                          <Eye size={16} /> View Responses & Score
                        </Link>
                      ) : (
                        <span style={{ fontSize: '0.8rem', color: 'var(--slate-500)', fontStyle: 'italic' }}>
                          External form submission recorded.
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
