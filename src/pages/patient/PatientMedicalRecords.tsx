import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { useToast } from '../../components/common/Toast';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import type { MedicalRecord } from '../../types';
import { FileText, Eye, FileImage, File, Search, Filter, AlertCircle, RefreshCw } from 'lucide-react';

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return <FileImage size={20} />;
  if (mimeType === 'application/pdf') return <FileText size={20} color="var(--danger-text)" />;
  return <File size={20} />;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const PatientMedicalRecords: React.FC = () => {
  const { profile, user, loading: authLoading } = useAuth();
  const { showToast } = useToast();

  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDoctor, setFilterDoctor] = useState('all');
  const [downloadConfirm, setDownloadConfirm] = useState<MedicalRecord | null>(null);

  useEffect(() => {
    if (authLoading) return;
    const patientId = profile?.id || user?.id;
    if (!patientId) {
      setLoading(false);
      setError('Patient profile not found. Please verify your profile in Settings.');
      return;
    }
    loadRecords();
  }, [profile, user, authLoading]);

  const loadRecords = async () => {
    const patientId = profile?.id || user?.id;
    if (!patientId) {
      setLoading(false);
      setError('Patient profile not initialized. Please configure your profile first.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchErr } = await supabase
        .from('medical_records')
        .select('*, doctor:profiles!medical_records_doctor_id_fkey(id, full_name, username, public_id)')
        .eq('patient_id', patientId)
        .order('uploaded_at', { ascending: false });

      if (fetchErr) throw fetchErr;
      setRecords((data || []) as MedicalRecord[]);
    } catch (err: any) {
      const errMsg = err?.message || 'Failed to load medical records';
      setError(errMsg);
      showToast(errMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (record: MedicalRecord) => {
    try {
      const { data, error } = await supabase.storage
        .from('medical-records')
        .createSignedUrl(record.file_path, 120);

      if (error) throw error;
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      showToast('Failed to open record. Please try again.', 'error');
    }
    setDownloadConfirm(null);
  };

  // Unique doctors from records
  const uniqueDoctors = Array.from(
    new Map(records.map(r => [(r.doctor as any)?.id, r.doctor])).entries()
  ).filter(([id]) => id).map(([, doc]) => doc as any);

  const filteredRecords = records.filter(r => {
    if (filterDoctor !== 'all' && (r.doctor as any)?.id !== filterDoctor) return false;
    if (searchTerm && !r.title.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">My Medical Records</h1>
          <p className="page-subtitle">View and download clinical records uploaded by your doctors</p>
        </div>
      </div>

      {/* Live Error Banner */}
      {error && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          padding: '1rem 1.25rem',
          background: 'var(--danger-bg, #fef2f2)',
          border: '1px solid var(--danger-border, #fecaca)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--danger-text, #991b1b)',
          marginBottom: '1.5rem',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <AlertCircle size={22} style={{ flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Unable to Load Medical Records</div>
              <div style={{ fontSize: '0.85rem', marginTop: '0.2rem', color: 'var(--slate-700)' }}>{error}</div>
            </div>
          </div>
          <button
            className="btn btn-secondary"
            onClick={loadRecords}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', padding: '0.45rem 0.85rem' }}
          >
            <RefreshCw size={14} /> Try Again
          </button>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.875rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--slate-400)' }} />
          <input
            className="form-input"
            type="text"
            placeholder="Search records..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '2.25rem' }}
          />
        </div>
        {uniqueDoctors.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Filter size={16} color="var(--slate-400)" />
            <select
              className="form-select"
              value={filterDoctor}
              onChange={e => setFilterDoctor(e.target.value)}
              style={{ minWidth: '160px' }}
            >
              <option value="all">All Doctors</option>
              {uniqueDoctors.map((doc: any) => (
                <option key={doc.id} value={doc.id}>
                  Dr. {doc.full_name || doc.username}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Records */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3.5rem 1rem' }}>
          <div className="loading-spinner" style={{ width: '2rem', height: '2rem', marginBottom: '1rem' }} />
          <p style={{ color: 'var(--slate-500)', fontSize: '0.875rem' }}>Retrieving clinical medical records...</p>
        </div>
      ) : error && records.length === 0 ? null : filteredRecords.length === 0 ? (
        <div className="empty-state">
          <FileText size={40} style={{ margin: '0 auto 0.75rem', color: 'var(--slate-300)' }} />
          <h3>No Records Yet</h3>
          <p>
            {records.length === 0
              ? 'Your doctors will upload records here once you have an active connection.'
              : 'No records match your search.'}
          </p>
          {records.length === 0 && (
            <div style={{ marginTop: '1.25rem' }}>
              <Link to="/patient/find-doctors" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                Find Doctors
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {filteredRecords.map(record => (
            <div key={record.id} className="card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                <div style={{
                  width: '2.5rem', height: '2.5rem', borderRadius: 'var(--radius-md)',
                  background: 'var(--primary-50)', color: 'var(--primary-600)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  {getFileIcon(record.mime_type)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <div>
                      <h3 style={{ fontWeight: 700, color: 'var(--slate-900)', fontSize: '0.95rem', marginBottom: '0.25rem' }}>
                        {record.title}
                      </h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--slate-500)' }}>
                          Dr. {(record.doctor as any)?.full_name || (record.doctor as any)?.username}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--slate-400)', fontFamily: 'monospace' }}>
                          {record.file_name}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--slate-400)' }}>
                          {formatBytes(record.file_size_bytes)}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--slate-400)' }}>
                          {new Date(record.uploaded_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      {record.description && (
                        <p style={{ fontSize: '0.8rem', color: 'var(--slate-600)', marginTop: '0.375rem' }}>
                          {record.description}
                        </p>
                      )}
                    </div>
                    <button
                      className="btn btn-secondary"
                      onClick={() => setDownloadConfirm(record)}
                      style={{ flexShrink: 0 }}
                    >
                      <Eye size={15} /> View
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
          <p style={{ fontSize: '0.8rem', color: 'var(--slate-400)', textAlign: 'center', paddingTop: '0.5rem' }}>
            Showing {filteredRecords.length} of {records.length} records
          </p>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!downloadConfirm}
        title="View Medical Record"
        message={`Open "${downloadConfirm?.title}"? A secure link will be generated (expires in 2 minutes).`}
        confirmLabel="Open Record"
        cancelLabel="Cancel"
        onConfirm={() => downloadConfirm && handleDownload(downloadConfirm)}
        onCancel={() => setDownloadConfirm(null)}
      />
    </div>
  );
};
