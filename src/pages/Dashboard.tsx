import { useState, useEffect, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation, Trans } from 'react-i18next';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import Avatar from '../components/Avatar';
import LoadingSpinner from '../components/LoadingSpinner';
import type { Group, User, DebtOverviewItem, DebtDetailItem } from '../types';

export default function Dashboard() {
  const { user: currentUser } = useAuth();
  const { formatAmount } = useCurrency();
  const { t } = useTranslation();
  const navigate = useNavigate();
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
  const [debtOverview, setDebtOverview] = useState<DebtOverviewItem[]>([]);
  const [loadingDebt, setLoadingDebt] = useState(true);
  const [debtError, setDebtError] = useState<string | null>(null);
  const [expandedDebt, setExpandedDebt] = useState<number | null>(null);
  const [debtDetails, setDebtDetails] = useState<Record<number, DebtDetailItem[]>>({});
  const [loadingDetails, setLoadingDetails] = useState<number | null>(null);

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
    loadDebtOverview();
  }, []);

  const loadGroups = async () => {
    try {
      const response = await api.getGroups();
      setGroups(response.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('dashboard.failedLoadGroups'));
    } finally {
      setLoading(false);
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
      setDebtError(err instanceof Error ? err.message : t('dashboard.failedLoadDebt'));
    } finally {
      setLoadingDebt(false);
    }
  };

  const toggleDebtDetails = async (userId: number) => {
    if (expandedDebt === userId) {
      setExpandedDebt(null);
      return;
    }
    setExpandedDebt(userId);
    if (debtDetails[userId]) return; // Already loaded
    setLoadingDetails(userId);
    try {
      const response = await api.getDebtDetails(userId);
      setDebtDetails(prev => ({ ...prev, [userId]: response.data || [] }));
    } catch (err) {
      console.error('Failed to load debt details:', err);
    } finally {
      setLoadingDetails(null);
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
      
      if (groupId && selectedMembers.length > 0) {
        // Add selected members in parallel
        await Promise.all(selectedMembers.map(userId => api.addMember(groupId, userId)));
      }
      
      setShowModal(false);
      setNewGroupName('');
      setNewGroupDesc('');
      setNewGroupEmoji('💰');
      setSelectedMembers([]);
      loadGroups();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('dashboard.failedCreateGroup'));
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message={t('common.fetchingData')} />;
  }

  return (
    <div className="container">
      {/* Update hint */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: '8px 12px', marginBottom: '12px',
        fontSize: '0.78rem', color: 'var(--text-muted)',
        background: 'var(--card-bg)', borderRadius: '8px',
        border: '1px solid var(--border)',
      }}>
        <span>💡</span>
        <span><Trans i18nKey="dashboard.updateHint" components={{ strong: <strong /> }} /></span>
      </div>

      {/* Debt Overview Card */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-header">
          <h2 className="card-title">{t('dashboard.debtOverview')}</h2>
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
            <h3>{t('dashboard.allBalanced')}</h3>
            <p>{t('dashboard.noDebts')}</p>
          </div>
        ) : (
          <ul className="list">
            {debtOverview.map((item) => (
              <li key={item.user.id} className="list-item" style={{ 
                display: 'block',
                padding: 0,
              }}>
                <div
                  onClick={() => toggleDebtDetails(item.user.id)}
                  style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    padding: '12px 16px',
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg, rgba(0,0,0,0.03))')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Avatar name={item.user.name} avatar={item.user.avatar} size={30} />
                    {item.user.name}
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', transition: 'transform 0.2s', transform: expandedDebt === item.user.id ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
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
                </div>

                {expandedDebt === item.user.id && (
                  <div style={{
                    padding: '0 16px 12px',
                    borderTop: '1px solid var(--border)',
                    background: 'var(--card-bg-alt, var(--card-bg))',
                  }}>
                    {loadingDetails === item.user.id ? (
                      <div style={{ padding: '12px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        {t('dashboard.loadingDetails')}
                      </div>
                    ) : !debtDetails[item.user.id] || debtDetails[item.user.id].length === 0 ? (
                      <div style={{ padding: '12px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        {t('dashboard.noDetails')}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '10px' }}>
                        {debtDetails[item.user.id].map((detail, idx) => (
                          <div key={idx} style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            padding: '8px 10px',
                            borderRadius: '8px',
                            background: 'var(--bg, #f8fafc)',
                            fontSize: '0.85rem',
                            gap: '12px',
                          }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 500, marginBottom: '2px' }}>
                                <span style={{ 
                                  fontSize: '0.7rem', 
                                  padding: '1px 5px', 
                                  borderRadius: '4px',
                                  marginRight: '6px',
                                  background: detail.type === 'settled' ? 'var(--success-light, #dcfce7)' : detail.type === 'expense' ? 'var(--primary-light, #dbeafe)' : detail.type === 'settlement' ? 'var(--success-light, #dcfce7)' : 'var(--warning-light, #fef3c7)',
                                  color: detail.type === 'settled' ? 'var(--success-color, #22c55e)' : detail.type === 'expense' ? 'var(--primary, #3b82f6)' : detail.type === 'settlement' ? 'var(--success-color, #22c55e)' : 'var(--warning-color, #f59e0b)',
                                }}>
                                  {detail.type === 'settled' ? '✅ settled' : detail.type}
                                </span>
                                {detail.description}
                              </div>
                              <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                                📁 {detail.group_name} · 📅 {new Date(detail.created_at).toLocaleDateString()}
                              </div>
                            </div>
                            {detail.type !== 'settled' && (
                              <span style={{
                                fontWeight: 600,
                                whiteSpace: 'nowrap',
                                color: detail.amount > 0 ? 'var(--success-color, #22c55e)' : 'var(--error-color, #ef4444)',
                              }}>
                                {detail.amount > 0 ? '+' : '-'}{formatAmount(Math.abs(detail.amount))}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* GopherStash Card */}
      <div
        className="card"
        onClick={() => navigate('/stash')}
        style={{
          marginBottom: '24px',
          cursor: 'pointer',
          transition: 'transform 0.15s, box-shadow 0.15s',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          padding: '20px 24px',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = 'none';
        }}
      >
        <span style={{ fontSize: '2.5rem' }}>🐿️</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: '700', fontSize: '1.15rem', marginBottom: '4px' }}>
            {t('stash.title')}
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
            {t('stash.tagline')}
          </div>
        </div>
        <span style={{ fontSize: '1.2rem', color: 'var(--text-muted)' }}>→</span>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">{t('dashboard.myGroups')}</h2>
          <button className="btn btn-primary" onClick={openCreateModal}>
            {t('dashboard.newGroup')}
          </button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {groups.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">👥</div>
            <h3>{t('dashboard.noGroups')}</h3>
            <p>{t('dashboard.noGroupsDesc')}</p>
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
              <h3 className="modal-title">{t('dashboard.createNewGroup')}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleCreateGroup}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">{t('dashboard.groupIcon')}</label>
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
                  <label className="form-label">{t('dashboard.groupName')}</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '1.5rem' }}>{newGroupEmoji}</span>
                    <input
                      type="text"
                      className="form-input"
                      style={{ flex: 1 }}
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value.slice(0, 69))}
                      placeholder={t('dashboard.groupNamePlaceholder')}
                      required
                    />
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px', textAlign: 'right' }}>
                    {newGroupName.length}/69
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">{t('dashboard.description')}</label>
                  <textarea
                    className="form-input"
                    value={newGroupDesc}
                    onChange={(e) => setNewGroupDesc(e.target.value.slice(0, 128))}
                    placeholder={t('dashboard.descPlaceholder')}
                    maxLength={128}
                    rows={3}
                    style={{ resize: 'vertical' }}
                  />
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', textAlign: 'right' }}>
                    {newGroupDesc.length}/128 {t('dashboard.characters')}
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">{t('dashboard.addMembers')}</label>
                  <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px', background: 'var(--card-bg)' }}>
                    {allUsers.filter(u => u.id !== currentUser?.id).length === 0 ? (
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', padding: '8px' }}>
                        {t('dashboard.noOtherUsers')}
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
                            background: selectedMembers.includes(user.id) ? 'var(--primary)' : 'transparent',
                            color: selectedMembers.includes(user.id) ? 'var(--btn-text, white)' : 'var(--text)'
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
                        </label>
                      ))
                    )}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    {t('dashboard.autoAdded')}
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>
                  {t('common.cancel')}
                </button>
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  {creating ? t('dashboard.creating') : t('dashboard.createGroup')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
