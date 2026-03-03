import { useState, useEffect, useRef, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { useCurrency, DISPLAY_CURRENCIES } from '../context/CurrencyContext';
import LoadingSpinner from '../components/LoadingSpinner';
import ReceiptScanner from '../components/ReceiptScanner';
import type { StashExpense, StashSummary } from '../types';

const CATEGORIES = [
  { key: '', icon: '📝' },
  { key: 'food', icon: '🍔' },
  { key: 'drinks', icon: '🍻' },
  { key: 'transport', icon: '🚗' },
  { key: 'shopping', icon: '🛒' },
  { key: 'entertainment', icon: '🎬' },
  { key: 'health', icon: '🏥' },
  { key: 'bills', icon: '💡' },
  { key: 'gas', icon: '⛽' },
  { key: 'travel', icon: '✈️' },
  { key: 'other', icon: '📦' },
];

function getCategoryIcon(category: string): string {
  return CATEGORIES.find(c => c.key === category)?.icon || '📝';
}

export default function GopherStash() {
  const { t } = useTranslation();
  const { formatAmount } = useCurrency();
  const [summary, setSummary] = useState<StashSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal state
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [adding, setAdding] = useState(false);
  const [clearing, setClearing] = useState(false);

  // Currency picker state
  const [expenseCurrency, setExpenseCurrency] = useState('EUR');
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [convertedAmount, setConvertedAmount] = useState<number | null>(null);
  const [conversionRate, setConversionRate] = useState<number | null>(null);
  const [converting, setConverting] = useState(false);
  const currencyPickerRef = useRef<HTMLDivElement>(null);

  // History state — lazy-loaded on toggle
  const [showHistory, setShowHistory] = useState(false);
  const [expenses, setExpenses] = useState<StashExpense[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    loadSummary();
  }, []);

  // Close currency picker on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (currencyPickerRef.current && !currencyPickerRef.current.contains(event.target as Node)) {
        setShowCurrencyPicker(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Convert currency when amount or currency changes
  useEffect(() => {
    const doConvert = async () => {
      if (!amount || expenseCurrency === 'EUR') {
        setConvertedAmount(null);
        setConversionRate(null);
        return;
      }
      setConverting(true);
      try {
        const result = await api.convertCurrency(expenseCurrency, 'EUR', amount);
        setConvertedAmount(result.converted);
        setConversionRate(result.rate);
      } catch {
        setConvertedAmount(null);
        setConversionRate(null);
      } finally {
        setConverting(false);
      }
    };
    const timeoutId = setTimeout(doConvert, 300);
    return () => clearTimeout(timeoutId);
  }, [amount, expenseCurrency]);

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
    setCategory('');
    setExpenseCurrency('EUR');
    setConvertedAmount(null);
    setConversionRate(null);
    setShowCurrencyPicker(false);
  };

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0 || !description.trim()) return;

    // If non-EUR, wait for conversion
    const finalAmount = expenseCurrency === 'EUR' ? numAmount : convertedAmount;
    if (!finalAmount) {
      setError(t('stash.waitConversion'));
      return;
    }

    // Append original currency info to description if non-EUR
    let finalDesc = description.trim();
    if (expenseCurrency !== 'EUR') {
      const sym = DISPLAY_CURRENCIES.find(c => c.code === expenseCurrency)?.symbol || expenseCurrency;
      finalDesc = `${finalDesc} (${sym}${amount} ${expenseCurrency})`;
    }

    setAdding(true);
    try {
      const res = await api.createStashExpense(finalAmount, finalDesc.slice(0, 420), category);
      if (res.data) {
        if (historyLoaded) {
          setExpenses(prev => [res.data!, ...prev]);
        }
        setSummary(prev => {
          if (!prev) return { total_spent: finalAmount, expense_count: 1, by_category: { [category || 'uncategorized']: finalAmount } };
          const cat = category || 'uncategorized';
          return {
            ...prev,
            total_spent: prev.total_spent + finalAmount,
            expense_count: prev.expense_count + 1,
            by_category: {
              ...prev.by_category,
              [cat]: (prev.by_category[cat] || 0) + finalAmount,
            },
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
        const cat = expense.category || 'uncategorized';
        const newByCategory = { ...prev.by_category };
        newByCategory[cat] = (newByCategory[cat] || 0) - expense.amount;
        if (newByCategory[cat] <= 0) delete newByCategory[cat];
        return {
          ...prev,
          total_spent: prev.total_spent - expense.amount,
          expense_count: prev.expense_count - 1,
          by_category: newByCategory,
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
          borderBottom: summary && Object.keys(summary.by_category).length > 0 ? '1px solid var(--border)' : 'none',
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

        {/* Category Breakdown */}
        {summary && Object.keys(summary.by_category).length > 0 && (
          <div style={{ padding: '12px 16px' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: '600', marginBottom: '8px', color: 'var(--text-muted)' }}>
              {t('stash.byCategory')}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {Object.entries(summary.by_category)
                .sort(([, a], [, b]) => b - a)
                .map(([cat, total]) => (
                  <div
                    key={cat}
                    style={{
                      background: 'var(--card-bg)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      fontSize: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <span>{getCategoryIcon(cat)}</span>
                    <span style={{ textTransform: 'capitalize' }}>{t(`stash.categories.${cat}`)}</span>
                    <span style={{ fontWeight: '600', color: 'var(--error-color, #ef4444)' }}>
                      {formatAmount(total)}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}
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
                    {/* Category icon badge */}
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
                      {getCategoryIcon(expense.category)}
                    </div>
                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: '500' }}>
                        {expense.description}
                      </div>
                      {expense.category && (
                        <div style={{
                          fontSize: '0.8rem',
                          color: 'var(--primary)',
                          textTransform: 'capitalize',
                          marginTop: '2px',
                        }}>
                          {t(`stash.categories.${expense.category}`)}
                        </div>
                      )}
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
                    setDescription(result.storeName.slice(0, 420));
                  } else if (result.items.length > 0) {
                    setDescription(result.items.map(i => i.name).join(', ').slice(0, 420));
                  }
                  if (result.items.length > 0) {
                    const itemSum = Math.round(result.items.reduce((s, it) => s + it.price, 0) * 100) / 100;
                    setAmount(itemSum.toFixed(2));
                  } else if (result.total) {
                    setAmount(result.total.toFixed(2));
                  }
                }} />

                {/* Amount with currency picker */}
                <div style={{ marginBottom: '12px' }}>
                  <label className="form-label">{t('stash.amount')}</label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="number"
                      className="form-input"
                      style={{ flex: 1 }}
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      placeholder="0.00"
                      step="0.01"
                      min="0.01"
                      required
                      autoFocus
                    />
                    <div style={{ position: 'relative' }} ref={currencyPickerRef}>
                      <button
                        type="button"
                        className="currency-picker-trigger"
                        onClick={() => setShowCurrencyPicker(!showCurrencyPicker)}
                      >
                        <span>{DISPLAY_CURRENCIES.find(c => c.code === expenseCurrency)?.symbol || '€'}</span>
                        <span className="currency-picker-code">{expenseCurrency}</span>
                        <span style={{ fontSize: '0.7rem' }}>{showCurrencyPicker ? '▲' : '▼'}</span>
                      </button>
                      {showCurrencyPicker && (
                        <div className="currency-picker-menu">
                          <div className="currency-picker-grid">
                            {DISPLAY_CURRENCIES.map(c => (
                              <button
                                key={c.code}
                                type="button"
                                className={`currency-picker-item ${expenseCurrency === c.code ? 'active' : ''}`}
                                onClick={() => {
                                  setExpenseCurrency(c.code);
                                  setShowCurrencyPicker(false);
                                }}
                                title={c.name}
                              >
                                <span className="currency-picker-symbol">{c.symbol}</span>
                                <span className="currency-picker-label">{c.code}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  {expenseCurrency !== 'EUR' && amount && (
                    <div style={{ marginTop: '8px', padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: '8px', fontSize: '0.9rem' }}>
                      {converting ? (
                        <span style={{ color: 'var(--text-secondary)' }}>{t('group.converting')}</span>
                      ) : convertedAmount ? (
                        <span>
                          <strong>€{convertedAmount.toFixed(2)}</strong>
                          <span style={{ color: 'var(--text-secondary)', marginLeft: '8px' }}>
                            (1 {expenseCurrency} = {conversionRate?.toFixed(4)} EUR)
                          </span>
                        </span>
                      ) : (
                        <span style={{ color: 'var(--danger)' }}>{t('group.conversionFailed')}</span>
                      )}
                    </div>
                  )}
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
                    maxLength={420}
                    required
                  />
                </div>

                {/* Category picker */}
                <div style={{ marginBottom: '12px' }}>
                  <label className="form-label">{t('stash.category')}</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {CATEGORIES.map(cat => (
                      <button
                        key={cat.key}
                        type="button"
                        onClick={() => setCategory(cat.key)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '16px',
                          border: category === cat.key ? '2px solid var(--primary)' : '1px solid var(--border)',
                          background: category === cat.key ? 'var(--primary-bg, rgba(99, 102, 241, 0.1))' : 'transparent',
                          color: 'var(--text)',
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <span>{cat.icon}</span>
                        <span>{t(`stash.categories.${cat.key || 'none'}`)}</span>
                      </button>
                    ))}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                    {t('stash.categoryHint')}{' '}
                    <Link to="/suggestions" onClick={closeExpenseModal} style={{ color: 'var(--primary)' }}>
                      {t('stash.suggestionBox')}
                    </Link>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={closeExpenseModal}>
                  {t('common.cancel')}
                </button>
                <button type="submit" className="btn btn-primary" disabled={adding || (expenseCurrency !== 'EUR' && !convertedAmount)}>
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
