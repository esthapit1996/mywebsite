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
  const [submitting, setSubmitting] = useState(false);
  const [voters, setVoters] = useState<Voter[] | null>(null);
  const [showVotersFor, setShowVotersFor] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'open' | 'wip' | 'done'>('open');
  const [comments, setComments] = useState<Record<number, SuggestionComment[]>>({});
  const [showCommentsFor, setShowCommentsFor] = useState<number | null>(null);
  const [newComment, setNewComment] = useState<Record<number, string>>({});
  const [commentSubmitting, setCommentSubmitting] = useState<number | null>(null);

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
      await api.createSuggestion(newSuggestion.trim());
      setNewSuggestion('');
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

  // Group suggestions by status
  const openSuggestions = suggestions.filter(s => !s.status || s.status === 'open');
  const wipSuggestions = suggestions.filter(s => s.status === 'wip');
  const doneSuggestions = suggestions.filter(s => s.status === 'done');

  const renderSuggestionCard = (suggestion: Suggestion) => (
    <li key={suggestion.id} className="list-item" style={{ 
      display: 'block',
      padding: '16px'
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
              background: 'var(--primary-color)', 
              color: 'var(--btn-text, white)',
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '0.75rem',
              fontWeight: '600'
            }}>
              {suggestion.user_name}
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {formatDate(suggestion.created_at)}
            </span>
          </div>
          <p style={{ 
            margin: 0,
            lineHeight: '1.5',
            wordBreak: 'break-word',
            marginBottom: '12px'
          }}>
            {suggestion.content}
          </p>
          
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
                      <p style={{ margin: 0, lineHeight: '1.4', wordBreak: 'break-word' }}>
                        {comment.content}
                      </p>
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
        {canDelete(suggestion) && (
          <button
            onClick={() => handleDelete(suggestion.id)}
            className="btn btn-outline btn-sm"
            style={{ 
              color: 'var(--error-color, #ef4444)',
              flexShrink: 0
            }}
            title="Delete suggestion"
          >
            🗑️
          </button>
        )}
      </div>
    </li>
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
          {/* Tabs */}
          <div style={{ 
            display: 'flex', 
            gap: '8px', 
            marginBottom: '16px',
            flexWrap: 'wrap'
          }}>
            {(['open', 'wip', 'done'] as const).map(tab => {
              const tabConfig = {
                open: { label: '📋 Open', count: openSuggestions.length, color: '#3b82f6' },
                wip: { label: '🔨 WIP', count: wipSuggestions.length, color: '#f59e0b' },
                done: { label: '✅ Done', count: doneSuggestions.length, color: '#22c55e' }
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
                    color: activeTab === tab ? 'white' : 'var(--text-color)',
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
                    <ul className="list" style={{ margin: 0 }}>
                      {openSuggestions.map(renderSuggestionCard)}
                    </ul>
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
                    <ul className="list" style={{ margin: 0 }}>
                      {wipSuggestions.map(renderSuggestionCard)}
                    </ul>
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
                    <ul className="list" style={{ margin: 0 }}>
                      {doneSuggestions.map(renderSuggestionCard)}
                    </ul>
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
