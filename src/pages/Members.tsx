import { useState, useEffect, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import type { User, WhitelistEntry, BlacklistEntry } from '../types';

const FOUNDER_EMAIL = 'evansthapit20@gmail.com';

type TabType = 'members' | 'whitelist' | 'blacklist';

export default function Members() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('members');
  
  // Members state
  const [members, setMembers] = useState<User[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [deleting, setDeleting] = useState<number | null>(null);
  
  // Whitelist state
  const [whitelist, setWhitelist] = useState<WhitelistEntry[]>([]);
  const [loadingWhitelist, setLoadingWhitelist] = useState(true);
  const [newWhitelistEmail, setNewWhitelistEmail] = useState('');
  const [addingWhitelist, setAddingWhitelist] = useState(false);
  
  // Blacklist state
  const [blacklist, setBlacklist] = useState<BlacklistEntry[]>([]);
  const [loadingBlacklist, setLoadingBlacklist] = useState(true);
  const [newBlacklistEmail, setNewBlacklistEmail] = useState('');
  const [newBlacklistReason, setNewBlacklistReason] = useState('');
  const [addingBlacklist, setAddingBlacklist] = useState(false);
  
  const [error, setError] = useState('');

  const isFounder = user?.email === FOUNDER_EMAIL;

  useEffect(() => {
    if (user && !isFounder) {
      navigate('/');
      return;
    }
    loadMembers();
    loadWhitelist();
    loadBlacklist();
  }, [user, isFounder, navigate]);

  const loadMembers = async () => {
    try {
      const response = await api.getAllUsers();
      setMembers(response.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load members');
    } finally {
      setLoadingMembers(false);
    }
  };

  const loadWhitelist = async () => {
    try {
      const response = await api.getWhitelist();
      setWhitelist(response.data || []);
    } catch (err) {
      console.error('Failed to load whitelist:', err);
    } finally {
      setLoadingWhitelist(false);
    }
  };

  const loadBlacklist = async () => {
    try {
      const response = await api.getBlacklist();
      setBlacklist(response.data || []);
    } catch (err) {
      console.error('Failed to load blacklist:', err);
    } finally {
      setLoadingBlacklist(false);
    }
  };

  const handleDeleteMember = async (memberId: number, memberName: string, memberEmail: string) => {
    if (memberEmail === FOUNDER_EMAIL) {
      setError("Cannot delete the founder account");
      return;
    }

    if (!confirm(`Are you sure you want to delete ${memberName}?\n\nThis will permanently delete:\n• All their expenses\n• All their settlements\n• All their group memberships\n• All their suggestions and votes\n\nThis action cannot be undone!`)) {
      return;
    }

    setDeleting(memberId);
    setError('');
    try {
      await api.deleteUser(memberId);
      loadMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete member');
    } finally {
      setDeleting(null);
    }
  };

  const handleAddToWhitelist = async (e: FormEvent) => {
    e.preventDefault();
    if (!newWhitelistEmail.trim()) return;

    setAddingWhitelist(true);
    setError('');
    try {
      await api.addToWhitelist(newWhitelistEmail.trim());
      setNewWhitelistEmail('');
      loadWhitelist();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add email');
    } finally {
      setAddingWhitelist(false);
    }
  };

  const handleRemoveFromWhitelist = async (id: number, email: string) => {
    if (email.toLowerCase() === FOUNDER_EMAIL.toLowerCase()) {
      setError("Cannot remove the founder from whitelist");
      return;
    }
    if (!confirm(`Remove ${email} from whitelist?`)) return;

    setError('');
    try {
      await api.removeFromWhitelist(id);
      loadWhitelist();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove email');
    }
  };

  const handleAddToBlacklist = async (e: FormEvent) => {
    e.preventDefault();
    if (!newBlacklistEmail.trim()) return;

    setAddingBlacklist(true);
    setError('');
    try {
      await api.addToBlacklist(newBlacklistEmail.trim(), newBlacklistReason.trim());
      setNewBlacklistEmail('');
      setNewBlacklistReason('');
      loadBlacklist();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add email');
    } finally {
      setAddingBlacklist(false);
    }
  };

  const handleRemoveFromBlacklist = async (id: number, email: string) => {
    if (!confirm(`Remove ${email} from blacklist?`)) return;

    setError('');
    try {
      await api.removeFromBlacklist(id);
      loadBlacklist();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove email');
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (!isFounder) {
    return null;
  }

  const loading = loadingMembers && loadingWhitelist && loadingBlacklist;

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
          <p style={{ color: '#64748b', fontSize: '1rem' }}>Loading...</p>
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
          <h2 className="card-title">🛡️ Access Management</h2>
          <Link to="/" className="btn btn-outline btn-sm">← Back</Link>
        </div>

        {error && <div className="alert alert-error" style={{ margin: '16px' }}>{error}</div>}

        {/* Tabs */}
        <div style={{ 
          display: 'flex', 
          gap: '8px', 
          padding: '16px',
          borderBottom: '1px solid var(--border-color)',
          flexWrap: 'wrap'
        }}>
          {([
            { id: 'members' as TabType, label: '👥 Members', count: members.length, color: '#3b82f6' },
            { id: 'whitelist' as TabType, label: '✅ Whitelist', count: whitelist.length, color: '#22c55e' },
            { id: 'blacklist' as TabType, label: '🚫 Blacklist', count: blacklist.length, color: '#ef4444' },
          ]).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.95rem',
                fontWeight: '600',
                background: activeTab === tab.id ? tab.color : 'var(--bg-secondary, #374151)',
                color: activeTab === tab.id ? 'white' : 'var(--text-color)',
                transition: 'all 0.2s',
                boxShadow: activeTab === tab.id ? `0 2px 8px ${tab.color}66` : 'none'
              }}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        <div style={{ padding: '16px' }}>
          {/* Members Tab */}
          {activeTab === 'members' && (
            <div>
              {members.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">👥</div>
                  <h3>No members yet</h3>
                  <p>Members will appear here once they register</p>
                </div>
              ) : (
                <ul className="list" style={{ margin: 0 }}>
                  {members.map(member => (
                    <li key={member.id} className="list-item" style={{ 
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '16px',
                      gap: '12px'
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '8px',
                          marginBottom: '4px',
                          flexWrap: 'wrap'
                        }}>
                          <span style={{ fontWeight: '600', fontSize: '1rem' }}>
                            {member.name}
                          </span>
                          {member.email === FOUNDER_EMAIL && (
                            <span style={{ 
                              background: 'var(--success-color, #22c55e)', 
                              color: 'white',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '0.7rem',
                              fontWeight: '600'
                            }}>
                              FOUNDER
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                          📧 {member.email}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          Joined: {member.created_at ? formatDate(member.created_at) : 'N/A'}
                        </div>
                      </div>
                      
                      {member.email !== FOUNDER_EMAIL && (
                        <button
                          onClick={() => handleDeleteMember(member.id, member.name, member.email)}
                          disabled={deleting === member.id}
                          className="btn btn-outline btn-sm"
                          style={{ 
                            color: 'var(--error-color, #ef4444)',
                            borderColor: 'var(--error-color, #ef4444)',
                            opacity: deleting === member.id ? 0.5 : 1,
                            cursor: deleting === member.id ? 'not-allowed' : 'pointer'
                          }}
                        >
                          {deleting === member.id ? '⏳' : '🗑️'} Delete
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Whitelist Tab */}
          {activeTab === 'whitelist' && (
            <div>
              {/* Add to whitelist form */}
              <form onSubmit={handleAddToWhitelist} style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="email"
                    value={newWhitelistEmail}
                    onChange={(e) => setNewWhitelistEmail(e.target.value)}
                    placeholder="Enter email to whitelist..."
                    className="form-input"
                    style={{ flex: 1 }}
                    required
                  />
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={addingWhitelist || !newWhitelistEmail.trim()}
                  >
                    {addingWhitelist ? '⏳' : '✅'} Add
                  </button>
                </div>
              </form>

              {whitelist.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">✅</div>
                  <h3>Whitelist is empty</h3>
                  <p>Add emails to allow registration</p>
                </div>
              ) : (
                <ul className="list" style={{ margin: 0 }}>
                  {whitelist.map(entry => (
                    <li key={entry.id} className="list-item" style={{ 
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 16px',
                      gap: '12px'
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '500', marginBottom: '4px' }}>
                          {entry.email}
                          {entry.email.toLowerCase() === FOUNDER_EMAIL.toLowerCase() && (
                            <span style={{ 
                              marginLeft: '8px',
                              background: 'var(--success-color, #22c55e)', 
                              color: 'white',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '0.7rem',
                              fontWeight: '600'
                            }}>
                              FOUNDER
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          Added: {formatDate(entry.created_at)}
                        </div>
                      </div>
                      
                      {entry.email.toLowerCase() !== FOUNDER_EMAIL.toLowerCase() && (
                        <button
                          onClick={() => handleRemoveFromWhitelist(entry.id, entry.email)}
                          className="btn btn-outline btn-sm"
                          style={{ color: 'var(--error-color, #ef4444)' }}
                        >
                          🗑️
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Blacklist Tab */}
          {activeTab === 'blacklist' && (
            <div>
              {/* Add to blacklist form */}
              <form onSubmit={handleAddToBlacklist} style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <input
                    type="email"
                    value={newBlacklistEmail}
                    onChange={(e) => setNewBlacklistEmail(e.target.value)}
                    placeholder="Enter email to block..."
                    className="form-input"
                    style={{ flex: '1 1 200px' }}
                    required
                  />
                  <input
                    type="text"
                    value={newBlacklistReason}
                    onChange={(e) => setNewBlacklistReason(e.target.value)}
                    placeholder="Reason (optional)"
                    className="form-input"
                    style={{ flex: '1 1 150px' }}
                  />
                  <button
                    type="submit"
                    className="btn"
                    style={{ 
                      background: 'var(--error-color, #ef4444)', 
                      color: 'white',
                      border: 'none'
                    }}
                    disabled={addingBlacklist || !newBlacklistEmail.trim()}
                  >
                    {addingBlacklist ? '⏳' : '🚫'} Block
                  </button>
                </div>
              </form>

              {blacklist.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">🚫</div>
                  <h3>Blacklist is empty</h3>
                  <p>No emails are currently blocked</p>
                </div>
              ) : (
                <ul className="list" style={{ margin: 0 }}>
                  {blacklist.map(entry => (
                    <li key={entry.id} className="list-item" style={{ 
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 16px',
                      gap: '12px',
                      borderLeft: '3px solid var(--error-color, #ef4444)'
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '500', marginBottom: '4px' }}>
                          {entry.email}
                        </div>
                        {entry.reason && (
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                            Reason: {entry.reason}
                          </div>
                        )}
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          Blocked: {formatDate(entry.created_at)}
                        </div>
                      </div>
                      
                      <button
                        onClick={() => handleRemoveFromBlacklist(entry.id, entry.email)}
                        className="btn btn-outline btn-sm"
                        style={{ color: 'var(--success-color, #22c55e)' }}
                      >
                        ✅ Unblock
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div style={{ 
          padding: '12px 16px', 
          borderTop: '1px solid var(--border-color)',
          fontSize: '0.8rem',
          color: 'var(--text-muted)',
          textAlign: 'center'
        }}>
          {activeTab === 'members' && '⚠️ Deleting a member permanently removes all their data'}
          {activeTab === 'whitelist' && '✅ Only whitelisted emails can register'}
          {activeTab === 'blacklist' && '🚫 Blacklisted emails cannot register even if whitelisted'}
        </div>
      </div>
    </div>
  );
}
