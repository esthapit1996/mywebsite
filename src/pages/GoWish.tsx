import { useState, useEffect, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { useCurrency } from '../context/CurrencyContext';
import LoadingSpinner from '../components/LoadingSpinner';
import type { WishItem } from '../types';

// Matches backend limits (models.WishItemRequest)
const NAME_MAX = 64;
const WHY_MAX = 128;

function CharCount({ value, max }: { value: string; max: number }) {
  return (
    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'right', marginTop: '4px' }}>
      {value.length}/{max}
    </div>
  );
}

// Only render http(s) links as anchors; the backend enforces this too
function safeLink(link: string): string | null {
  return /^https?:\/\//i.test(link) ? link : null;
}

function linkHost(link: string): string {
  try {
    return new URL(link).hostname.replace(/^www\./, '');
  } catch {
    return link;
  }
}

export default function GoWish() {
  const { t } = useTranslation();
  const { formatAmount } = useCurrency();
  const [items, setItems] = useState<WishItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [why, setWhy] = useState('');
  const [link, setLink] = useState('');
  const [cost, setCost] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    try {
      const res = await api.getWishItems();
      setItems(res.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('wish.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const openAdd = () => {
    setEditingId(null);
    setName('');
    setWhy('');
    setLink('');
    setCost('');
    setShowModal(true);
  };

  const openEdit = (item: WishItem) => {
    setEditingId(item.id);
    setName(item.name);
    setWhy(item.why || '');
    setLink(item.link || '');
    setCost(item.cost != null ? item.cost.toFixed(2) : '');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed_name = name.trim();
    const trimmed_why = why.trim();
    const trimmed_link = link.trim();
    const num_cost = cost.trim() === '' ? null : parseFloat(cost);
    if (!trimmed_name) return;
    if (num_cost !== null && !(num_cost > 0)) return;

    setSaving(true);
    setError('');
    try {
      if (editingId) {
        const res = await api.updateWishItem(editingId, trimmed_name, trimmed_why, trimmed_link, num_cost);
        if (res.data) {
          setItems(prev => prev.map(it => it.id === editingId ? res.data! : it));
        }
      } else {
        const res = await api.createWishItem(trimmed_name, trimmed_why, trimmed_link, num_cost);
        if (res.data) {
          setItems(prev => [res.data!, ...prev]);
        }
      }
      closeModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('wish.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t('wish.deleteConfirm'))) return;
    try {
      await api.deleteWishItem(id);
      setItems(prev => prev.filter(it => it.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('wish.deleteFailed'));
    }
  };

  if (loading) {
    return <LoadingSpinner message={t('wish.loading')} />;
  }

  const total_cost = items.reduce((sum, it) => sum + (it.cost ?? 0), 0);
  const unpriced_count = items.filter(it => it.cost == null).length;

  return (
    <div className="container">
      <div style={{ marginBottom: '16px' }}>
        <Link to="/" style={{ color: 'var(--primary)', textDecoration: 'none', fontSize: '0.9rem' }}>
          {t('common.backToDashboard')}
        </Link>
      </div>

      {/* Summary Card */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="card-header">
          <h2 className="card-title">⭐ {t('wish.title')}</h2>
          <button className="btn btn-primary" onClick={openAdd}>
            + {t('wish.addWish')}
          </button>
        </div>
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
            {t('wish.totalCost')}
          </div>
          <div style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--primary)' }}>
            {formatAmount(total_cost)}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            {t('wish.itemCount', { count: items.length })}
            {unpriced_count > 0 && <> · {t('wish.unpricedCount', { count: unpriced_count })}</>}
          </div>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: '16px' }}>{error}</div>}

      {/* Wishlist */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">{t('wish.list')}</h3>
        </div>
        {items.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">⭐</div>
            <h3>{t('wish.empty')}</h3>
            <p>{t('wish.emptyDesc')}</p>
          </div>
        ) : (
          <div>
            {items.map(item => {
              const href = safeLink(item.link);
              return (
                <div key={item.id} style={{
                  padding: '12px',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: 'var(--card-bg)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '16px',
                    flexShrink: 0,
                    border: '1px solid var(--border)',
                  }}>
                    ⭐
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: '500', overflowWrap: 'anywhere' }}>{item.name}</div>
                    {item.why && (
                      <div style={{
                        fontSize: '0.85rem',
                        color: 'var(--text-muted)',
                        fontStyle: 'italic',
                        marginTop: '2px',
                        overflowWrap: 'anywhere',
                      }}>
                        {item.why}
                      </div>
                    )}
                    {href && (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: '0.8rem',
                          color: 'var(--primary)',
                          display: 'block',
                          marginTop: '2px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        🔗 {linkHost(href)}
                      </a>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    {item.cost != null ? (
                      <span style={{ fontWeight: '600' }}>{formatAmount(item.cost)}</span>
                    ) : (
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{t('wish.noPrice')}</span>
                    )}
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => openEdit(item)}
                      title={t('wish.editWish')}
                      style={{ fontSize: '0.9rem' }}
                    >
                      ✎
                    </button>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => handleDelete(item.id)}
                      title={t('common.delete')}
                    >
                      ×
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editingId ? t('wish.editWish') : t('wish.addWish')}</h3>
              <button className="modal-close" onClick={closeModal}>×</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div style={{ marginBottom: '12px' }}>
                  <label className="form-label">{t('wish.name')}</label>
                  <input
                    type="text"
                    className="form-input"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder={t('wish.namePlaceholder')}
                    maxLength={NAME_MAX}
                    required
                    autoFocus
                  />
                  <CharCount value={name} max={NAME_MAX} />
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <label className="form-label">
                    {t('wish.why')} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({t('common.optional')})</span>
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={why}
                    onChange={e => setWhy(e.target.value)}
                    placeholder={t('wish.whyPlaceholder')}
                    maxLength={WHY_MAX}
                  />
                  <CharCount value={why} max={WHY_MAX} />
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <label className="form-label">
                    {t('wish.link')} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({t('common.optional')})</span>
                  </label>
                  <input
                    type="url"
                    className="form-input"
                    value={link}
                    onChange={e => setLink(e.target.value)}
                    placeholder="https://..."
                    pattern="https?://.+"
                    title={t('wish.linkHint')}
                    maxLength={2048}
                  />
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <label className="form-label">
                    {t('wish.cost')} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({t('common.optional')})</span>
                  </label>
                  <input
                    type="number"
                    className="form-input"
                    value={cost}
                    onChange={e => setCost(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    min="0.01"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={closeModal}>
                  {t('common.cancel')}
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? t('wish.saving') : editingId ? t('wish.editWish') : t('wish.addWish')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
