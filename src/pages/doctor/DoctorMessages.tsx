import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { useToast } from '../../components/common/Toast';
import { ChatWindow } from '../../components/common/ChatWindow';
import type { UserProfile, RelationshipStatus } from '../../types';
import { MessageSquare, Users } from 'lucide-react';

interface RelationshipEntry {
  id: string;
  status: RelationshipStatus;
  patient: UserProfile;
  conversationId: string | null;
  unreadCount?: number;
}

export const DoctorMessages: React.FC = () => {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [relationships, setRelationships] = useState<RelationshipEntry[]>([]);
  const [selected, setSelected] = useState<RelationshipEntry | null>(null);
  const [loading, setLoading] = useState(true);

  const loadRelationships = useCallback(async () => {
    if (!profile) return;
    try {
      const { data: rels, error } = await supabase
        .from('doctor_patient_relationships')
        .select(`
          id, status,
          patient:profiles!doctor_patient_relationships_patient_id_fkey(id, full_name, username, public_id, role, created_at)
        `)
        .eq('doctor_id', profile.id)
        .in('status', ['ACTIVE', 'OFFBOARD_REQUESTED'])
        .order('established_at', { ascending: false });

      if (error) throw error;

      // For each relationship, get or check conversation
      const entries: RelationshipEntry[] = await Promise.all(
        (rels || []).map(async (r: any) => {
          const { data: conv } = await supabase
            .from('conversations')
            .select('id')
            .eq('relationship_id', r.id)
            .single();

          let unreadCount = 0;
          if (conv?.id) {
            const { count } = await supabase
              .from('messages')
              .select('*', { count: 'exact', head: true })
              .eq('conversation_id', conv.id)
              .eq('is_read', false)
              .neq('sender_id', profile.id);
            unreadCount = count || 0;
          }

          return {
            id: r.id,
            status: r.status as RelationshipStatus,
            patient: r.patient as UserProfile,
            conversationId: conv?.id || null,
            unreadCount,
          };
        })
      );

      setRelationships(entries);
    } catch (err: any) {
      showToast(err.message || 'Failed to load conversations', 'error');
    } finally {
      setLoading(false);
    }
  }, [profile, showToast]);

  useEffect(() => {
    loadRelationships();
  }, [loadRelationships]);

  const handleSelectConversation = async (entry: RelationshipEntry) => {
    let convId = entry.conversationId;

    // If no conversation yet and relationship is ACTIVE, create one
    if (!convId && entry.status === 'ACTIVE') {
      try {
        const { data, error } = await supabase.rpc('get_or_create_conversation', {
          p_relationship_id: entry.id,
        });
        if (error) throw error;
        convId = data as string;
        setRelationships(prev => prev.map(r => r.id === entry.id ? { ...r, conversationId: convId } : r));
      } catch (err: any) {
        showToast(err.message || 'Failed to open conversation', 'error');
        return;
      }
    }

    if (!convId) {
      showToast('Cannot open conversation for an inactive relationship', 'warning');
      return;
    }

    setSelected({ ...entry, conversationId: convId, unreadCount: 0 });
    // Reset unread count
    setRelationships(prev => prev.map(r => r.id === entry.id ? { ...r, unreadCount: 0 } : r));
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Messages</h1>
          <p className="page-subtitle">Communicate securely with your patients</p>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: selected ? '280px 1fr' : '1fr',
        gap: '1rem',
        height: 'calc(100vh - 200px)',
        minHeight: '500px',
      }}>
        {/* Conversation list */}
        <div style={{
          background: 'var(--bg-surface, #ffffff)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--slate-200)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--slate-100)' }}>
            <h2 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--slate-700)' }}>
              Patient Conversations
            </h2>
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                <div className="loading-spinner" />
              </div>
            ) : relationships.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--slate-400)' }}>
                <Users size={28} style={{ margin: '0 auto 0.5rem' }} />
                <p style={{ fontSize: '0.875rem' }}>No active patient relationships</p>
              </div>
            ) : (
              relationships.map(entry => (
                <button
                  key={entry.id}
                  onClick={() => handleSelectConversation(entry)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '0.875rem 1.25rem',
                    background: selected?.id === entry.id ? 'var(--primary-50)' : 'transparent',
                    border: 'none', borderBottom: '1px solid var(--slate-100)',
                    cursor: 'pointer', textAlign: 'left',
                    transition: 'background var(--transition-fast)',
                    borderLeft: selected?.id === entry.id ? '3px solid var(--primary-600)' : '3px solid transparent',
                  }}
                >
                  <div style={{
                    width: '2.25rem', height: '2.25rem', borderRadius: 'var(--radius-full)',
                    background: 'linear-gradient(135deg, var(--teal-500), var(--teal-700))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontWeight: 800, fontSize: '0.875rem', flexShrink: 0,
                    position: 'relative',
                  }}>
                    {(entry.patient.full_name || entry.patient.username).charAt(0).toUpperCase()}
                    {(entry.unreadCount || 0) > 0 && (
                      <span style={{
                        position: 'absolute', top: '-4px', right: '-4px',
                        background: 'var(--danger-text)', color: '#fff',
                        borderRadius: 'var(--radius-full)', fontSize: '0.6rem',
                        padding: '1px 5px', fontWeight: 800, minWidth: '16px', textAlign: 'center',
                      }}>
                        {entry.unreadCount}
                      </span>
                    )}
                  </div>
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--slate-900)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {entry.patient.full_name || entry.patient.username}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--slate-400)' }}>
                      {entry.status === 'ACTIVE' ? 'Active' : 'Offboarding'}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Chat window */}
        {selected && selected.conversationId && (
          <ChatWindow
            conversationId={selected.conversationId}
            otherParticipant={selected.patient}
            isActive={selected.status === 'ACTIVE'}
          />
        )}

        {!selected && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            background: 'var(--bg-surface, #ffffff)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--slate-200)',
            padding: '3rem', color: 'var(--slate-400)', textAlign: 'center',
          }}>
            <MessageSquare size={40} style={{ marginBottom: '1rem', color: 'var(--slate-300)' }} />
            <p style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--slate-600)' }}>Select a conversation</p>
            <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>Choose a patient from the left to start messaging</p>
          </div>
        )}
      </div>
    </div>
  );
};
