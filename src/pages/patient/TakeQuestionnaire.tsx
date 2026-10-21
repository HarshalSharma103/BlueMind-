import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import type { QuestionnaireAssignment, Question, AnswerOption, Questionnaire } from '../../types';
import { ClipboardList, AlertCircle, ArrowLeft, Send } from 'lucide-react';
import { Link } from 'react-router-dom';

export const TakeQuestionnaire: React.FC = () => {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [assignment, setAssignment] = useState<QuestionnaireAssignment | null>(null);
  const [questionnaire, setQuestionnaire] = useState<Questionnaire | null>(null);
  const [questions, setQuestions] = useState<(Question & { options: AnswerOption[] })[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({}); // question_id -> selected_option_id
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadQuestionnaireData = useCallback(async () => {
    if (!assignmentId || !user) return;
    setLoading(true);
    setError(null);

    try {
      // 1. Fetch assignment
      const { data: asgn, error: asgnError } = await supabase
        .from('questionnaire_assignments')
        .select(`
          *,
          doctor:profiles!questionnaire_assignments_doctor_id_fkey(full_name),
          questionnaire:questionnaires(*)
        `)
        .eq('id', assignmentId)
        .single();

      if (asgnError || !asgn) {
        throw new Error('Questionnaire assignment not found.');
      }

      if (asgn.patient_id !== user.id) {
        throw new Error('Unauthorized: You are not the assigned patient for this questionnaire.');
      }

      if (asgn.status === 'COMPLETED') {
        navigate(`/questionnaires/results/${assignmentId}`, { replace: true });
        return;
      }

      setAssignment(asgn as unknown as QuestionnaireAssignment);
      setQuestionnaire(asgn.questionnaire as unknown as Questionnaire);

      // 2. Fetch questions and answer options for the assigned version
      const { data: qData, error: qError } = await supabase
        .from('questions')
        .select(`
          *,
          options:answer_options(*)
        `)
        .eq('version_id', asgn.version_id)
        .order('display_order', { ascending: true });

      if (qError) throw qError;

      // Sort answer options by display_order
      const sortedQuestions = (qData || []).map((q) => ({
        ...q,
        options: (q.options || []).sort((a: AnswerOption, b: AnswerOption) => a.display_order - b.display_order)
      }));

      setQuestions(sortedQuestions as (Question & { options: AnswerOption[] })[]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error loading questionnaire';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [assignmentId, user, navigate]);

  useEffect(() => {
    loadQuestionnaireData();
  }, [loadQuestionnaireData]);

  const handleSelectOption = (questionId: string, optionId: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: optionId
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignment) return;

    // Check that all questions have been answered
    const unanswered = questions.filter((q) => !answers[q.id]);
    if (unanswered.length > 0) {
      setError(`Please answer all questions before submitting (${unanswered.length} unanswered remaining).`);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Prepare payload
      const answerPayload = Object.entries(answers).map(([question_id, selected_option_id]) => ({
        question_id,
        selected_option_id
      }));

      // Call atomic database RPC function
      const { error: submitError } = await supabase.rpc('submit_questionnaire', {
        p_assignment_id: assignment.id,
        p_answers: answerPayload
      });

      if (submitError) throw submitError;

      // Navigate to results
      navigate(`/questionnaires/results/${assignment.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error submitting responses';
      setError(msg);
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="container" style={{ textAlign: 'center', padding: '4rem' }}>
        <div className="loading-spinner" />
        <p style={{ marginTop: '1rem', color: 'var(--slate-500)' }}>Loading clinical instrument...</p>
      </div>
    );
  }

  if (error && !assignment) {
    return (
      <div className="container" style={{ maxWidth: '600px', padding: '4rem 1.5rem' }}>
        <div className="card" style={{ textAlign: 'center', border: '1px solid var(--danger-border)' }}>
          <AlertCircle size={40} color="var(--danger-text)" style={{ margin: '0 auto 1rem auto' }} />
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--danger-text)' }}>Error</h2>
          <p style={{ color: 'var(--slate-600)', margin: '0.5rem 0 1.5rem 0' }}>{error}</p>
          <Link to="/patient/questionnaires" className="btn btn-secondary">
            <ArrowLeft size={16} /> Back to Questionnaires
          </Link>
        </div>
      </div>
    );
  }

  // Group questions by section_name
  const sections: { sectionName: string; questions: (Question & { options: AnswerOption[] })[] }[] = [];
  questions.forEach((q) => {
    const secName = q.section_name || 'Assessment Questions';
    let existing = sections.find((s) => s.sectionName === secName);
    if (!existing) {
      existing = { sectionName: secName, questions: [] };
      sections.push(existing);
    }
    existing.questions.push(q);
  });

  const answeredCount = Object.keys(answers).length;
  const totalCount = questions.length;
  const progressPercent = totalCount > 0 ? Math.round((answeredCount / totalCount) * 100) : 0;

  return (
    <div className="container" style={{ maxWidth: '840px', padding: '2rem 1.5rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <Link to="/patient/questionnaires" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', color: 'var(--primary-600)', fontWeight: 600, fontSize: '0.875rem' }}>
          <ArrowLeft size={16} /> Back to Questionnaires
        </Link>
      </div>

      {/* Questionnaire Header Card */}
      <div className="card" style={{ marginBottom: '2rem', background: 'linear-gradient(to right, var(--bg-surface), var(--primary-50))', borderLeft: '5px solid var(--primary-600)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
          <ClipboardList size={22} color="var(--primary-600)" />
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--slate-900)' }}>
            {questionnaire?.title}
          </h1>
        </div>
        <p style={{ fontSize: '0.9rem', color: 'var(--slate-600)', marginTop: '0.25rem' }}>
          {questionnaire?.description}
        </p>
        <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--slate-500)' }}>
          <span>Assigned by: <strong>{assignment?.doctor?.full_name}</strong></span>
          <span>Target Group: <strong>{questionnaire?.target_demographic}</strong></span>
        </div>

        {/* Progress Bar */}
        <div style={{ marginTop: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600, color: 'var(--slate-700)', marginBottom: '0.375rem' }}>
            <span>Progress: {answeredCount} of {totalCount} Answered</span>
            <span>{progressPercent}% Complete</span>
          </div>
          <div style={{ height: '8px', background: 'var(--slate-200)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progressPercent}%`, background: 'var(--primary-600)', transition: 'width 200ms ease' }} />
          </div>
        </div>
      </div>

      {error && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.875rem 1rem',
          background: 'var(--danger-bg)',
          border: '1px solid var(--danger-border)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--danger-text)',
          marginBottom: '1.5rem'
        }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Form with Section Groups */}
      <form onSubmit={handleSubmit}>
        {sections.map((section, secIdx) => (
          <div key={secIdx} style={{ marginBottom: '2.5rem' }}>
            <h2 style={{
              fontSize: '1.2rem',
              fontWeight: 800,
              color: 'var(--slate-800)',
              marginBottom: '1rem',
              paddingBottom: '0.5rem',
              borderBottom: '2px solid var(--slate-200)'
            }}>
              {section.sectionName}
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {section.questions.map((q, qIdx) => {
                const isSelected = !!answers[q.id];

                return (
                  <div
                    key={q.id}
                    className="card"
                    style={{
                      borderLeft: isSelected ? '4px solid var(--teal-500)' : '4px solid var(--slate-300)',
                      transition: 'border-color var(--transition-fast)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.75rem' }}>
                      <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--slate-900)' }}>
                        <span style={{ color: 'var(--slate-400)', marginRight: '0.5rem' }}>{qIdx + 1}.</span>
                        {q.question_text}
                      </div>
                      <span className="badge" style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: 'var(--slate-500)', background: 'var(--slate-100)' }}>
                        {q.id}
                      </span>
                    </div>

                    {/* Radio Answer Options */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {q.options.map((opt) => {
                        const checked = answers[q.id] === opt.id;

                        return (
                          <label
                            key={opt.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.75rem',
                              padding: '0.625rem 0.875rem',
                              borderRadius: 'var(--radius-md)',
                              border: `1px solid ${checked ? 'var(--primary-600)' : 'var(--slate-200)'}`,
                              background: checked ? 'var(--primary-50)' : 'var(--bg-surface, #ffffff)',
                              cursor: 'pointer',
                              fontSize: '0.875rem',
                              color: checked ? 'var(--primary-900)' : 'var(--slate-700)',
                              fontWeight: checked ? 600 : 400,
                              transition: 'all var(--transition-fast)'
                            }}
                          >
                            <input
                              type="radio"
                              name={`question_${q.id}`}
                              value={opt.id}
                              checked={checked}
                              onChange={() => handleSelectOption(q.id, opt.id)}
                              style={{ accentColor: 'var(--primary-600)' }}
                            />
                            <span>{opt.display_text}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
          <Link to="/patient/questionnaires" className="btn btn-secondary">
            Cancel
          </Link>
          <button
            type="submit"
            className="btn btn-primary"
            style={{ padding: '0.75rem 1.5rem', fontSize: '0.95rem' }}
            disabled={submitting || answeredCount < totalCount}
          >
            {submitting ? <span className="loading-spinner" /> : <><Send size={18} /> Submit Assessment</>}
          </button>
        </div>
      </form>
    </div>
  );
};
