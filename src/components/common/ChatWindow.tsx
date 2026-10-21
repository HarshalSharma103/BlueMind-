import React, { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { useToast } from './Toast';
import type { Message, UserProfile } from '../../types';
import { Send, Loader } from 'lucide-react';

interface ChatWindowProps {
  conversationId: string;
  otherParticipant: UserProfile;
  isActive: boolean; // relationship is ACTIVE
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  conversationId,
  otherParticipant,
  isActive,
}) => {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const subscriptionRef = useRef<any>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const fetchMessages = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*, sender:profiles!messages_sender_id_fkey(id, full_name, username, public_id, role)')
        .eq('conversation_id', conversationId)
        .order('sent_at', { ascending: true })
        .limit(200);

      if (error) throw error;
      setMessages((data || []) as Message[]);

      // Mark unread messages from other participant as read
      const unreadIds = (data || [])
        .filter((m: any) => m.sender_id !== profile?.id && !m.is_read)
        .map((m: any) => m.id);

      if (unreadIds.length > 0) {
        await supabase
          .from('messages')
          .update({ is_read: true })
          .in('id', unreadIds);
      }
    } catch (err: any) {
      showToast('Failed to load messages', 'error');
    } finally {
      setLoading(false);
    }
  }, [conversationId, profile?.id, showToast]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Realtime subscription
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`chat:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          // Fetch full message with sender details
          const { data } = await supabase
            .from('messages')
            .select('*, sender:profiles!messages_sender_id_fkey(id, full_name, username, public_id, role)')
            .eq('id', payload.new.id)
            .single();

          if (data) {
            setMessages(prev => {
              // Avoid duplicates
              if (prev.some(m => m.id === data.id)) return prev;
              return [...prev, data as Message];
            });

            // Mark as read if from other participant
            if (data.sender_id !== profile?.id) {
              await supabase
                .from('messages')
                .update({ is_read: true })
                .eq('id', data.id);
            }
          }
        }
      )
      .subscribe();

    subscriptionRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, profile?.id]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = newMessage.trim();
    if (!content || !profile || !isActive) return;

    setSending(true);
    setNewMessage('');

    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: profile.id, // server-side enforced via RLS, client provides own ID
          content,
        });

      if (error) throw error;
    } catch (err: any) {
      showToast(err.message || 'Failed to send message', 'error');
      setNewMessage(content); // restore
    } finally {
      setSending(false);
    }
  };

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const groupMessagesByDate = (msgs: Message[]) => {
    const groups: { date: string; messages: Message[] }[] = [];
    let currentDate = '';
    msgs.forEach(msg => {
      const d = new Date(msg.sent_at);
      const dateStr = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
      if (dateStr !== currentDate) {
        currentDate = dateStr;
        groups.push({ date: dateStr, messages: [msg] });
      } else {
        groups[groups.length - 1].messages.push(msg);
      }
    });
    return groups;
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100%', background: 'var(--bg-surface, #ffffff)',
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--slate-200)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '1rem 1.25rem',
        borderBottom: '1px solid var(--slate-200)',
        background: 'var(--slate-50)',
        display: 'flex', alignItems: 'center', gap: '0.75rem',
      }}>
        <div style={{
          width: '2.25rem', height: '2.25rem',
          borderRadius: 'var(--radius-full)',
          background: 'linear-gradient(135deg, var(--primary-500), var(--primary-700))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontWeight: 800, fontSize: '0.875rem',
        }}>
          {(otherParticipant.full_name || otherParticipant.username).charAt(0).toUpperCase()}
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--slate-900)' }}>
            {otherParticipant.role === 'doctor' ? 'Dr. ' : ''}{otherParticipant.full_name || otherParticipant.username}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <div style={{
              width: '6px', height: '6px', borderRadius: '50%',
              background: isActive ? 'var(--success-text)' : 'var(--slate-400)',
            }} />
            <span style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>
              {isActive ? 'Active' : 'Relationship ended'}
            </span>
          </div>
        </div>
      </div>

      {/* Messages area */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '1rem',
        display: 'flex', flexDirection: 'column', gap: '0.25rem',
        minHeight: 0,
      }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
            <div className="loading-spinner" />
          </div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--slate-400)' }}>
            <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>No messages yet</p>
            <p style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>
              {isActive ? 'Send a message to start the conversation.' : 'The conversation is archived.'}
            </p>
          </div>
        ) : (
          groupMessagesByDate(messages).map(group => (
            <div key={group.date}>
              {/* Date separator */}
              <div style={{
                textAlign: 'center', margin: '0.75rem 0',
                fontSize: '0.7rem', color: 'var(--slate-400)',
                fontWeight: 600, letterSpacing: '0.05em',
                display: 'flex', alignItems: 'center', gap: '0.5rem',
              }}>
                <div style={{ flex: 1, height: '1px', background: 'var(--slate-100)' }} />
                {group.date}
                <div style={{ flex: 1, height: '1px', background: 'var(--slate-100)' }} />
              </div>

              {group.messages.map(msg => {
                const isOwn = msg.sender_id === profile?.id;
                return (
                  <div key={msg.id} style={{
                    display: 'flex',
                    justifyContent: isOwn ? 'flex-end' : 'flex-start',
                    marginBottom: '0.375rem',
                  }}>
                    <div style={{ maxWidth: '72%' }}>
                      {!isOwn && (
                        <div style={{ fontSize: '0.7rem', color: 'var(--slate-500)', marginBottom: '0.2rem', paddingLeft: '0.25rem', fontWeight: 600 }}>
                          {(msg.sender as any)?.full_name || (msg.sender as any)?.username}
                        </div>
                      )}
                      <div style={{
                        padding: '0.625rem 0.875rem',
                        borderRadius: isOwn
                          ? 'var(--radius-lg) var(--radius-lg) var(--radius-sm) var(--radius-lg)'
                          : 'var(--radius-lg) var(--radius-lg) var(--radius-lg) var(--radius-sm)',
                        background: isOwn
                          ? 'linear-gradient(135deg, var(--primary-600), var(--primary-700))'
                          : 'var(--slate-100)',
                        color: isOwn ? '#ffffff' : 'var(--slate-800)',
                        fontSize: '0.875rem',
                        lineHeight: 1.5,
                        wordBreak: 'break-word',
                      }}>
                        {msg.content}
                      </div>
                      <div style={{
                        fontSize: '0.65rem', color: 'var(--slate-400)',
                        textAlign: isOwn ? 'right' : 'left',
                        marginTop: '0.2rem',
                        paddingLeft: '0.25rem', paddingRight: '0.25rem',
                        display: 'flex', alignItems: 'center',
                        justifyContent: isOwn ? 'flex-end' : 'flex-start',
                        gap: '0.25rem',
                      }}>
                        {formatTime(msg.sent_at)}
                        {isOwn && msg.is_read && (
                          <span style={{ color: 'var(--primary-400)', fontSize: '0.65rem' }}>✓✓</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div style={{
        borderTop: '1px solid var(--slate-200)',
        padding: '0.875rem 1rem',
        background: 'var(--bg-surface, #ffffff)',
      }}>
        {!isActive ? (
          <p style={{ fontSize: '0.8rem', color: 'var(--slate-400)', textAlign: 'center', padding: '0.25rem' }}>
            Messaging is disabled — relationship is no longer active.
          </p>
        ) : (
          <form onSubmit={handleSend} style={{ display: 'flex', gap: '0.625rem', alignItems: 'flex-end' }}>
            <textarea
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(e as any);
                }
              }}
              placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
              maxLength={4000}
              rows={1}
              style={{
                flex: 1, resize: 'none', padding: '0.625rem 0.875rem',
                borderRadius: 'var(--radius-md)', border: '1px solid var(--slate-300)',
                fontSize: '0.875rem', fontFamily: 'inherit',
                outline: 'none', lineHeight: 1.5,
                maxHeight: '120px', overflowY: 'auto',
              }}
              onFocus={e => e.target.style.borderColor = 'var(--primary-600)'}
              onBlur={e => e.target.style.borderColor = 'var(--slate-300)'}
              aria-label="Message input"
            />
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!newMessage.trim() || sending}
              style={{ padding: '0.625rem 0.875rem', flexShrink: 0 }}
              aria-label="Send message"
            >
              {sending ? <Loader size={16} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Send size={16} />}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
