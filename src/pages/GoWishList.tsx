import { useState, useEffect, FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import LoadingSpinner from '../components/LoadingSpinner';
import Avatar from '../components/Avatar';
import GroupEmojiPicker from '../components/GroupEmojiPicker';
import WishBoard, { CharCount, WISH_NAME_MAX, WISH_GROUP_DESC_MAX, WishInput } from '../components/WishBoard';
import type { User, WishItem, WishList, WishMember } from '../types';

// A shared GoWish group: one section of wishes per member. You add to your own section;
// any member can edit or delete any wish and manage members.
export default function GoWishList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { formatAmount } = useCurrency();
  const { id } = useParams();
  const list_id = Number(id);

  const [list, setList] = useState<WishList | null>(null);
  const [items, setItems] = useState<WishItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Members modal
  const [showMembers, setShowMembers] = useState(false);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [memberError, setMemberError] = useState('');

  // Edit group modal: icon, name, description
  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editEmoji, setEditEmoji] = useState('👥');

  useEffect(() => {
    (async () => {
      try {
        const [list_res, items_res] = await Promise.all([
          api.getWishList(list_id),
          api.getWishListItems(list_id),
        ]);
        setList(list_res.data || null);
        setItems(items_res.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : t('wish.groupNotFound'));
      } finally {
        setLoading(false);
      }
    })();
  }, [list_id]);

  const handleCreate = async (input: WishInput) => {
    const res = await api.createWishListItem(list_id, input.name, input.why, input.link, input.cost);
    if (res.data) setItems(prev => [res.data!, ...prev]);
  };

  const handleUpdate = async (item_id: number, input: WishInput) => {
    const res = await api.updateWishListItem(list_id, item_id, input.name, input.why, input.link, input.cost);
    if (res.data) setItems(prev => prev.map(it => it.id === item_id ? res.data! : it));
  };

  const handleDelete = async (item_id: number) => {
    await api.deleteWishListItem(list_id, item_id);
    setItems(prev => prev.filter(it => it.id !== item_id));
  };

  const openMembers = async () => {
    setMemberError('');
    setSelectedUser('');
    setShowMembers(true);
    try {
      const res = await api.getAllUsers();
      setAllUsers(res.data || []);
    } catch (err) {
      setMemberError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleAddMember = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setMemberError('');
    try {
      const res = await api.addWishListMember(list_id, parseInt(selectedUser));
      if (res.data) setList(res.data);
      setSelectedUser('');
    } catch (err) {
      setMemberError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleRemoveMember = async (member: WishMember) => {
    const is_self = member.id === user?.id;
    const is_last = (list?.members.length || 0) <= 1;
    const message = is_self
      ? (is_last ? t('wish.leaveLastConfirm') : t('wish.leaveConfirm'))
      : t('wish.removeMemberConfirm', { name: member.name });
    if (!confirm(message)) return;

    setMemberError('');
    try {
      const res = await api.removeWishListMember(list_id, member.id);
      if (is_self || res.data?.list_deleted) {
        navigate('/wish');
        return;
      }
      // Their section goes with them (the backend deletes their wishes in this group)
      setList(prev => prev ? { ...prev, members: prev.members.filter(m => m.id !== member.id) } : prev);
      setItems(prev => prev.filter(it => it.user_id !== member.id));
    } catch (err) {
      setMemberError(err instanceof Error ? err.message : String(err));
    }
  };

  const openEdit = () => {
    if (!list) return;
    setEditName(list.name);
    setEditDesc(list.description || '');
    setEditEmoji(list.emoji || '👥');
    setShowEdit(true);
  };

  const handleEdit = async (e: FormEvent) => {
    e.preventDefault();
    const name = editName.trim();
    if (!name) return;
    try {
      const res = await api.updateWishList(list_id, name, editDesc.trim(), editEmoji);
      if (res.data) setList(res.data);
      setShowEdit(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const backLink = (
    <div style={{ marginBottom: '16px' }}>
      <Link to="/wish" style={{ color: 'var(--primary)', textDecoration: 'none', fontSize: '0.9rem' }}>
        {t('wish.backToGoWish')}
      </Link>
    </div>
  );

  if (loading) {
    return <LoadingSpinner message={t('wish.loading')} />;
  }

  if (!list) {
    return (
      <div className="container">
        {backLink}
        <div className="alert alert-error">{error || t('wish.groupNotFound')}</div>
      </div>
    );
  }

  const members = list.members || [];
  // Your own section first, then everyone else in join order
  const sections = [...members].sort((x, y) => Number(y.id === user?.id) - Number(x.id === user?.id));
  const group_total = items.reduce((sum, it) => sum + (it.cost ?? 0), 0);

  return (
    <div className="container">
      {backLink}

      {/* Group header */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="card-header">
          <h2 className="card-title" style={{ overflowWrap: 'anywhere', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '2rem' }}>{list.emoji || '👥'}</span>
            {list.name}
          </h2>
          <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
            <button
              className="btn btn-outline btn-sm"
              onClick={openEdit}
              title={t('wish.editGroup')}
            >
              ✎
            </button>
            <button className="btn btn-outline btn-sm" onClick={openMembers}>
              {t('wish.members', { count: members.length })}
            </button>
          </div>
        </div>
        {list.description && (
          <p style={{ margin: 0, padding: '0 16px 12px', color: 'var(--text-muted)', fontSize: '0.9rem', overflowWrap: 'anywhere' }}>
            {list.description}
          </p>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '0 16px 16px' }}>
          {members.map(m => (
            <div key={m.id} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px 4px 4px',
              border: '1px solid var(--border)',
              borderRadius: '16px',
              fontSize: '0.85rem',
            }}>
              <Avatar name={m.name} avatar={m.avatar} size={22} />
              {m.name}{m.id === user?.id ? ` (${t('common.you')})` : ''}
            </div>
          ))}
        </div>
        <div style={{ padding: '0 16px 16px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          {t('wish.groupTotal')}: <strong style={{ color: 'var(--primary)' }}>{formatAmount(group_total)}</strong>
          {' · '}{t('wish.itemCount', { count: items.length })}
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: '16px' }}>{error}</div>}

      {/* One section per member */}
      {sections.map(m => {
        const mine = m.id === user?.id;
        return (
          <WishBoard
            key={m.id}
            compact
            title={
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Avatar name={m.name} avatar={m.avatar} size={24} />
                {mine ? t('wish.yourWishes') : t('wish.memberWishes', { name: m.name })}
              </span>
            }
            items={items.filter(it => it.user_id === m.id)}
            onCreate={mine ? handleCreate : undefined}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
          />
        );
      })}

      {/* Members Modal */}
      {showMembers && (
        <div className="modal-overlay" onClick={() => setShowMembers(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h3 className="modal-title">👥 {t('wish.members', { count: members.length })}</h3>
              <button className="modal-close" onClick={() => setShowMembers(false)}>×</button>
            </div>
            <div className="modal-body" style={{ padding: 0 }}>
              {memberError && (
                <div style={{ padding: '10px 16px', background: 'var(--danger)', color: 'white', fontSize: '0.85rem' }}>
                  {memberError}
                </div>
              )}
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {members.map(m => (
                  <li key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                    <Avatar name={m.name} avatar={m.avatar} size={36} />
                    <div style={{ flex: 1, minWidth: 0, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.name}{m.id === user?.id ? ` (${t('common.you')})` : ''}
                    </div>
                    <button
                      className="btn btn-outline btn-sm"
                      style={{ color: 'var(--danger)', borderColor: 'var(--danger)', flexShrink: 0 }}
                      onClick={() => handleRemoveMember(m)}
                    >
                      {m.id === user?.id ? t('common.leave') : t('common.remove')}
                    </button>
                  </li>
                ))}
              </ul>

              <form onSubmit={handleAddMember} style={{ padding: '16px' }}>
                <label className="form-label" style={{ marginBottom: '6px' }}>{t('wish.addMember')}</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select
                    className="form-select"
                    style={{ flex: 1 }}
                    value={selectedUser}
                    onChange={e => setSelectedUser(e.target.value)}
                    required
                  >
                    <option value="">{t('wish.selectUser')}</option>
                    {allUsers
                      .filter(u => !members.some(m => m.id === u.id))
                      .map(u => (
                        <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                      ))}
                  </select>
                  <button type="submit" className="btn btn-primary" disabled={!selectedUser}>{t('wish.add')}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Group Modal */}
      {showEdit && (
        <div className="modal-overlay" onClick={() => setShowEdit(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{t('wish.editGroup')}</h3>
              <button className="modal-close" onClick={() => setShowEdit(false)}>×</button>
            </div>
            <form onSubmit={handleEdit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">{t('dashboard.groupIcon')}</label>
                  <GroupEmojiPicker value={editEmoji} onChange={setEditEmoji} />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('wish.groupName')}</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '1.5rem' }}>{editEmoji}</span>
                    <input
                      type="text"
                      className="form-input"
                      style={{ flex: 1 }}
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      maxLength={WISH_NAME_MAX}
                      required
                      autoFocus
                    />
                  </div>
                  <CharCount value={editName} max={WISH_NAME_MAX} />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('dashboard.description')}</label>
                  <textarea
                    className="form-input"
                    value={editDesc}
                    onChange={e => setEditDesc(e.target.value)}
                    placeholder={t('wish.groupDescPlaceholder')}
                    maxLength={WISH_GROUP_DESC_MAX}
                    rows={3}
                    style={{ resize: 'vertical' }}
                  />
                  <CharCount value={editDesc} max={WISH_GROUP_DESC_MAX} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowEdit(false)}>
                  {t('common.cancel')}
                </button>
                <button type="submit" className="btn btn-primary">{t('wish.save')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
