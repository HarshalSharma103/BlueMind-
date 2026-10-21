import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { useToast } from '../../components/common/Toast';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import type { MedicalRecord, UserProfile } from '../../types';
import {
  FileText, Upload, Eye, FileImage, File, Search,
  AlertCircle, Filter
} from 'lucide-react';

const ALLOWED_MIME_TYPES: Record<string, string> = {
  'text/plain': '.txt',
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'image/jpeg': '.jpg/.jpeg',
};

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25MB

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

interface ActivePatient {
  relationship_id: string;
  patient: UserProfile;
}

export const DoctorMedicalRecords: React.FC = () => {
  const { profile } = useAuth();
  const { showToast } = useToast();

  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [activePatients, setActivePatients] = useState<ActivePatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  // Filters
  const [filterPatient, setFilterPatient] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Upload form
  const [showUpload, setShowUpload] = useState(false);
  const [uploadPatientId, setUploadPatientId] = useState('');
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Confirm dialog
  const [downloadConfirm, setDownloadConfirm] = useState<MedicalRecord | null>(null);

  useEffect(() => {
    if (!profile) return;
    loadData();
  }, [profile]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load active patients
      const { data: rels } = await supabase
        .from('doctor_patient_relationships')
        .select('id, patient_id, profiles!doctor_patient_relationships_patient_id_fkey(*)')
        .eq('doctor_id', profile!.id)
        .eq('status', 'ACTIVE');

      const patients: ActivePatient[] = (rels || []).map((r: any) => ({
        relationship_id: r.id,
        patient: r.profiles as UserProfile,
      }));
      setActivePatients(patients);

      // Load all records
      const { data: recs, error } = await supabase
        .from('medical_records')
        .select('*, patient:profiles!medical_records_patient_id_fkey(id, full_name, username, public_id)')
        .eq('doctor_id', profile!.id)
        .order('uploaded_at', { ascending: false });

      if (error) throw error;
      setRecords((recs || []) as MedicalRecord[]);
    } catch (err: any) {
      showToast(err.message || 'Failed to load records', 'error');
    } finally {
      setLoading(false);
    }
  };

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_MIME_TYPES[file.type]) {
      return `Unsupported file type. Allowed: TXT, PDF, DOC, DOCX, JPG/JPEG`;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return `File too large. Maximum size is 25MB.`;
    }
    // Extension check
    const ext = file.name.split('.').pop()?.toLowerCase();
    const validExts = ['txt', 'pdf', 'doc', 'docx', 'jpg', 'jpeg'];
    if (!ext || !validExts.includes(ext)) {
      return 'Invalid file extension.';
    }
    return null;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError('');
    const file = e.target.files?.[0] || null;
    if (file) {
      const err = validateFile(file);
      if (err) {
        setFileError(err);
        setSelectedFile(null);
        return;
      }
    }
    setSelectedFile(file);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !uploadPatientId || !uploadTitle.trim()) return;

    const patient = activePatients.find(p => p.relationship_id === uploadPatientId);
    if (!patient) return;

    const validErr = validateFile(selectedFile);
    if (validErr) {
      setFileError(validErr);
      return;
    }

    setUploading(true);
    try {
      const recordId = crypto.randomUUID();
      const ext = selectedFile.name.split('.').pop()?.toLowerCase();
      const filePath = `${patient.patient.id}/${recordId}/${selectedFile.name}`;

      // Upload to storage
      const { error: storageError } = await supabase.storage
        .from('medical-records')
        .upload(filePath, selectedFile, {
          contentType: selectedFile.type,
          upsert: false,
        });

      if (storageError) throw storageError;

      // Insert metadata record
      const { error: dbError } = await supabase
        .from('medical_records')
        .insert({
          id: recordId,
          relationship_id: uploadPatientId,
          doctor_id: profile!.id,
          patient_id: patient.patient.id,
          title: uploadTitle.trim(),
          description: uploadDescription.trim() || null,
          file_path: filePath,
          file_name: selectedFile.name,
          file_type: ext || '',
          file_size_bytes: selectedFile.size,
          mime_type: selectedFile.type,
        });

      if (dbError) {
        // Rollback storage
        await supabase.storage.from('medical-records').remove([filePath]);
        throw dbError;
      }

      showToast('Medical record uploaded successfully', 'success');
      setShowUpload(false);
      resetUploadForm();
      await loadData();
    } catch (err: any) {
      showToast(err.message || 'Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  };

  const resetUploadForm = () => {
    setUploadPatientId('');
    setUploadTitle('');
    setUploadDescription('');
    setSelectedFile(null);
    setFileError('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleDownload = async (record: MedicalRecord) => {
    try {
      const { data, error } = await supabase.storage
        .from('medical-records')
        .createSignedUrl(record.file_path, 120); // 2-minute signed URL

      if (error) throw error;
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      showToast('Failed to generate download link. Please try again.', 'error');
    }
    setDownloadConfirm(null);
  };

  const filteredRecords = records.filter(r => {
    if (filterPatient !== 'all' && r.patient_id !== filterPatient) return false;
    if (searchTerm && !r.title.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !(r.patient as any)?.full_name?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Medical Records</h1>
          <p className="page-subtitle">Upload and manage clinical records for your patients</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowUpload(true)} disabled={activePatients.length === 0}>
          <Upload size={16} />
          Upload Record
        </button>
      </div>

      {activePatients.length === 0 && !loading && (
        <div className="empty-state" style={{ marginBottom: '1.5rem' }}>
          <AlertCircle size={32} style={{ margin: '0 auto 0.75rem', color: 'var(--slate-400)' }} />
          <h3>No Active Patients</h3>
          <p>Accept a patient connection request to upload medical records.</p>
        </div>
      )}

      {/* Upload Form Modal */}
      {showUpload && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(15, 23, 42, 0.55)', backdropFilter: 'blur(4px)',
            padding: '1rem',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) { setShowUpload(false); resetUploadForm(); }}}
        >
          <div style={{
            background: 'var(--bg-surface, #ffffff)', borderRadius: 'var(--radius-xl)',
            border: '1px solid var(--slate-200)',
            boxShadow: 'var(--shadow-xl)', padding: '2rem',
            maxWidth: '540px', width: '100%',
          }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1.5rem', color: 'var(--slate-900)' }}>
              Upload Medical Record
            </h2>
            <form onSubmit={handleUpload}>
              <div className="form-group">
                <label className="form-label">Patient *</label>
                <select
                  className="form-select"
                  value={uploadPatientId}
                  onChange={e => setUploadPatientId(e.target.value)}
                  required
                >
                  <option value="">Select active patient...</option>
                  {activePatients.map(p => (
                    <option key={p.relationship_id} value={p.relationship_id}>
                      {p.patient.full_name || p.patient.username} (@{p.patient.username})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Record Title *</label>
                <input
                  className="form-input"
                  type="text"
                  value={uploadTitle}
                  onChange={e => setUploadTitle(e.target.value)}
                  placeholder="e.g., Blood Test Results - Oct 2026"
                  required
                  maxLength={200}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Description (optional)</label>
                <textarea
                  className="form-textarea"
                  value={uploadDescription}
                  onChange={e => setUploadDescription(e.target.value)}
                  placeholder="Brief description of this record..."
                  rows={3}
                  maxLength={2000}
                  style={{ resize: 'vertical' }}
                />
              </div>

              <div className="form-group">
                <label className="form-label">File *</label>
                <div style={{
                  border: `2px dashed ${fileError ? 'var(--danger-border)' : 'var(--slate-300)'}`,
                  borderRadius: 'var(--radius-md)', padding: '1.5rem',
                  textAlign: 'center', cursor: 'pointer',
                  background: 'var(--slate-50)',
                  transition: 'all var(--transition-fast)',
                }}
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload size={28} style={{ margin: '0 auto 0.5rem', color: 'var(--slate-400)' }} />
                  {selectedFile ? (
                    <div>
                      <p style={{ fontWeight: 700, color: 'var(--slate-800)', fontSize: '0.875rem' }}>{selectedFile.name}</p>
                      <p style={{ fontSize: '0.8rem', color: 'var(--slate-500)' }}>{formatBytes(selectedFile.size)}</p>
                    </div>
                  ) : (
                    <div>
                      <p style={{ fontWeight: 600, color: 'var(--slate-600)', fontSize: '0.875rem' }}>Click to select file</p>
                      <p style={{ fontSize: '0.75rem', color: 'var(--slate-400)', marginTop: '0.25rem' }}>
                        TXT, PDF, DOC, DOCX, JPG/JPEG • Max 25MB
                      </p>
                    </div>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".txt,.pdf,.doc,.docx,.jpg,.jpeg"
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                    aria-label="Select medical record file"
                  />
                </div>
                {fileError && (
                  <p style={{ fontSize: '0.8rem', color: 'var(--danger-text)', marginTop: '0.375rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <AlertCircle size={14} /> {fileError}
                  </p>
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => { setShowUpload(false); resetUploadForm(); }}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={uploading || !selectedFile || !uploadPatientId || !uploadTitle.trim()}
                >
                  {uploading ? 'Uploading...' : 'Upload Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.875rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--slate-400)' }} />
          <input
            className="form-input"
            type="text"
            placeholder="Search by title or patient..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '2.25rem' }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Filter size={16} color="var(--slate-400)" />
          <select
            className="form-select"
            value={filterPatient}
            onChange={e => setFilterPatient(e.target.value)}
            style={{ minWidth: '160px' }}
          >
            <option value="all">All Patients</option>
            {activePatients.map(p => (
              <option key={p.patient.id} value={p.patient.id}>
                {p.patient.full_name || p.patient.username}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Records List */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
          <div className="loading-spinner" style={{ width: '2rem', height: '2rem' }} />
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="empty-state">
          <FileText size={36} style={{ margin: '0 auto 0.75rem', color: 'var(--slate-300)' }} />
          <h3>No Records Found</h3>
          <p>{records.length === 0 ? 'Upload the first medical record for a patient.' : 'No records match your filters.'}</p>
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
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <div>
                      <h3 style={{ fontWeight: 700, color: 'var(--slate-900)', fontSize: '0.95rem', marginBottom: '0.25rem' }}>
                        {record.title}
                      </h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--slate-500)' }}>
                          Patient: <strong>{(record.patient as any)?.full_name || (record.patient as any)?.username || 'Unknown'}</strong>
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
                      <Eye size={15} /> View / Download
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Download confirmation */}
      <ConfirmDialog
        isOpen={!!downloadConfirm}
        title="Open Medical Record"
        message={`You are about to open "${downloadConfirm?.title}". A secure temporary link will be generated. This link expires in 2 minutes.`}
        confirmLabel="Open Record"
        cancelLabel="Cancel"
        onConfirm={() => downloadConfirm && handleDownload(downloadConfirm)}
        onCancel={() => setDownloadConfirm(null)}
      />
    </div>
  );
};
