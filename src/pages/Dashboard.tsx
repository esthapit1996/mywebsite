import { useState, useEffect, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useCurrency } from '../context/CurrencyContext';
import Avatar from '../components/Avatar';
import type { Group, User, DebtOverviewItem } from '../types';

export default function Dashboard() {
  const { formatAmount } = useCurrency();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [newGroupEmoji, setNewGroupEmoji] = useState('💰');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<number[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [debtOverview, setDebtOverview] = useState<DebtOverviewItem[]>([]);
  const [loadingDebt, setLoadingDebt] = useState(true);
  const [debtError, setDebtError] = useState<string | null>(null);

  // Available emojis for groups
  const availableEmojis = [
    '💰', '🍕', '🍔', '🍽️', '🍻', '☕',
    '✈️', '🚗', '🏨', '🏖️',
    '🏠', '🛒', '💡',
    '👨‍👩‍👧‍👦', '👥', '🎉', '💑',
    '🎬', '🎮', '🎵',
    '🏥', '🏋️',
    '🐵', '🐶', '🐱', '🐷',
    '💼', '🎓', '⚽', '🏆'
  ];

  useEffect(() => {
    loadGroups();
    loadCurrentUser();
    loadDebtOverview();
  }, []);

  const loadGroups = async () => {
    try {
      const response = await api.getGroups();
      setGroups(response.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load groups');
    } finally {
      setLoading(false);
    }
  };

  const loadCurrentUser = async () => {
    try {
      const response = await api.getProfile();
      if (response.data) {
        setCurrentUser(response.data);
      }
    } catch {
      console.error('Failed to load profile');
    }
  };

  const loadDebtOverview = async () => {
    try {
      const response = await api.getDebtOverview();
      // Filter out any items with missing user data
      const validDebts = (response.data || []).filter(item => item && item.user);
      setDebtOverview(validDebts);
      setDebtError(null);
    } catch (err) {
      console.error('Failed to load debt overview:', err);
      setDebtError(err instanceof Error ? err.message : 'Failed to load debt overview');
    } finally {
      setLoadingDebt(false);
    }
  };

  const loadAllUsers = async () => {
    try {
      const response = await api.getAllUsers();
      setAllUsers(response.data || []);
    } catch {
      console.error('Failed to load users');
    }
  };

  const openCreateModal = () => {
    setNewGroupName('');
    setNewGroupDesc('');
    setNewGroupEmoji('💰');
    setSelectedMembers([]);
    loadAllUsers();
    setShowModal(true);
  };

  const toggleMember = (userId: number) => {
    setSelectedMembers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleCreateGroup = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCreating(true);
    try {
      const response = await api.createGroup(newGroupName, newGroupDesc, newGroupEmoji);
      const groupId = response.data?.id;
      
      if (groupId) {
        // Add selected members to the group
        for (const userId of selectedMembers) {
          await api.addMember(groupId, userId);
        }
      }
      
      setShowModal(false);
      setNewGroupName('');
      setNewGroupDesc('');
      setNewGroupEmoji('💰');
      setSelectedMembers([]);
      loadGroups();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create group');
    } finally {
      setCreating(false);
    }
  };

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
          <p style={{ color: '#64748b', fontSize: '1rem' }}>Fetching your data...</p>
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
      {/* Debt Overview Card */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-header">
          <h2 className="card-title">Debt Overview</h2>
        </div>
        
        {loadingDebt ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            Loading...
          </div>
        ) : debtError ? (
          <div className="alert alert-error" style={{ margin: '16px' }}>{debtError}</div>
        ) : debtOverview.length === 0 ? (
          <div className="empty-state" style={{ padding: '30px' }}>
            <div className="empty-state-icon">✨</div>
            <h3>All balanced!</h3>
            <p>You have no outstanding debts.</p>
          </div>
        ) : (
          <ul className="list">
            {debtOverview.map((item) => (
              <li key={item.user.id} className="list-item" style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center' 
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Avatar name={item.user.name} avatar={item.user.avatar} size={30} />
                  {item.user.name}
                </span>
                <span style={{ 
                  fontWeight: '600',
                  color: item.amount > 0 ? 'var(--success-color, #22c55e)' : 'var(--error-color, #ef4444)'
                }}>
                  {item.amount > 0 ? (
                    <>+{formatAmount(item.amount)}</>
                  ) : (
                    <>-{formatAmount(Math.abs(item.amount))}</>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">My Groups</h2>
          <button className="btn btn-primary" onClick={openCreateModal}>
            + New Group
          </button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {groups.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">👥</div>
            <h3>No groups yet</h3>
            <p>Create a group to start splitting expenses with friends.</p>
          </div>
        ) : (
          <ul className="list">
            {groups.map((group) => (
              <li key={group.id} className="list-item">
                <Link to={`/groups/${group.id}`} style={{ flex: 1, textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '1.5rem' }}>{group.emoji || '💰'}</span>
                  <div style={{ flex: 1 }}>
                    <div className="list-item-title">{group.name}</div>
                    {group.description && (
                      <div className="list-item-subtitle">{group.description}</div>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Create New Group</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleCreateGroup}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Group Icon</label>
                  <div style={{ 
                    display: 'flex', 
                    flexWrap: 'wrap', 
                    gap: '8px', 
                    padding: '12px', 
                    border: '1px solid #ddd', 
                    borderRadius: '8px',
                    maxHeight: '120px',
                    overflowY: 'auto'
                  }}>
                    {availableEmojis.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setNewGroupEmoji(emoji)}
                        style={{
                          fontSize: '1.5rem',
                          padding: '8px',
                          border: newGroupEmoji === emoji ? '2px solid var(--primary)' : '2px solid transparent',
                          borderRadius: '8px',
                          background: newGroupEmoji === emoji ? '#e8f5e9' : 'transparent',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Group Name</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '1.5rem' }}>{newGroupEmoji}</span>
                    <input
                      type="text"
                      className="form-input"
                      style={{ flex: 1 }}
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value.slice(0, 69))}
                      placeholder="e.g., Roommates"
                      required
                    />
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px', textAlign: 'right' }}>
                    {newGroupName.length}/69
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Description (optional)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newGroupDesc}
                    onChange={(e) => setNewGroupDesc(e.target.value.slice(0, 128))}
                    placeholder="e.g., Shared apartment expenses"
                    maxLength={128}
                  />
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', textAlign: 'right' }}>
                    {newGroupDesc.length}/128 characters
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Add Members (optional)</label>
                  <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px', background: 'var(--card-bg)' }}>
                    {allUsers.filter(u => u.id !== currentUser?.id).length === 0 ? (
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', padding: '8px' }}>
                        No other users available yet
                      </div>
                    ) : (
                      allUsers.filter(u => u.id !== currentUser?.id).map(user => (
                        <label 
                          key={user.id} 
                          style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '10px', 
                            padding: '8px', 
                            cursor: 'pointer',
                            borderRadius: '4px',
                            background: selectedMembers.includes(user.id) ? 'var(--primary-color)' : 'transparent',
                            color: selectedMembers.includes(user.id) ? 'white' : 'var(--text-color)'
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={selectedMembers.includes(user.id)}
                            onChange={() => toggleMember(user.id)}
                          />
                          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Avatar name={user.name} avatar={user.avatar} size={24} />
                            {user.name}
                          </span>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>({user.email})</span>
                        </label>
                      ))
                    )}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    You will be automatically added as a member
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  {creating ? 'Creating...' : 'Create Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
