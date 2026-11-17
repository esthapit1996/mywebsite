import { useState, useEffect, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import LoadingSpinner from '../components/LoadingSpinner';
import Avatar from '../components/Avatar';
import GroupEmojiPicker from '../components/GroupEmojiPicker';
import WishBoard, { CharCount, WISH_NAME_MAX, WISH_GROUP_DESC_MAX, WishInput } from '../components/WishBoard';
import type { User, WishItem, WishList } from '../types';

export default function GoWish() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { formatAmount } = useCurrency();
  const [items, setItems] = useState<WishItem[]>([]);
  const [lists, setLists] = useState<WishList[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // New shared group modal: same options as a debt group
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [groupEmoji, setGroupEmoji] = useState('👥');
  const [selectedMembers, setSelectedMembers] = useState<number[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [items_res, lists_res] = await Promise.all([api.getWishItems(), api.getWishLists()]);
        setItems(items_res.data || []);
        setLists(lists_res.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : t('wish.loadFailed'));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleCreate = async (input: WishInput) => {
    const res = await api.createWishItem(input.name, input.why, input.link, input.cost);
    if (res.data) setItems(prev => [res.data!, ...prev]);
  };

  const handleUpdate = async (id: number, input: WishInput) => {
    const res = await api.updateWishItem(id, input.name, input.why, input.link, input.cost);
    if (res.data) setItems(prev => prev.map(it => it.id === id ? res.data! : it));
  };

  const handleDelete = async (id: number) => {
    await api.deleteWishItem(id);
    setItems(prev => prev.filter(it => it.id !== id));
  };

  const openNewGroup = async () => {
    setGroupName('');
    setGroupDesc('');
    setGroupEmoji('👥');
    setSelectedMembers([]);
    setShowNewGroup(true);
    try {
      const res = await api.getAllUsers();
      setAllUsers(res.data || []);
    } catch {
      setAllUsers([]);
    }
  };

  const toggleMember = (user_id: number) => {
    setSelectedMembers(prev => prev.includes(user_id) ? prev.filter(id => id !== user_id) : [...prev, user_id]);
  };

  const handleCreateGroup = async (e: FormEvent) => {
    e.preventDefault();
    const name = groupName.trim();
    if (!name) return;
    setCreating(true);
    setError('');
    try {
      const res = await api.createWishList(name, groupDesc.trim(), groupEmoji, selectedMembers);
      if (res.data) navigate(`/wish/lists/${res.data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('wish.createGroupFailed'));
      setCreating(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message={t('wish.loading')} />;
  }

  return (
    <div className="container">
      <div style={{ marginBottom: '16px' }}>
        <Link to="/" style={{ color: 'var(--primary)', textDecoration: 'none', fontSize: '0.9rem' }}>
          {t('common.backToDashboard')}
        </Link>
      </div>

      {/* Shared Wishes */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="card-header">
          <h2 className="card-title">👥 {t('wish.sharedTitle')}</h2>
          <button className="btn btn-primary" onClick={openNewGroup}>
            + {t('wish.newGroup')}
          </button>
        </div>
        {lists.length === 0 ? (
          <p style={{ padding: '0 16px 16px', margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            {t('wish.sharedEmpty')}
          </p>
        ) : (
          <div>
            {lists.map(list => (
              <div
                key={list.id}
                onClick={() => navigate(`/wish/lists/${list.id}`)}
                style={{
                  padding: '12px 16px',
                  borderTop: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: '1.5rem', flexShrink: 0 }}>{list.emoji || '👥'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{list.name}</div>
                  {list.description && (
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2px', overflowWrap: 'anywhere' }}>
                      {list.description}
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px' }}>
                    {(list.members || []).slice(0, 6).map(m => (
                      <Avatar key={m.id} name={m.name} avatar={m.avatar} size={20} />
                    ))}
                    {(list.members || []).length > 6 && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>+{list.members.length - 6}</span>
                    )}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontWeight: 600 }}>{formatAmount(list.total_cost)}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {t('wish.itemCount', { count: list.item_count })}
                  </div>
                </div>
                <span style={{ color: 'var(--text-muted)' }}>→</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: '16px' }}>{error}</div>}

      {/* Personal wishes */}
      <WishBoard
        title={<>⭐ {t('wish.myWishes')}</>}
        items={items}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
      />

      {/* New Group Modal */}
      {showNewGroup && (
        <div className="modal-overlay" onClick={() => setShowNewGroup(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{t('wish.newGroup')}</h3>
              <button className="modal-close" onClick={() => setShowNewGroup(false)}>×</button>
            </div>
            <form onSubmit={handleCreateGroup}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">{t('dashboard.groupIcon')}</label>
                  <GroupEmojiPicker value={groupEmoji} onChange={setGroupEmoji} />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('wish.groupName')}</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '1.5rem' }}>{groupEmoji}</span>
                    <input
                      type="text"
                      className="form-input"
                      style={{ flex: 1 }}
                      value={groupName}
                      onChange={e => setGroupName(e.target.value)}
                      placeholder={t('wish.groupNamePlaceholder')}
                      maxLength={WISH_NAME_MAX}
                      required
                      autoFocus
                    />
                  </div>
                  <CharCount value={groupName} max={WISH_NAME_MAX} />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('dashboard.description')}</label>
                  <textarea
                    className="form-input"
                    value={groupDesc}
                    onChange={e => setGroupDesc(e.target.value)}
                    placeholder={t('wish.groupDescPlaceholder')}
                    maxLength={WISH_GROUP_DESC_MAX}
                    rows={3}
                    style={{ resize: 'vertical' }}
                  />
                  <CharCount value={groupDesc} max={WISH_GROUP_DESC_MAX} />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('dashboard.addMembers')}</label>
                  <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px', background: 'var(--card-bg)' }}>
                    {allUsers.filter(u => u.id !== user?.id).length === 0 ? (
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', padding: '8px' }}>
                        {t('dashboard.noOtherUsers')}
                      </div>
                    ) : (
                      allUsers.filter(u => u.id !== user?.id).map(u => (
                        <label
                          key={u.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '8px',
                            cursor: 'pointer',
                            borderRadius: '4px',
                            background: selectedMembers.includes(u.id) ? 'var(--primary)' : 'transparent',
                            color: selectedMembers.includes(u.id) ? 'var(--btn-text, white)' : 'var(--text)',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={selectedMembers.includes(u.id)}
                            onChange={() => toggleMember(u.id)}
                          />
                          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Avatar name={u.name} avatar={u.avatar} size={24} />
                            {u.name}
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
                <button type="button" className="btn btn-outline" onClick={() => setShowNewGroup(false)}>
                  {t('common.cancel')}
                </button>
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  {creating ? t('wish.creating') : t('wish.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
