import { useState, useEffect, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import type { Suggestion, Voter, SuggestionComment } from '../types';

const MAX_CHARS = 420;
const MAX_COMMENT_CHARS = 420;
const MAX_COMMENTS_PER_USER = 4;
const FOUNDER_EMAIL = 'evansthapit20@gmail.com';

export default function Suggestions() {
  const { user } = useAuth();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [count, setCount] = useState(0);
  const [max, setMax] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newSuggestion, setNewSuggestion] = useState('');
  const [newType, setNewType] = useState('feature');
  const [submitting, setSubmitting] = useState(false);
  const [voters, setVoters] = useState<Voter[] | null>(null);
  const [showVotersFor, setShowVotersFor] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'open' | 'wip' | 'done' | 'denied'>('open');
  const [filterType, setFilterType] = useState<string>('all');
  const [comments, setComments] = useState<Record<number, SuggestionComment[]>>({});
  const [showCommentsFor, setShowCommentsFor] = useState<number | null>(null);
  const [newComment, setNewComment] = useState<Record<number, string>>({});
  const [commentSubmitting, setCommentSubmitting] = useState<number | null>(null);
  const [editingSuggestion, setEditingSuggestion] = useState<number | null>(null);
  const [editSuggestionContent, setEditSuggestionContent] = useState('');
  const [editSuggestionType, setEditSuggestionType] = useState('feature');
  const [editingComment, setEditingComment] = useState<number | null>(null);
  const [editCommentContent, setEditCommentContent] = useState('');

  const isFounder = user?.email === FOUNDER_EMAIL;

  useEffect(() => {
    loadSuggestions();
  }, []);

  const loadSuggestions = async () => {
    try {
      const response = await api.getSuggestions();
      setSuggestions(response.data?.suggestions || []);
      setCount(response.data?.count || 0);
      setMax(response.data?.max || 20);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load suggestions');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newSuggestion.trim()) return;
    
    setSubmitting(true);
    setError('');
    try {
      await api.createSuggestion(newSuggestion.trim(), newType);
      setNewSuggestion('');
      setNewType('feature');
      loadSuggestions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit suggestion');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (suggestionId: number) => {
    if (!confirm('Delete this suggestion?')) return;
    try {
      await api.deleteSuggestion(suggestionId);
      loadSuggestions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete suggestion');
    }
  };

  const handleVote = async (suggestionId: number, voteType: 'like' | 'dislike') => {
    try {
      const suggestion = suggestions.find(s => s.id === suggestionId);
      if (suggestion?.user_vote === voteType) {
        await api.removeVote(suggestionId);
      } else {
        await api.voteSuggestion(suggestionId, voteType);
      }
      loadSuggestions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record vote');
    }
  };

  const handleStatusChange = async (suggestionId: number, newStatus: string) => {
    try {
      await api.updateSuggestionStatus(suggestionId, newStatus);
      loadSuggestions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  const handleShowVoters = async (suggestionId: number) => {
    if (showVotersFor === suggestionId) {
      setShowVotersFor(null);
      setVoters(null);
      return;
    }
    try {
      const response = await api.getSuggestionVoters(suggestionId);
      setVoters(response.data || []);
      setShowVotersFor(suggestionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load voters');
    }
  };

  const handleShowComments = async (suggestionId: number) => {
    if (showCommentsFor === suggestionId) {
      setShowCommentsFor(null);
      return;
    }
    try {
      const response = await api.getSuggestionComments(suggestionId);
      setComments(prev => ({ ...prev, [suggestionId]: response.data || [] }));
      setShowCommentsFor(suggestionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load comments');
    }
  };

  const handleAddComment = async (suggestionId: number) => {
    const content = newComment[suggestionId]?.trim();
    if (!content) return;

    setCommentSubmitting(suggestionId);
    try {
      await api.createSuggestionComment(suggestionId, content);
      setNewComment(prev => ({ ...prev, [suggestionId]: '' }));
      // Reload comments
      const response = await api.getSuggestionComments(suggestionId);
      setComments(prev => ({ ...prev, [suggestionId]: response.data || [] }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add comment');
    } finally {
      setCommentSubmitting(null);
    }
  };

  const handleDeleteComment = async (suggestionId: number, commentId: number) => {
    if (!confirm('Delete this comment?')) return;
    try {
      await api.deleteSuggestionComment(suggestionId, commentId);
      // Reload comments
      const response = await api.getSuggestionComments(suggestionId);
      setComments(prev => ({ ...prev, [suggestionId]: response.data || [] }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete comment');
    }
  };

  const handleEditSuggestion = (suggestion: Suggestion) => {
    setEditingSuggestion(suggestion.id);
    setEditSuggestionContent(suggestion.content);
    setEditSuggestionType(suggestion.type || 'other');
  };

  const handleSaveEditSuggestion = async (suggestionId: number) => {
    if (!editSuggestionContent.trim()) return;
    try {
      await api.editSuggestion(suggestionId, editSuggestionContent.trim(), editSuggestionType);
      setEditingSuggestion(null);
      loadSuggestions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to edit suggestion');
    }
  };

  const handleEditComment = (comment: SuggestionComment) => {
    setEditingComment(comment.id);
    setEditCommentContent(comment.content);
  };

  const handleSaveEditComment = async (suggestionId: number, commentId: number) => {
    if (!editCommentContent.trim()) return;
    try {
      await api.editSuggestionComment(suggestionId, commentId, editCommentContent.trim());
      setEditingComment(null);
      const response = await api.getSuggestionComments(suggestionId);
      setComments(prev => ({ ...prev, [suggestionId]: response.data || [] }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to edit comment');
    }
  };

  const canComment = (suggestion: Suggestion) => {
    return user?.id === suggestion.user_id || isFounder;
  };

  const getUserCommentCount = (suggestionId: number) => {
    const suggestionComments = comments[suggestionId] || [];
    return suggestionComments.filter(c => c.user_id === user?.id).length;
  };

  const canDelete = (suggestion: Suggestion) => {
    return user?.id === suggestion.user_id || isFounder;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Type config
  const typeConfig: Record<string, { label: string; emoji: string; color: string }> = {
    feature: { label: 'New Feature', emoji: '🚀', color: '#8b5cf6' },
    bug: { label: 'Bug Report', emoji: '🐛', color: '#ef4444' },
    theme: { label: 'New Theme', emoji: '🎨', color: '#ec4899' },
    ux: { label: 'UI/UX', emoji: '✨', color: '#06b6d4' },
    change: { label: 'Change Feature', emoji: '🔄', color: '#f97316' },
    complaint: { label: 'Complaint', emoji: '😤', color: '#dc2626' },
    praise: { label: 'Praise', emoji: '🙌', color: '#22c55e' },
    other: { label: 'Other', emoji: '📝', color: '#6b7280' },
  };

  // Filter by type first, then group by status
  const typeFiltered = filterType === 'all' ? suggestions : suggestions.filter(s => s.type === filterType);
  const openSuggestions = typeFiltered.filter(s => !s.status || s.status === 'open');
  const wipSuggestions = typeFiltered.filter(s => s.status === 'wip');
  const doneSuggestions = typeFiltered.filter(s => s.status === 'done');
  const deniedSuggestions = typeFiltered.filter(s => s.status === 'denied');

  const renderSuggestionCard = (suggestion: Suggestion) => (
    <div key={suggestion.id} style={{ 
      display: 'block',
      padding: '16px',
      background: 'var(--card-bg)',
      borderRadius: '10px',
      border: '1px solid var(--border)',
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'flex-start',
        gap: '12px'
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px',
            marginBottom: '8px',
            flexWrap: 'wrap'
          }}>
            <span style={{ 
              background: 'var(--primary)', 
              color: 'var(--btn-text, white)',
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '0.75rem',
              fontWeight: '600'
            }}>
              {suggestion.user_name}
            </span>
            <span style={{
              background: (typeConfig[suggestion.type] || typeConfig.other).color,
              color: 'white',
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '0.7rem',
              fontWeight: '600'
            }}>
              {(typeConfig[suggestion.type] || typeConfig.other).emoji} {(typeConfig[suggestion.type] || typeConfig.other).label}
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {formatDate(suggestion.created_at)}
            </span>
          </div>
          {editingSuggestion === suggestion.id ? (
            <div style={{ marginBottom: '12px' }}>
              <textarea
                value={editSuggestionContent}
                onChange={(e) => setEditSuggestionContent(e.target.value.slice(0, MAX_CHARS))}
                style={{
                  width: '100%',
                  minHeight: '60px',
                  padding: '8px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--card-bg)',
                  color: 'var(--text-color)',
                  fontSize: '0.9rem',
                  resize: 'vertical'
                }}
              />
              <div style={{ display: 'flex', gap: '8px', marginTop: '6px', alignItems: 'center' }}>
                <select
                  value={editSuggestionType}
                  onChange={(e) => setEditSuggestionType(e.target.value)}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--card-bg)',
                    color: 'var(--text-color)',
                    fontSize: '0.8rem'
                  }}
                >
                  {Object.entries(typeConfig).map(([key, cfg]) => (
                    <option key={key} value={key}>{cfg.emoji} {cfg.label}</option>
                  ))}
                </select>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {editSuggestionContent.length}/{MAX_CHARS}
                </span>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
                  <button
                    onClick={() => setEditingSuggestion(null)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      background: 'transparent',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      fontSize: '0.8rem'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleSaveEditSuggestion(suggestion.id)}
                    disabled={!editSuggestionContent.trim()}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: 'none',
                      background: 'var(--primary)',
                      color: 'white',
                      cursor: editSuggestionContent.trim() ? 'pointer' : 'not-allowed',
                      fontSize: '0.8rem',
                      opacity: editSuggestionContent.trim() ? 1 : 0.5
                    }}
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <p style={{ 
              margin: 0,
              lineHeight: '1.5',
              wordBreak: 'break-word',
              marginBottom: '12px'
            }}>
              {suggestion.content}
            </p>
          )}
          
          {/* Voting and status controls */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px',
            flexWrap: 'wrap'
          }}>
            <button
              onClick={() => handleVote(suggestion.id, 'like')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 12px',
                borderRadius: '16px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.9rem',
                background: suggestion.user_vote === 'like' 
                  ? 'var(--success-color, #22c55e)' 
                  : 'var(--bg-secondary, #374151)',
                color: suggestion.user_vote === 'like' ? 'white' : 'var(--text-color)',
                transition: 'all 0.2s'
              }}
              title="Like this suggestion"
            >
              👍 {suggestion.likes || 0}
            </button>
            <button
              onClick={() => handleVote(suggestion.id, 'dislike')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 12px',
                borderRadius: '16px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.9rem',
                background: suggestion.user_vote === 'dislike' 
                  ? 'var(--error-color, #ef4444)' 
                  : 'var(--bg-secondary, #374151)',
                color: suggestion.user_vote === 'dislike' ? 'white' : 'var(--text-color)',
                transition: 'all 0.2s'
              }}
              title="Dislike this suggestion"
            >
              👎 {suggestion.dislikes || 0}
            </button>
            
            {/* Founder controls */}
            {isFounder && (
              <>
                <select
                  value={suggestion.status || 'open'}
                  onChange={(e) => handleStatusChange(suggestion.id, e.target.value)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '16px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--card-bg)',
                    color: 'var(--text-color)',
                    cursor: 'pointer',
                    fontSize: '0.8rem'
                  }}
                >
                  <option value="open">📋 Open</option>
                  <option value="wip">🔨 WIP</option>
                  <option value="done">✅ Done</option>
                  <option value="denied">🚫 Denied</option>
                </select>
                <button
                  onClick={() => handleShowVoters(suggestion.id)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '16px',
                    border: '1px solid var(--border-color)',
                    background: 'transparent',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: '0.8rem'
                  }}
                  title="View who voted"
                >
                  👁️ {showVotersFor === suggestion.id ? 'Hide' : 'View'} voters
                </button>
              </>
            )}
            
            {/* Comments toggle (only for suggestion owner or founder) */}
            {canComment(suggestion) && (
              <button
                onClick={() => handleShowComments(suggestion.id)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '16px',
                  border: '1px solid var(--border-color)',
                  background: showCommentsFor === suggestion.id ? 'var(--primary-color)' : 'transparent',
                  color: showCommentsFor === suggestion.id ? 'white' : 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '0.8rem'
                }}
                title="View/add comments"
              >
                💬 Comments{suggestion.comment_count > 0 ? ` (${suggestion.comment_count})` : ''}
              </button>
            )}
          </div>
          
          {/* Voters list (only for founder) */}
          {isFounder && showVotersFor === suggestion.id && voters && (
            <div style={{
              marginTop: '12px',
              padding: '12px',
              background: 'var(--bg-secondary, #1f2937)',
              borderRadius: '8px',
              fontSize: '0.85rem',
              color: 'var(--text)'
            }}>
              <strong>Voters:</strong>
              {voters.length === 0 ? (
                <p style={{ margin: '8px 0 0', color: 'var(--text-muted)' }}>No votes yet</p>
              ) : (
                <ul style={{ margin: '8px 0 0', paddingLeft: '20px', color: 'var(--text)' }}>
                  {voters.map(v => (
                    <li key={v.id} style={{ marginBottom: '4px', color: 'var(--text)' }}>
                      {v.vote_type === 'like' ? '👍' : '👎'} {v.user_name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          
          {/* Comments section (only for suggestion owner or founder) */}
          {canComment(suggestion) && showCommentsFor === suggestion.id && (
            <div style={{
              marginTop: '12px',
              padding: '12px',
              background: 'var(--bg-secondary, #1f2937)',
              borderRadius: '8px',
              fontSize: '0.85rem',
              color: 'var(--text)'
            }}>
              <strong>💬 Comments:</strong>
              
              {/* Existing comments */}
              {(comments[suggestion.id] || []).length === 0 ? (
                <p style={{ margin: '8px 0', color: 'var(--text-muted)' }}>No comments yet</p>
              ) : (
                <div style={{ marginTop: '8px', marginBottom: '12px' }}>
                  {(comments[suggestion.id] || []).map(comment => (
                    <div key={comment.id} style={{
                      padding: '10px',
                      marginBottom: '8px',
                      background: 'var(--card-bg)',
                      borderRadius: '8px',
                      borderLeft: comment.user_id === suggestion.user_id 
                        ? '3px solid var(--primary-color)' 
                        : '3px solid var(--success-color, #22c55e)'
                    }}>
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        marginBottom: '6px'
                      }}>
                        <span style={{ 
                          fontWeight: '600',
                          color: comment.user_id === suggestion.user_id 
                            ? 'var(--primary-color)' 
                            : 'var(--success-color, #22c55e)',
                          fontSize: '0.8rem'
                        }}>
                          {comment.user_name}{comment.user_id === suggestion.user_id ? ' (Owner)' : ''}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            {formatDate(comment.created_at)}
                          </span>
                          {user?.id === comment.user_id && editingComment !== comment.id && (
                            <button
                              onClick={() => handleEditComment(comment)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-muted)',
                                cursor: 'pointer',
                                padding: '2px',
                                fontSize: '0.8rem'
                              }}
                              title="Edit comment"
                            >
                              ✏️
                            </button>
                          )}
                          {(user?.id === comment.user_id || isFounder) && (
                            <button
                              onClick={() => handleDeleteComment(suggestion.id, comment.id)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--error-color, #ef4444)',
                                cursor: 'pointer',
                                padding: '2px',
                                fontSize: '0.8rem'
                              }}
                              title="Delete comment"
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                      </div>
                      {editingComment === comment.id ? (
                        <div>
                          <textarea
                            value={editCommentContent}
                            onChange={(e) => setEditCommentContent(e.target.value.slice(0, MAX_COMMENT_CHARS))}
                            style={{
                              width: '100%',
                              minHeight: '50px',
                              padding: '6px',
                              borderRadius: '6px',
                              border: '1px solid var(--border-color)',
                              background: 'var(--bg-secondary)',
                              color: 'var(--text-color)',
                              fontSize: '0.85rem',
                              resize: 'vertical'
                            }}
                          />
                          <div style={{ display: 'flex', gap: '6px', marginTop: '4px', justifyContent: 'flex-end' }}>
                            <button
                              onClick={() => setEditingComment(null)}
                              style={{
                                padding: '3px 8px',
                                borderRadius: '4px',
                                border: '1px solid var(--border-color)',
                                background: 'transparent',
                                color: 'var(--text-muted)',
                                cursor: 'pointer',
                                fontSize: '0.75rem'
                              }}
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleSaveEditComment(suggestion.id, comment.id)}
                              disabled={!editCommentContent.trim()}
                              style={{
                                padding: '3px 8px',
                                borderRadius: '4px',
                                border: 'none',
                                background: 'var(--primary)',
                                color: 'white',
                                cursor: editCommentContent.trim() ? 'pointer' : 'not-allowed',
                                fontSize: '0.75rem',
                                opacity: editCommentContent.trim() ? 1 : 0.5
                              }}
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p style={{ margin: 0, lineHeight: '1.4', wordBreak: 'break-word' }}>
                          {comment.content}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
              
              {/* Add comment form */}
              {getUserCommentCount(suggestion.id) < MAX_COMMENTS_PER_USER ? (
                <div style={{ marginTop: '8px' }}>
                  <textarea
                    value={newComment[suggestion.id] || ''}
                    onChange={(e) => setNewComment(prev => ({ 
                      ...prev, 
                      [suggestion.id]: e.target.value.slice(0, MAX_COMMENT_CHARS)
                    }))}
                    placeholder="Add a comment..."
                    style={{
                      width: '100%',
                      minHeight: '60px',
                      padding: '8px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--card-bg)',
                      color: 'var(--text-color)',
                      fontSize: '0.85rem',
                      resize: 'vertical'
                    }}
                  />
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    marginTop: '6px'
                  }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {(newComment[suggestion.id] || '').length}/{MAX_COMMENT_CHARS} chars • {getUserCommentCount(suggestion.id)}/{MAX_COMMENTS_PER_USER} comments used
                    </span>
                    <button
                      onClick={() => handleAddComment(suggestion.id)}
                      disabled={!(newComment[suggestion.id]?.trim()) || commentSubmitting === suggestion.id}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        border: 'none',
                        background: 'var(--primary-color)',
                        color: 'white',
                        cursor: !(newComment[suggestion.id]?.trim()) ? 'not-allowed' : 'pointer',
                        fontSize: '0.8rem',
                        opacity: !(newComment[suggestion.id]?.trim()) ? 0.5 : 1
                      }}
                    >
                      {commentSubmitting === suggestion.id ? 'Posting...' : 'Post Comment'}
                    </button>
                  </div>
                </div>
              ) : (
                <p style={{ margin: '8px 0 0', color: 'var(--warning-color, #f59e0b)', fontSize: '0.8rem' }}>
                  You've reached the maximum of {MAX_COMMENTS_PER_USER} comments on this suggestion.
                </p>
              )}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
          {user?.id === suggestion.user_id && editingSuggestion !== suggestion.id && (
            <button
              onClick={() => handleEditSuggestion(suggestion)}
              className="btn btn-outline btn-sm"
              style={{ 
                color: 'var(--text-muted)',
              }}
              title="Edit suggestion"
            >
              ✏️
            </button>
          )}
          {canDelete(suggestion) && (
            <button
              onClick={() => handleDelete(suggestion.id)}
              className="btn btn-outline btn-sm"
              style={{ 
                color: 'var(--error-color, #ef4444)',
              }}
              title="Delete suggestion"
            >
              🗑️
            </button>
          )}
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="container">
        <div className="card text-center" style={{ padding: '60px 20px' }}>
          <div className="loading-spinner" style={{
            width: '40px',
            height: '40px',
            border: '4px solid #e2e8f0',
            borderTop: '4px solid #10b981',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }} />
          <p style={{ color: '#64748b', fontSize: '1rem' }}>Loading suggestions...</p>
        </div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">💡 Suggestion Box</h2>
          <Link to="/" className="btn btn-outline btn-sm">← Back</Link>
        </div>

        {error && <div className="alert alert-error" style={{ margin: '16px' }}>{error}</div>}

        {/* Submit new suggestion */}
        <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Type</label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '2px solid var(--border)',
                  background: 'var(--card-bg)',
                  color: 'var(--text)',
                  fontSize: '0.9rem',
                  marginBottom: '8px'
                }}
              >
                <option value="feature">🚀 New Feature</option>
                <option value="bug">🐛 Bug Report</option>
                <option value="theme">🎨 New Theme</option>
                <option value="ux">✨ UI/UX Improvement</option>
                <option value="change">🔄 Change Existing Feature</option>
                <option value="complaint">😤 Complaint</option>
                <option value="praise">🙌 Praise</option>
                <option value="other">📝 Other</option>
              </select>
            </div>
            <div style={{ marginBottom: '12px' }}>
              <textarea
                value={newSuggestion}
                onChange={(e) => setNewSuggestion(e.target.value.slice(0, MAX_CHARS))}
                placeholder="Share your idea or feature request..."
                disabled={count >= max || submitting}
                style={{
                  width: '100%',
                  minHeight: '80px',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '3px solid #000',
                  background: 'var(--card-bg)',
                  color: 'var(--text-color)',
                  fontSize: '1rem',
                  resize: 'vertical',
                  boxShadow: '0 0 0 1px rgba(0,0,0,0.1)'
                }}
              />
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginTop: '8px',
                fontSize: '0.85rem',
                color: 'var(--text-muted)'
              }}>
                <span>{newSuggestion.length}/{MAX_CHARS} characters</span>
                <span>{openSuggestions.length}/{max} open suggestions</span>
              </div>
            </div>
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={!newSuggestion.trim() || openSuggestions.length >= max || submitting}
            >
              {submitting ? 'Posting...' : '📝 Post Suggestion'}
            </button>
          </form>
          {openSuggestions.length >= max && (
            <div className="alert alert-error" style={{ marginTop: '12px' }}>
              Maximum open suggestions reached. Please wait for existing suggestions to be addressed.
            </div>
          )}
        </div>

        {/* Suggestions by status */}
        <div style={{ padding: '16px' }}>
          {/* Type filter */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '12px',
            flexWrap: 'wrap'
          }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Filter by type:</span>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: '2px solid var(--border)',
                background: 'var(--card-bg)',
                color: 'var(--text)',
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
            >
              <option value="all">All Types</option>
              <option value="feature">🚀 New Feature</option>
              <option value="bug">🐛 Bug Report</option>
              <option value="theme">🎨 New Theme</option>
              <option value="ux">✨ UI/UX Improvement</option>
              <option value="change">🔄 Change Existing Feature</option>
              <option value="complaint">😤 Complaint</option>
              <option value="praise">🙌 Praise</option>
              <option value="other">📝 Other</option>
            </select>
          </div>

          {/* Tabs */}
          <div style={{ 
            display: 'flex', 
            gap: '8px', 
            marginBottom: '16px',
            flexWrap: 'wrap'
          }}>
            {(['open', 'wip', 'done', 'denied'] as const).map(tab => {
              const tabConfig = {
                open: { label: '📋 Open', count: openSuggestions.length, color: '#3b82f6' },
                wip: { label: '🔨 WIP', count: wipSuggestions.length, color: '#f59e0b' },
                done: { label: '✅ Done', count: doneSuggestions.length, color: '#22c55e' },
                denied: { label: '🚫 Denied', count: deniedSuggestions.length, color: '#ef4444' }
              };
              const config = tabConfig[tab];
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '0.95rem',
                    fontWeight: '600',
                    background: activeTab === tab ? config.color : 'var(--bg-secondary, #374151)',
                    color: activeTab === tab ? 'white' : 'var(--text)',
                    transition: 'all 0.2s',
                    boxShadow: activeTab === tab ? `0 2px 8px ${config.color}66` : 'none'
                  }}
                >
                  {config.label} ({config.count})
                </button>
              );
            })}
          </div>

          {/* Active tab content */}
          {suggestions.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">💭</div>
              <h3>No suggestions yet</h3>
              <p>Be the first to share your ideas!</p>
            </div>
          ) : (
            <>
              {activeTab === 'open' && (
                <div style={{ 
                  borderLeft: '4px solid #3b82f6',
                  borderRadius: '0 8px 8px 0',
                  background: 'var(--bg-secondary, #1f2937)'
                }}>
                  {openSuggestions.length === 0 ? (
                    <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No open suggestions
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '12px' }}>
                      {openSuggestions.map(renderSuggestionCard)}
                    </div>
                  )}
                </div>
              )}
              {activeTab === 'wip' && (
                <div style={{ 
                  borderLeft: '4px solid #f59e0b',
                  borderRadius: '0 8px 8px 0',
                  background: 'var(--bg-secondary, #1f2937)'
                }}>
                  {wipSuggestions.length === 0 ? (
                    <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No suggestions in progress
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '12px' }}>
                      {wipSuggestions.map(renderSuggestionCard)}
                    </div>
                  )}
                </div>
              )}
              {activeTab === 'done' && (
                <div style={{ 
                  borderLeft: '4px solid #22c55e',
                  borderRadius: '0 8px 8px 0',
                  background: 'var(--bg-secondary, #1f2937)'
                }}>
                  {doneSuggestions.length === 0 ? (
                    <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No completed suggestions yet
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '12px' }}>
                      {doneSuggestions.map(renderSuggestionCard)}
                    </div>
                  )}
                </div>
              )}
              {activeTab === 'denied' && (
                <div style={{ 
                  borderLeft: '4px solid #ef4444',
                  borderRadius: '0 8px 8px 0',
                  background: 'var(--bg-secondary, #1f2937)'
                }}>
                  {deniedSuggestions.length === 0 ? (
                    <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No denied suggestions — Evan approves everything! 🎉
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '12px' }}>
                      {deniedSuggestions.map(renderSuggestionCard)}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div style={{ 
          padding: '12px 16px', 
          borderTop: '1px solid var(--border-color)',
          fontSize: '0.8rem',
          color: 'var(--text-muted)',
          textAlign: 'center'
        }}>
          💡 Created by Evan Sthapit • Max {max} suggestions • {MAX_CHARS} chars each
        </div>
      </div>
    </div>
  );
}
