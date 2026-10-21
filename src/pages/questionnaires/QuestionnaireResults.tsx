import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import type { QuestionnaireSubmission, QuestionnaireAnswer, QuestionnaireAssignment, Questionnaire } from '../../types';
import { ClipboardCheck, ArrowLeft, ShieldAlert, User, Stethoscope } from 'lucide-react';

export const QuestionnaireResults: React.FC = () => {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const { profile } = useAuth();

  const [assignment, setAssignment] = useState<QuestionnaireAssignment | null>(null);
  const [submission, setSubmission] = useState<QuestionnaireSubmission | null>(null);
  const [answers, setAnswers] = useState<QuestionnaireAnswer[]>([]);
  const [questionnaire, setQuestionnaire] = useState<Questionnaire | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadResults = useCallback(async () => {
    if (!assignmentId) return;
    setLoading(true);
    setError(null);

    try {
      // 1. Fetch assignment
      const { data: asgn, error: asgnError } = await supabase
        .from('questionnaire_assignments')
        .select(`
          *,
          doctor:profiles!questionnaire_assignments_doctor_id_fkey(full_name, public_id),
          patient:profiles!questionnaire_assignments_patient_id_fkey(full_name, public_id),
          questionnaire:questionnaires(*)
        `)
        .eq('id', assignmentId)
        .single();

      if (asgnError || !asgn) {
        throw new Error('Assignment record not found.');
      }

      setAssignment(asgn as unknown as QuestionnaireAssignment);
      setQuestionnaire(asgn.questionnaire as unknown as Questionnaire);

      // 2. Fetch submission
      const { data: sub, error: subError } = await supabase
        .from('questionnaire_submissions')
        .select('*')
        .eq('assignment_id', assignmentId)
        .single();

      if (subError || !sub) {
        throw new Error('No completed submission found for this assignment.');
      }

      setSubmission(sub as unknown as QuestionnaireSubmission);

      // 3. Fetch answers with question and selected option details
      const { data: ansData, error: ansError } = await supabase
        .from('questionnaire_answers')
        .select(`
          *,
          question:questions(id, question_text, section_name, display_order),
          selected_option:answer_options(display_text, numeric_value)
        `)
        .eq('submission_id', sub.id);

      if (ansError) throw ansError;

      // Sort by display order of questions
      const sorted = (ansData || []).sort((a: any, b: any) => {
        return (a.question?.display_order || 0) - (b.question?.display_order || 0);
      });

      setAnswers(sorted as unknown as QuestionnaireAnswer[]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error loading results';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [assignmentId]);

  useEffect(() => {
    loadResults();
  }, [loadResults]);

  if (loading) {
    return (
      <div className="container" style={{ textAlign: 'center', padding: '4rem' }}>
        <div className="loading-spinner" />
        <p style={{ marginTop: '1rem', color: 'var(--slate-500)' }}>Loading submission report...</p>
      </div>
    );
  }

  if (error || !submission) {
    return (
      <div className="container" style={{ maxWidth: '600px', padding: '4rem 1.5rem' }}>
        <div className="card" style={{ textAlign: 'center', border: '1px solid var(--danger-border)' }}>
          <ShieldAlert size={40} color="var(--danger-text)" style={{ margin: '0 auto 1rem auto' }} />
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--danger-text)' }}>Report Unavailable</h2>
          <p style={{ color: 'var(--slate-600)', margin: '0.5rem 0 1.5rem 0' }}>{error}</p>
          <Link to={profile?.role === 'doctor' ? '/doctor/questionnaires' : '/patient/questionnaires'} className="btn btn-secondary">
            <ArrowLeft size={16} /> Return to Questionnaires
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ maxWidth: '880px', padding: '2rem 1.5rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <Link
          to={profile?.role === 'doctor' ? '/doctor/questionnaires' : '/patient/questionnaires'}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', color: 'var(--primary-600)', fontWeight: 600, fontSize: '0.875rem' }}
        >
          <ArrowLeft size={16} /> Back to Questionnaires
        </Link>
      </div>

      {/* Header Summary Card */}
      <div className="card" style={{ marginBottom: '2rem', borderTop: '5px solid var(--primary-600)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <ClipboardCheck size={22} color="var(--primary-600)" />
              <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--slate-900)' }}>
                {questionnaire?.title}
              </h1>
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--slate-500)' }}>
              Completed on {new Date(submission.submitted_at).toLocaleString()}
            </p>
          </div>

          <div style={{
            background: 'var(--primary-50)',
            border: '2px solid var(--primary-200)',
            borderRadius: 'var(--radius-lg)',
            padding: '1rem 1.5rem',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--primary-700)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Total Calculated Score
            </div>
            <div style={{ fontSize: '2.25rem', fontWeight: 900, color: 'var(--primary-800)', lineHeight: '1.1', marginTop: '0.25rem' }}>
              {submission.total_score}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--slate-100)', fontSize: '0.875rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <User size={16} color="var(--slate-400)" />
            <span>Patient: <strong>{assignment?.patient?.full_name}</strong> ({assignment?.patient?.public_id})</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Stethoscope size={16} color="var(--slate-400)" />
            <span>Doctor: <strong>{assignment?.doctor?.full_name}</strong> ({assignment?.doctor?.public_id})</span>
          </div>
        </div>
      </div>

      {/* Clinical Disclaimer */}
      <div className="card" style={{ marginBottom: '2rem', background: '#fffbeb', border: '1px solid #fde68a' }}>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
          <ShieldAlert size={20} color="#b45309" style={{ flexShrink: 0, marginTop: '0.125rem' }} />
          <div style={{ fontSize: '0.85rem', color: '#92400e', lineHeight: '1.4' }}>
            <strong>Clinical Note:</strong> The calculated numeric score reflects the authoritative database summation of patient-reported answers. In accordance with clinical governance, this assessment provides structured clinical data for clinician review and does not generate automated or AI diagnoses.
          </div>
        </div>
      </div>

      {/* Itemized Responses Table */}
      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--slate-200)', background: 'var(--slate-50)' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--slate-800)' }}>
            Itemized Clinical Responses ({answers.length})
          </h3>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--slate-200)', background: 'var(--bg-surface, #ffffff)', color: 'var(--slate-500)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                <th style={{ padding: '0.75rem 1.5rem' }}>Code</th>
                <th style={{ padding: '0.75rem 1rem' }}>Question</th>
                <th style={{ padding: '0.75rem 1rem' }}>Patient Response</th>
                <th style={{ padding: '0.75rem 1.5rem', textAlign: 'right' }}>Score</th>
              </tr>
            </thead>
            <tbody>
              {answers.map((ans, idx) => (
                <tr key={ans.id} style={{ borderBottom: '1px solid var(--slate-100)', background: idx % 2 === 0 ? 'var(--bg-surface, #ffffff)' : 'var(--slate-50)' }}>
                  <td style={{ padding: '0.875rem 1.5rem', fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary-700)' }}>
                    {ans.question_id}
                  </td>
                  <td style={{ padding: '0.875rem 1rem', color: 'var(--slate-800)', fontWeight: 500 }}>
                    {ans.question?.question_text}
                  </td>
                  <td style={{ padding: '0.875rem 1rem', color: 'var(--slate-700)' }}>
                    {ans.selected_option?.display_text}
                  </td>
                  <td style={{ padding: '0.875rem 1.5rem', textAlign: 'right', fontWeight: 800, color: 'var(--slate-900)' }}>
                    +{ans.numeric_value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
