import { useState, useEffect, useRef, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { useCurrency, DISPLAY_CURRENCIES } from '../context/CurrencyContext';
import LoadingSpinner from '../components/LoadingSpinner';
import ReceiptScanner from '../components/ReceiptScanner';
import type { StashExpense, StashSummary } from '../types';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList } from 'recharts';

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

const CATEGORY_COLORS: Record<string, string> = {
  food: '#ef4444',
  drinks: '#f97316',
  transport: '#eab308',
  shopping: '#22c55e',
  entertainment: '#3b82f6',
  health: '#ec4899',
  bills: '#a855f7',
  gas: '#64748b',
  travel: '#06b6d4',
  other: '#78716c',
  '': '#9ca3af',
};

function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category] || '#9ca3af';
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
  const [category, setCategory] = useState('shopping');
  const [adding, setAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [clearing, setClearing] = useState(false);

  // Chart view state
  const [chartView, setChartView] = useState<'pills' | 'pie' | 'bar'>('pie');

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
    setCategory('shopping');
    setExpenseCurrency('EUR');
    setConvertedAmount(null);
    setConversionRate(null);
    setShowCurrencyPicker(false);
    setIsEditing(false);
    setEditingId(null);
  };

  const openEditExpense = (e: StashExpense) => {
    setEditingId(e.id);
    setIsEditing(true);
    setAmount(String(e.amount.toFixed(2)));
    setDescription(e.description || '');
    setCategory(e.category || '');
    setExpenseCurrency('EUR');
    setShowExpenseModal(true);
  };

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) return;

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
      if (isEditing && editingId) {
        const res = await api.updateStashExpense(editingId, finalAmount, finalDesc.slice(0, 420), category);
        if (res.data) {
          // Update history list
          if (historyLoaded) {
            setExpenses(prev => prev.map(it => it.id === editingId ? res.data! : it));
          }
          // Adjust summary totals
          setSummary(prev => {
            if (!prev) return prev;
            // find previous amount in list if available
            const prevAmount = expenses.find(it => it.id === editingId)?.amount || 0;
            const delta = finalAmount - prevAmount;
            const cat = category || 'uncategorized';
            const newByCategory = { ...prev.by_category };
            // subtract from old category if changed
            const oldCat = expenses.find(it => it.id === editingId)?.category || 'uncategorized';
            if (oldCat && oldCat !== cat) {
              newByCategory[oldCat] = (newByCategory[oldCat] || 0) - prevAmount;
              if (newByCategory[oldCat] <= 0) delete newByCategory[oldCat];
              newByCategory[cat] = (newByCategory[cat] || 0) + finalAmount;
            } else {
              newByCategory[cat] = (newByCategory[cat] || 0) + delta;
            }
            return {
              ...prev,
              total_spent: prev.total_spent + delta,
              by_category: newByCategory,
            };
          });
        }
      } else {
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
            <button className="btn btn-primary" onClick={() => setShowExpenseModal(true)}>
              + {t('stash.addExpense')}
            </button>
            {(summary?.expense_count || 0) > 0 && (
              <button
                className="btn btn-outline"
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
        {summary && Object.keys(summary.by_category).length > 0 && (() => {
          const chartData = Object.entries(summary.by_category)
            .sort(([, a], [, b]) => b - a)
            .map(([cat, total]) => ({
              name: t(`stash.categories.${cat || 'uncategorized'}`),
              icon: getCategoryIcon(cat),
              value: total,
              color: getCategoryColor(cat),
              key: cat,
            }));

          return (
          <div style={{ padding: '12px 16px' }}>
            {/* Header + Toggle */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>
                {t('stash.byCategory')}
              </div>
              <div style={{
                display: 'flex',
                background: 'var(--card-bg)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                overflow: 'hidden',
              }}>
                {(['pills', 'pie', 'bar'] as const).map((view) => (
                  <button
                    key={view}
                    onClick={() => setChartView(view)}
                    style={{
                      padding: '8px 14px',
                      fontSize: '0.85rem',
                      fontWeight: chartView === view ? '600' : '400',
                      background: chartView === view ? 'var(--primary)' : 'transparent',
                      color: chartView === view ? '#fff' : 'var(--text-muted)',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    {view === 'pills' ? '📋' : view === 'pie' ? '🥧' : '📊'} {t(`stash.view${view.charAt(0).toUpperCase() + view.slice(1)}` as never)}
                  </button>
                ))}
              </div>
            </div>

            {/* Pills View */}
            {chartView === 'pills' && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {chartData.map((item) => (
                  <div
                    key={item.key}
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
                    <span>{item.icon}</span>
                    <span style={{ textTransform: 'capitalize' }}>{item.name}</span>
                    <span style={{ fontWeight: '600', color: 'var(--error-color, #ef4444)' }}>
                      {formatAmount(item.value)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Pie Chart View */}
            {chartView === 'pie' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={chartData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      innerRadius={45}
                      paddingAngle={2}
                      label={({ percent, index }: { percent?: number; index?: number }) => {
                        const pct = ((percent ?? 0) * 100).toFixed(0);
                        const icon = index != null && chartData[index] ? chartData[index].icon : '';
                        return `${icon} ${pct}%`;
                      }}
                      labelLine={true}
                      style={{ fontSize: '0.75rem' }}
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} stroke="var(--card-bg)" strokeWidth={2} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                {/* Legend */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', marginTop: '8px' }}>
                  {chartData.map((item) => (
                    <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem' }}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: item.color }} />
                      <span>{item.icon} {item.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bar Chart View */}
            {chartView === 'bar' && (() => {
              const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#333';
              const mutedColor = getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim() || '#888';
              const totalValue = chartData.reduce((sum, d) => sum + d.value, 0);
              return (
              <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 44)}>
                <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 120, top: 5, bottom: 5 }}>
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={110}
                    tick={{ fontSize: '0.8rem', fill: textColor }}
                    tickFormatter={(name: string) => {
                      const item = chartData.find(d => d.name === name);
                      return item ? `${item.icon} ${name}` : name;
                    }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`bar-${index}`} fill={entry.color} />
                    ))}
                    <LabelList
                      dataKey="value"
                      position="right"
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      formatter={(v: any) => {
                        const num = Number(v) || 0;
                        const pct = totalValue > 0 ? ((num / totalValue) * 100).toFixed(0) : '0';
                        return `${formatAmount(num)} (${pct}%)`;
                      }}
                      style={{ fontSize: '0.8rem', fontWeight: 600, fill: mutedColor }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              );
            })()}
          </div>
          );
        })()}
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
                    {/* Amount + edit/delete */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      <span style={{
                        fontWeight: '600',
                        color: 'var(--error-color, #ef4444)',
                      }}>
                        -{formatAmount(expense.amount)}
                      </span>
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={(e) => { e.stopPropagation(); openEditExpense(expense); }}
                        title={t('stash.editExpense')}
                        style={{ fontSize: '0.9rem' }}
                      >
                        ✎
                      </button>
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={(e) => { e.stopPropagation(); handleDelete(expense.id); }}
                        title={t('common.delete')}
                      >
                        ×
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
              <h3 className="modal-title">{isEditing ? t('stash.editExpense') : t('stash.addExpense')}</h3>
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

                {/* Description (optional) */}
                <div style={{ marginBottom: '12px' }}>
                  <label className="form-label">{t('stash.description')} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({t('common.optional')})</span></label>
                  <input
                    type="text"
                    className="form-input"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder={t('stash.descriptionPlaceholder')}
                    maxLength={420}
                  />
                </div>

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
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={closeExpenseModal}>
                  {t('common.cancel')}
                </button>
                <button type="submit" className="btn btn-primary" disabled={adding || (expenseCurrency !== 'EUR' && !convertedAmount)}>
                  {adding ? t('stash.adding') : isEditing ? t('stash.editExpense') : t('stash.addExpense')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
