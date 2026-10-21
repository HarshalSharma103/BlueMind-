import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

interface ThemeToggleProps {
  className?: string;
  style?: React.CSSProperties;
  showLabel?: boolean;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  className = '',
  style = {},
  showLabel = false,
}) => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`btn btn-secondary ${className}`}
      title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
        padding: showLabel ? '0.5rem 0.875rem' : '0.5rem',
        borderRadius: 'var(--radius-md)',
        transition: 'all var(--transition-fast)',
        cursor: 'pointer',
        ...style,
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: isDark ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 300ms cubic-bezier(0.4, 0, 0.2, 1)',
          color: isDark ? '#fbbf24' : '#0284c7',
        }}
      >
        {isDark ? <Sun size={18} /> : <Moon size={18} />}
      </span>
      {showLabel && (
        <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>
          {isDark ? 'Light Mode' : 'Dark Mode'}
        </span>
      )}
    </button>
  );
};
