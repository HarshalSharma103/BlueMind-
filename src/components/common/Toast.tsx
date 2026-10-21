import React, { useEffect, useState, createContext, useContext, useCallback } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

type ToastVariant = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastContextType {
  showToast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const ToastItem: React.FC<{ toast: Toast; onDismiss: (id: string) => void }> = ({ toast, onDismiss }) => {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 4500);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const icons: Record<ToastVariant, React.ReactNode> = {
    success: <CheckCircle size={18} />,
    error: <XCircle size={18} />,
    warning: <AlertTriangle size={18} />,
    info: <Info size={18} />,
  };

  const colors: Record<ToastVariant, { bg: string; color: string; border: string }> = {
    success: { bg: 'var(--success-bg)', color: 'var(--success-text)', border: 'var(--success-border)' },
    error: { bg: 'var(--danger-bg)', color: 'var(--danger-text)', border: 'var(--danger-border)' },
    warning: { bg: 'var(--warning-bg)', color: 'var(--warning-text)', border: 'var(--warning-border)' },
    info: { bg: 'var(--primary-50)', color: 'var(--primary-700)', border: 'var(--primary-200)' },
  };

  const style = colors[toast.variant];

  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.875rem 1.25rem',
        background: style.bg,
        color: style.color,
        border: `1px solid ${style.border}`,
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-lg)',
        fontSize: '0.875rem',
        fontWeight: 600,
        maxWidth: '400px',
        animation: 'slideInRight 200ms ease-out',
        minWidth: '280px',
      }}
    >
      {icons[toast.variant]}
      <span style={{ flex: 1 }}>{toast.message}</span>
      <button
        onClick={() => onDismiss(toast.id)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', opacity: 0.7, display: 'flex' }}
        aria-label="Dismiss"
      >
        <X size={16} />
      </button>
    </div>
  );
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, variant: ToastVariant = 'info') => {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev.slice(-4), { id, message, variant }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        aria-live="polite"
        style={{
          position: 'fixed',
          bottom: '1.5rem',
          right: '1.5rem',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.625rem',
          pointerEvents: 'none',
        }}
      >
        {toasts.map(toast => (
          <div key={toast.id} style={{ pointerEvents: 'auto' }}>
            <ToastItem toast={toast} onDismiss={dismissToast} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};
