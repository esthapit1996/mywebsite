import { useState, useRef, FormEvent, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useCurrency } from '../context/CurrencyContext';
import api from '../services/api';
import type { WishItem } from '../types';

// Matches backend limits (models.WishItemRequest)
export const WISH_NAME_MAX = 64;
export const WISH_GROUP_DESC_MAX = 128;
const WHY_MAX = 128;
// Paste-a-link lookup box in the add form; off while the backend wish AI is off (AI_DAILY_WISH_LOOKUPS=0)
const WISH_LOOKUP_ENABLED = false;

export interface WishInput {
  name: string;
  why: string;
  link: string;
  cost: number | null;
}

interface WishBoardProps {
  title: ReactNode;
  items: WishItem[];
  // Omit to hide the add button (e.g. another member's section in a group)
  onCreate?: (input: WishInput) => Promise<void>;
  onUpdate: (id: number, input: WishInput) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  // Single card with a one-line total, used for member sections in a shared group
  compact?: boolean;
}

export function CharCount({ value, max }: { value: string; max: number }) {
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

// Total + item list + add/edit modal, shared by personal GoWish and shared wish group sections
export default function WishBoard({ title, items, onCreate, onUpdate, onDelete, compact }: WishBoardProps) {
  const { t } = useTranslation();
  const { formatAmount, displayCurrency, currentCurrency, convertAmount, hasRate } = useCurrency();
  const [error, setError] = useState('');
  // Shown inside the modal (the board's error banner sits behind it)
  const [formError, setFormError] = useState('');

  // Costs are stored in EUR but entered in the user's display currency (EUR if its rate isn't loaded)
  const cost_currency = displayCurrency === 'EUR' || hasRate ? displayCurrency : 'EUR';
  const cost_symbol = cost_currency === displayCurrency ? currentCurrency.symbol : '€';
  // When editing, an untouched cost is saved as the original EUR value (no conversion drift)
  const originalCost = useRef<{ shown: string; eur: number | null } | null>(null);

  // "Use AI to get info on your wish"
  const [lookupUrl, setLookupUrl] = useState('');
  const [looking, setLooking] = useState(false);
  const [lookupMsg, setLookupMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [why, setWhy] = useState('');
  const [link, setLink] = useState('');
  const [cost, setCost] = useState('');
  const [saving, setSaving] = useState(false);

  const resetLookup = () => {
    setLookupUrl('');
    setLookupMsg(null);
    setLooking(false);
  };

  const openAdd = () => {
    setEditingId(null);
    setName('');
    setWhy('');
    setLink('');
    setCost('');
    originalCost.current = null;
    setFormError('');
    resetLookup();
    setShowModal(true);
  };

  const openEdit = (item: WishItem) => {
    setEditingId(item.id);
    setName(item.name);
    setWhy(item.why || '');
    setLink(item.link || '');
    const shown = item.cost != null ? (cost_currency === 'EUR' ? item.cost : convertAmount(item.cost)).toFixed(2) : '';
    setCost(shown);
    originalCost.current = { shown, eur: item.cost };
    setFormError('');
    resetLookup();
    setShowModal(true);
  };

  // Reads the pasted product link and fills in name, link and cost (converted to the user's currency)
  const handleLookup = async () => {
    const url = lookupUrl.trim();
    if (!url || looking) return;
    if (!/^https?:\/\/\S+$/i.test(url)) {
      setLookupMsg({ ok: false, text: t('wish.lookup.invalidUrl') });
      return;
    }
    setLooking(true);
    setLookupMsg(null);
    try {
      const res = await api.lookupWish(url);
      const r = res.data;
      if (!r || r.status !== 'ok') {
        setLookupMsg({ ok: false, text: t(`wish.lookup.${r?.status || 'not_found'}`) });
        return;
      }
      if (r.name) setName(r.name.slice(0, WISH_NAME_MAX));
      setLink(url);
      let text = t('wish.lookup.filled');
      if (r.price != null) {
        // A page without a currency is taken to be in the user's own currency
        const from = r.currency || cost_currency;
        if (from === cost_currency) {
          setCost(r.price.toFixed(2));
        } else {
          try {
            const conv = await api.convertCurrency(from, cost_currency, r.price);
            setCost(conv.converted.toFixed(2));
            text += ' ' + t('wish.lookup.converted', { price: `${r.price.toFixed(2)} ${from}` });
          } catch {
            setCost('');
            text += ' ' + t('wish.lookup.convertFailed', { price: `${r.price.toFixed(2)} ${from}` });
          }
        }
      } else {
        // No price: either the page has none, or the AI was needed for it and today's allowance is used up
        text += ' ' + t(r.price_in_cart ? 'wish.lookup.priceInCart' : r.ai_limit ? 'wish.lookup.limitPrice' : 'wish.lookup.noPrice');
      }
      if (r.source === 'ai') text += ' ' + t('wish.lookup.byAi');
      setLookupMsg({ ok: true, text });
    } catch (err) {
      setLookupMsg({ ok: false, text: err instanceof Error ? err.message : t('wish.lookup.unreachable') });
    } finally {
      setLooking(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
    setFormError('');
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const entered = cost.trim();
    const amount = entered === '' ? null : parseFloat(entered);
    if (!name.trim()) return;
    if (amount !== null && !(amount > 0)) return;

    setSaving(true);
    setError('');
    setFormError('');
    try {
      // Stored in EUR: convert what the user typed in their currency
      let eur_cost: number | null = null;
      if (amount !== null) {
        if (originalCost.current && entered === originalCost.current.shown) {
          eur_cost = originalCost.current.eur;
        } else if (cost_currency === 'EUR') {
          eur_cost = amount;
        } else {
          const conv = await api.convertCurrency(cost_currency, 'EUR', amount);
          eur_cost = Math.round(conv.converted * 100) / 100;
        }
      }
      const input: WishInput = { name: name.trim(), why: why.trim(), link: link.trim(), cost: eur_cost };
      if (editingId) {
        await onUpdate(editingId, input);
      } else if (onCreate) {
        await onCreate(input);
      }
      closeModal();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('wish.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t('wish.deleteConfirm'))) return;
    setError('');
    try {
      await onDelete(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('wish.deleteFailed'));
    }
  };

  const total_cost = items.reduce((sum, it) => sum + (it.cost ?? 0), 0);
  const unpriced_count = items.filter(it => it.cost == null).length;

  const rows = (
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
  );

  // Add / Edit Modal
  const modal = showModal && (
    <div className="modal-overlay" onClick={closeModal}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{editingId ? t('wish.editWish') : t('wish.addWish')}</h3>
          <button className="modal-close" onClick={closeModal}>×</button>
        </div>
        <form onSubmit={handleSave}>
          <div className="modal-body">
            {formError && <div className="alert alert-error" style={{ marginBottom: '12px' }}>{formError}</div>}

            {!editingId && WISH_LOOKUP_ENABLED && (
              <>
                {/* First option: let AI read the product page */}
                <div style={{ border: '1px solid var(--border)', borderRadius: '10px', padding: '12px', marginBottom: '12px', background: 'var(--bg)' }}>
                  <div style={{ fontWeight: 600, marginBottom: '4px' }}>✨ {t('wish.lookup.title')}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px' }}>{t('wish.lookup.hint')}</div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="url"
                      className="form-input"
                      style={{ flex: 1, minWidth: 0 }}
                      value={lookupUrl}
                      onChange={e => setLookupUrl(e.target.value)}
                      onKeyDown={e => {
                        // Enter here means "Get info", not "Add wish"
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleLookup();
                        }
                      }}
                      placeholder="https://..."
                      maxLength={2048}
                      autoFocus
                    />
                    <button type="button" className="btn btn-primary" onClick={handleLookup} disabled={looking || !lookupUrl.trim()}>
                      {looking ? t('wish.lookup.loading') : t('wish.lookup.button')}
                    </button>
                  </div>
                  {lookupMsg && (
                    <div style={{ marginTop: '8px', fontSize: '0.85rem', color: lookupMsg.ok ? 'var(--primary)' : 'var(--danger)' }}>
                      {lookupMsg.text}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '4px 0 12px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
                  {t('wish.lookup.or')}
                  <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
                </div>
              </>
            )}

            <div style={{ marginBottom: '12px' }}>
              <label className="form-label">{t('wish.name')}</label>
              <input
                type="text"
                className="form-input"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={t('wish.namePlaceholder')}
                maxLength={WISH_NAME_MAX}
                autoFocus={!WISH_LOOKUP_ENABLED}
                required
                autoFocus={!!editingId}
              />
              <CharCount value={name} max={WISH_NAME_MAX} />
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
                {t('wish.cost')} ({cost_currency}) <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({t('common.optional')})</span>
              </label>
              {/* Entered in the user's currency, stored in EUR (converted on save) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: 600 }}>{cost_symbol}</span>
                <input
                  type="number"
                  className="form-input"
                  style={{ flex: 1 }}
                  value={cost}
                  onChange={e => setCost(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  min="0.01"
                />
              </div>
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
  );

  const addButton = onCreate && (
    <button className={compact ? 'btn btn-primary btn-sm' : 'btn btn-primary'} onClick={openAdd}>
      + {t('wish.addWish')}
    </button>
  );

  if (compact) {
    return (
      <>
        <div className="card" style={{ marginBottom: '16px' }}>
          <div className="card-header">
            <h3 className="card-title">{title}</h3>
            {addButton}
          </div>
          <div style={{ padding: '0 16px 12px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            <strong style={{ color: 'var(--primary)' }}>{formatAmount(total_cost)}</strong> · {t('wish.itemCount', { count: items.length })}
            {unpriced_count > 0 && <> · {t('wish.unpricedCount', { count: unpriced_count })}</>}
          </div>
          {error && <div className="alert alert-error" style={{ margin: '0 16px 12px' }}>{error}</div>}
          {items.length === 0 ? (
            <p style={{ padding: '0 16px 16px', margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              {t('wish.sectionEmpty')}
            </p>
          ) : rows}
        </div>
        {modal}
      </>
    );
  }

  return (
    <>
      {/* Summary Card */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="card-header">
          <h2 className="card-title">{title}</h2>
          {addButton}
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
      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="card-header">
          <h3 className="card-title">{t('wish.list')}</h3>
        </div>
        {items.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">⭐</div>
            <h3>{t('wish.empty')}</h3>
            <p>{t('wish.emptyDesc')}</p>
          </div>
        ) : rows}
      </div>

      {modal}
    </>
  );
}
