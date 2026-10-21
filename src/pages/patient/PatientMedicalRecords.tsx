import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { useToast } from '../../components/common/Toast';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import type { MedicalRecord } from '../../types';
import { FileText, Eye, FileImage, File, Search, Filter } from 'lucide-react';

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
  const { profile } = useAuth();
  const { showToast } = useToast();

  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDoctor, setFilterDoctor] = useState('all');
  const [downloadConfirm, setDownloadConfirm] = useState<MedicalRecord | null>(null);

  useEffect(() => {
    if (!profile) return;
    loadRecords();
  }, [profile]);

  const loadRecords = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('medical_records')
        .select('*, doctor:profiles!medical_records_doctor_id_fkey(id, full_name, username, public_id)')
        .eq('patient_id', profile!.id)
        .order('uploaded_at', { ascending: false });

      if (error) throw error;
      setRecords((data || []) as MedicalRecord[]);
    } catch (err: any) {
      showToast(err.message || 'Failed to load records', 'error');
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
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
          <div className="loading-spinner" style={{ width: '2rem', height: '2rem' }} />
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="empty-state">
          <FileText size={36} style={{ margin: '0 auto 0.75rem', color: 'var(--slate-300)' }} />
          <h3>No Records Yet</h3>
          <p>
            {records.length === 0
              ? 'Your doctors will upload records here once you have an active connection.'
              : 'No records match your search.'}
          </p>
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
