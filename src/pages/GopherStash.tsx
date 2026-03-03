import { useState, useEffect, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { useCurrency } from '../context/CurrencyContext';
import LoadingSpinner from '../components/LoadingSpinner';
import ReceiptScanner from '../components/ReceiptScanner';
import type { StashExpense, StashSummary } from '../types';

export default function GopherStash() {
  const { t } = useTranslation();
  const { formatAmount, currentCurrency } = useCurrency();
  const [summary, setSummary] = useState<StashSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal state
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [adding, setAdding] = useState(false);
  const [clearing, setClearing] = useState(false);

  // History state — lazy-loaded on toggle
  const [showHistory, setShowHistory] = useState(false);
  const [expenses, setExpenses] = useState<StashExpense[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    loadSummary();
  }, []);

  const loadSummary = async () => {
    try {
      const res = await api.getStashSummary();
      setSummary(res.data || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('stash.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await api.getStashExpenses();
      setExpenses(res.data || []);
      setHistoryLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('stash.loadFailed'));
    } finally {
      setHistoryLoading(false);
    }
  };

  const toggleHistory = () => {
    const opening = !showHistory;
    setShowHistory(opening);
    if (opening && !historyLoaded) {
      loadHistory();
    }
  };

  const closeExpenseModal = () => {
    setShowExpenseModal(false);
    setAmount('');
    setDescription('');
  };

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0 || !description.trim()) return;

    setAdding(true);
    try {
      const res = await api.createStashExpense(numAmount, description.trim(), '');
      if (res.data) {
        if (historyLoaded) {
          setExpenses(prev => [res.data!, ...prev]);
        }
        setSummary(prev => {
          if (!prev) return { total_spent: numAmount, expense_count: 1, by_category: {} };
          return {
            ...prev,
            total_spent: prev.total_spent + numAmount,
            expense_count: prev.expense_count + 1,
          };
        });
      }
      closeExpenseModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('stash.addFailed'));
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: number) => {
    const expense = expenses.find(e => e.id === id);
    if (!expense) return;
    if (!confirm(t('stash.deleteConfirm'))) return;

    try {
      await api.deleteStashExpense(id);
      setExpenses(prev => prev.filter(e => e.id !== id));
      setSummary(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          total_spent: prev.total_spent - expense.amount,
          expense_count: prev.expense_count - 1,
        };
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('stash.deleteFailed'));
    }
  };

  const handleClearAll = async () => {
    if (!confirm(t('stash.clearConfirm'))) return;
    setClearing(true);
    try {
      await api.clearStashExpenses();
      setExpenses([]);
      setSummary({ total_spent: 0, expense_count: 0, by_category: {} });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('stash.clearFailed'));
    } finally {
      setClearing(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message={t('stash.loading')} />;
  }

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
          <h2 className="card-title">🐿️ {t('stash.title')}</h2>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-primary btn-sm" onClick={() => setShowExpenseModal(true)}>
              + {t('stash.addExpense')}
            </button>
            {(summary?.expense_count || 0) > 0 && (
              <button
                className="btn btn-outline btn-sm"
                onClick={handleClearAll}
                disabled={clearing}
                style={{ color: 'var(--error-color, #ef4444)' }}
              >
                {clearing ? t('stash.clearing') : t('stash.clearAll')}
              </button>
            )}
          </div>
        </div>

        {/* Total Spent */}
        <div style={{
          textAlign: 'center',
          padding: '20px 0',
        }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
            {t('stash.totalSpent')}
          </div>
          <div style={{
            fontSize: '2rem',
            fontWeight: '700',
            color: summary && summary.total_spent > 0 ? 'var(--error-color, #ef4444)' : 'var(--text)',
          }}>
            {formatAmount(summary?.total_spent || 0)}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            {t('stash.expenseCount', { count: summary?.expense_count || 0 })}
          </div>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: '16px' }}>{error}</div>}

      {/* Expense History — collapsible, lazy-loaded */}
      <div className="card">
        <div
          className="card-header"
          onClick={toggleHistory}
          style={{ cursor: 'pointer', userSelect: 'none' }}
        >
          <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              display: 'inline-block',
              transition: 'transform 0.2s',
              transform: showHistory ? 'rotate(90deg)' : 'rotate(0deg)',
              fontSize: '0.8rem',
            }}>▶</span>
            {t('stash.history')}
          </h3>
        </div>

        {showHistory && (
          <>
            {historyLoading ? (
              <div style={{ padding: '24px', textAlign: 'center' }}>
                <LoadingSpinner message={t('stash.loading')} />
              </div>
            ) : expenses.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">🐿️</div>
                <h3>{t('stash.empty')}</h3>
                <p>{t('stash.emptyDesc')}</p>
              </div>
            ) : (
              <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                {expenses.map(expense => (
                  <div key={expense.id} style={{
                    padding: '12px',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                  }}>
                    {/* Icon badge */}
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
                      💰
                    </div>
                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: '500' }}>
                        {expense.description}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {new Date(expense.created_at).toLocaleString()}
                      </div>
                    </div>
                    {/* Amount + delete */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      <span style={{
                        fontWeight: '600',
                        color: 'var(--error-color, #ef4444)',
                      }}>
                        -{formatAmount(expense.amount)}
                      </span>
                      <button
                        onClick={() => handleDelete(expense.id)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '0.9rem',
                          opacity: 0.4,
                          padding: '4px',
                          transition: 'opacity 0.15s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                        onMouseLeave={e => (e.currentTarget.style.opacity = '0.4')}
                        title={t('common.delete')}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Add Expense Modal */}
      {showExpenseModal && (
        <div className="modal-overlay" onClick={closeExpenseModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{t('stash.addExpense')}</h3>
              <button className="modal-close" onClick={closeExpenseModal}>×</button>
            </div>
            <form onSubmit={handleAdd}>
              <div className="modal-body">
                {/* Receipt Scanner */}
                <ReceiptScanner onResult={(result) => {
                  if (result.storeName) {
                    setDescription(result.storeName.slice(0, 255));
                  } else if (result.items.length > 0) {
                    setDescription(result.items.map(i => i.name).join(', ').slice(0, 255));
                  }
                  if (result.items.length > 0) {
                    const itemSum = Math.round(result.items.reduce((s, it) => s + it.price, 0) * 100) / 100;
                    setAmount(itemSum.toFixed(2));
                  } else if (result.total) {
                    setAmount(result.total.toFixed(2));
                  }
                }} />

                {/* Amount with currency indicator */}
                <div style={{ marginBottom: '12px' }}>
                  <label className="form-label">
                    {t('stash.amount')} ({currentCurrency?.symbol || '€'} {currentCurrency?.code || 'EUR'})
                  </label>
                  <input
                    type="number"
                    className="form-input"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    min="0.01"
                    required
                    autoFocus
                  />
                </div>

                {/* Description */}
                <div style={{ marginBottom: '12px' }}>
                  <label className="form-label">{t('stash.description')}</label>
                  <input
                    type="text"
                    className="form-input"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder={t('stash.descriptionPlaceholder')}
                    maxLength={255}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={closeExpenseModal}>
                  {t('common.cancel')}
                </button>
                <button type="submit" className="btn btn-primary" disabled={adding}>
                  {adding ? t('stash.adding') : t('stash.addExpense')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
