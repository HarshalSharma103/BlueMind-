import React, { useEffect, useRef } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
  onCancel,
  loading = false,
}) => {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen && cancelRef.current) {
      cancelRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onCancel();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const btnClass =
    variant === 'danger' ? 'btn btn-danger' :
    variant === 'warning' ? 'btn' :
    'btn btn-primary';

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(15, 23, 42, 0.55)',
        backdropFilter: 'blur(4px)',
        padding: '1rem',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
    >
      <div
        style={{
          background: 'var(--bg-surface, #ffffff)',
          border: '1px solid var(--slate-200)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-xl)',
          padding: '2rem',
          maxWidth: '420px',
          width: '100%',
          animation: 'fadeInScale 150ms ease-out',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '1.5rem' }}>
          {variant !== 'default' && (
            <div style={{
              width: '2.5rem', height: '2.5rem', borderRadius: 'var(--radius-lg)',
              background: variant === 'danger' ? 'var(--danger-bg)' : 'var(--warning-bg)',
              color: variant === 'danger' ? 'var(--danger-text)' : 'var(--warning-text)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <AlertTriangle size={20} />
            </div>
          )}
          <div style={{ flex: 1 }}>
            <h3 id="dialog-title" style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--slate-900)', marginBottom: '0.5rem' }}>
              {title}
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--slate-600)', lineHeight: 1.6 }}>
              {message}
            </p>
          </div>
          <button
            onClick={onCancel}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--slate-400)', padding: '0.25rem' }}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button
            ref={cancelRef}
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={loading}
          >
            {cancelLabel}
          </button>
          <button
            className={btnClass}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
