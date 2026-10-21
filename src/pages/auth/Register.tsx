import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Lock, User, Mail, AlertCircle, CheckCircle2 } from 'lucide-react';
import { BrainLogo } from '../../components/common/BrainLogo';
import type { AppRole } from '../../types';

export const Register: React.FC = () => {
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<AppRole>('patient');

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (!/^[a-zA-Z][a-zA-Z0-9_]{2,29}$/.test(username.trim())) {
      setError('Username must start with a letter, be 3-30 characters, and contain only letters, numbers, and underscores.');
      return;
    }

    setLoading(true);
    const { error: signUpError } = await signUp({
      fullName,
      username,
      email,
      password,
      role
    });
    setLoading(false);

    if (signUpError) {
      setError(signUpError.message);
    } else {
      setSuccess('Account created successfully! Redirecting...');
      setTimeout(() => {
        if (role === 'doctor') {
          navigate('/doctor/dashboard');
        } else {
          navigate('/patient/dashboard');
        }
      }, 1500);
    }
  };

  return (
    <div style={{
      minHeight: 'calc(100vh - 70px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2.5rem 1rem'
    }}>
      <div className="card" style={{ width: '100%', maxWidth: '500px', padding: '2.5rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: '3.5rem',
            height: '3.5rem',
            borderRadius: 'var(--radius-lg)',
            background: 'linear-gradient(135deg, var(--primary-600), var(--primary-800))',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            marginBottom: '1rem',
            boxShadow: '0 8px 16px rgba(2, 132, 199, 0.25)'
          }}>
            <BrainLogo size={32} color="#ffffff" />
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--slate-900)' }}>
            Join BlueMind Cares
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--slate-500)', marginTop: '0.25rem' }}>
            Register as a Doctor or Patient
          </p>
        </div>

        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1rem',
            background: 'var(--danger-bg)',
            border: '1px solid var(--danger-border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--danger-text)',
            fontSize: '0.875rem',
            marginBottom: '1.5rem'
          }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1rem',
            background: 'var(--success-bg)',
            border: '1px solid var(--success-border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--success-text)',
            fontSize: '0.875rem',
            marginBottom: '1.5rem'
          }}>
            <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Role Selection */}
          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label className="form-label">I am registering as:</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.25rem' }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.625rem',
                padding: '0.75rem 1rem',
                border: `2px solid ${role === 'patient' ? 'var(--primary-600)' : 'var(--slate-200)'}`,
                borderRadius: 'var(--radius-md)',
                backgroundColor: role === 'patient' ? 'var(--primary-50)' : 'var(--bg-surface, #ffffff)',
                cursor: 'pointer',
                fontWeight: 600,
                color: role === 'patient' ? 'var(--primary-700)' : 'var(--slate-700)'
              }}>
                <input
                  type="radio"
                  name="role"
                  value="patient"
                  checked={role === 'patient'}
                  onChange={() => setRole('patient')}
                  style={{ accentColor: 'var(--primary-600)' }}
                />
                Patient
              </label>

              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.625rem',
                padding: '0.75rem 1rem',
                border: `2px solid ${role === 'doctor' ? 'var(--primary-600)' : 'var(--slate-200)'}`,
                borderRadius: 'var(--radius-md)',
                backgroundColor: role === 'doctor' ? 'var(--primary-50)' : 'var(--bg-surface, #ffffff)',
                cursor: 'pointer',
                fontWeight: 600,
                color: role === 'doctor' ? 'var(--primary-700)' : 'var(--slate-700)'
              }}>
                <input
                  type="radio"
                  name="role"
                  value="doctor"
                  checked={role === 'doctor'}
                  onChange={() => setRole('doctor')}
                  style={{ accentColor: 'var(--primary-600)' }}
                />
                Doctor
              </label>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="fullName">Full Name</label>
            <input
              id="fullName"
              type="text"
              className="form-input"
              placeholder={role === 'doctor' ? 'Dr. Jane Smith' : 'John Doe'}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="username">Username</label>
            <div style={{ position: 'relative' }}>
              <input
                id="username"
                type="text"
                className="form-input"
                placeholder="e.g. janesmith (case-insensitive)"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                style={{ paddingLeft: '2.5rem' }}
              />
              <User
                size={18}
                style={{
                  position: 'absolute',
                  left: '0.875rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--slate-400)'
                }}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="email">Email</label>
            <div style={{ position: 'relative' }}>
              <input
                id="email"
                type="email"
                className="form-input"
                placeholder="jane@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{ paddingLeft: '2.5rem' }}
              />
              <Mail
                size={18}
                style={{
                  position: 'absolute',
                  left: '0.875rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--slate-400)'
                }}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                id="password"
                type="password"
                className="form-input"
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{ paddingLeft: '2.5rem' }}
              />
              <Lock
                size={18}
                style={{
                  position: 'absolute',
                  left: '0.875rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--slate-400)'
                }}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="confirmPassword">Confirm Password</label>
            <div style={{ position: 'relative' }}>
              <input
                id="confirmPassword"
                type="password"
                className="form-input"
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                style={{ paddingLeft: '2.5rem' }}
              />
              <Lock
                size={18}
                style={{
                  position: 'absolute',
                  left: '0.875rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--slate-400)'
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '1rem', padding: '0.75rem' }}
            disabled={loading}
          >
            {loading ? <span className="loading-spinner" /> : 'Create Account'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.75rem', fontSize: '0.875rem', color: 'var(--slate-500)' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--primary-600)', fontWeight: 600 }}>
            Sign In here
          </Link>
        </div>
      </div>
    </div>
  );
};
