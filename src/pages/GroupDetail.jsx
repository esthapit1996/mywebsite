import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useCurrency, DISPLAY_CURRENCIES } from '../context/CurrencyContext';

export default function GroupDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { formatAmount } = useCurrency();
  const [group, setGroup] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [balances, setBalances] = useState([]);
  const [myBalance, setMyBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('expenses');
  const [error, setError] = useState('');
  const [expensePaymentStatus, setExpensePaymentStatus] = useState({}); // {expenseId: {totalOwed, totalPaid}}
  const [activities, setActivities] = useState([]);

  // Modal states
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [showExpenseDetailModal, setShowExpenseDetailModal] = useState(false);

  // Expense detail/payment states
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [expensePayments, setExpensePayments] = useState([]);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [paymentError, setPaymentError] = useState('');

  // Expense form
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDesc, setExpenseDesc] = useState('');
  const [splitType, setSplitType] = useState('equal');
  const [memberSplits, setMemberSplits] = useState({});
  const [expenseCurrency, setExpenseCurrency] = useState('EUR');
  const [convertedAmount, setConvertedAmount] = useState(null);
  const [conversionRate, setConversionRate] = useState(null);
  const [converting, setConverting] = useState(false);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const currencyPickerRef = useRef(null);

  // Settlement form
  const [settleUser, setSettleUser] = useState('');
  const [settleAmount, setSettleAmount] = useState('');
  const [goPayMode, setGoPayMode] = useState('select'); // 'select' or 'freeform'

  // Add member
  const [allUsers, setAllUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState('');

  useEffect(() => {
    loadData();
  }, [id]);

  // Close currency picker when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (currencyPickerRef.current && !currencyPickerRef.current.contains(event.target)) {
        setShowCurrencyPicker(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Convert currency when amount or currency changes
  useEffect(() => {
    const convertCurrency = async () => {
      if (!expenseAmount || expenseCurrency === 'EUR') {
        setConvertedAmount(null);
        setConversionRate(null);
        return;
      }
      
      setConverting(true);
      try {
        const result = await api.convertCurrency(expenseCurrency, 'EUR', expenseAmount);
        setConvertedAmount(result.converted);
        setConversionRate(result.rate);
      } catch (err) {
        console.error('Conversion error:', err);
        setConvertedAmount(null);
        setConversionRate(null);
      } finally {
        setConverting(false);
      }
    };

    const timeoutId = setTimeout(convertCurrency, 300);
    return () => clearTimeout(timeoutId);
  }, [expenseAmount, expenseCurrency]);

  const loadData = async () => {
    try {
      // Fetch ALL data in parallel - single call for payment statuses instead of N+1
      // Non-critical requests have .catch() so they don't break the page
      const [groupRes, expensesRes, balancesRes, myBalanceRes, paymentStatusRes, activitiesRes] = await Promise.all([
        api.getGroup(id),
        api.getExpenses(id),
        api.getGroupBalances(id).catch(() => ({ data: { balances: [] } })),
        api.getMyBalance(id).catch(() => ({ data: { balance: 0 } })),
        api.getGroupExpensePaymentStatuses(id).catch(() => ({ data: {} })),
        api.getGroupActivities(id).catch(() => ({ data: [] })),
      ]);
      
      setGroup(groupRes.data);
      setExpenses(expensesRes.data || []);
      setBalances(balancesRes.data?.balances || []);
      setMyBalance(myBalanceRes.data?.balance || 0);
      
      // Payment statuses come as {expense_id: {total_owed, total_paid}}
      const statusData = paymentStatusRes.data || {};
      const statusMap = {};
      Object.entries(statusData).forEach(([expenseId, status]) => {
        statusMap[expenseId] = { totalOwed: status.total_owed, totalPaid: status.total_paid };
      });
      setExpensePaymentStatus(statusMap);
      
      setActivities(activitiesRes.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadAllUsers = async () => {
    try {
      const res = await api.getAllUsers();
      setAllUsers(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const closeExpenseModal = () => {
    setShowExpenseModal(false);
    setExpenseAmount('');
    setExpenseDesc('');
    setSplitType('equal');
    setMemberSplits({});
    setExpenseCurrency('EUR');
    setConvertedAmount(null);
    setConversionRate(null);
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    try {
      // Use converted amount for non-EUR currencies
      const finalAmount = expenseCurrency === 'EUR' ? expenseAmount : convertedAmount;
      if (!finalAmount) {
        setError('Please wait for currency conversion');
        return;
      }

      // Add original currency info to description if converted
      let finalDesc = expenseDesc;
      if (expenseCurrency !== 'EUR') {
        const currencySymbol = CURRENCIES.find(c => c.code === expenseCurrency)?.symbol || expenseCurrency;
        finalDesc = `${expenseDesc} (${currencySymbol}${expenseAmount} ${expenseCurrency})`;
      }

      let splitWith = [];
      
      if (splitType === 'percentage') {
        // Validate percentages add up to 100
        const totalPercent = Object.values(memberSplits).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
        if (Math.abs(totalPercent - 100) > 0.01) {
          setError('Percentages must add up to 100%');
          return;
        }
        // Convert to split_with format
        splitWith = Object.entries(memberSplits).map(([userId, percent]) => ({
          user_id: parseInt(userId),
          amount: parseFloat(percent) || 0
        }));
      }
      await api.createExpense(id, finalAmount, finalDesc, splitType, splitWith);
      closeExpenseModal();
      await loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSettle = async (e) => {
    e.preventDefault();
    try {
      await api.createSettlement(id, parseInt(settleUser), settleAmount);
      setShowSettleModal(false);
      setSettleUser('');
      setSettleAmount('');
      await loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    try {
      await api.addMember(id, parseInt(selectedUser));
      setShowMemberModal(false);
      setSelectedUser('');
      await loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRemoveMember = async (memberId, memberName) => {
    if (!confirm(`Remove ${memberName} from the group?`)) return;
    try {
      await api.removeMember(id, memberId);
      await loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteExpense = async (expenseId) => {
    if (!confirm('Delete this expense?')) return;
    try {
      await api.deleteExpense(id, expenseId);
      await loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteGroup = async () => {
    if (balances.length > 0) {
      alert('You naughty naughty, you teasing me. Balance has not been settled yet!');
      return;
    }
    if (!confirm('Delete this group? This cannot be undone.')) return;
    try {
      await api.deleteGroup(id);
      navigate('/');
    } catch (err) {
      setError(err.message);
    }
  };

  const openExpenseDetail = async (expense) => {
    setPaymentAmount('');
    setPaymentNote('');
    setPaymentError('');
    setShowExpenseDetailModal(true);
    try {
      // Fetch full expense details (includes splits with user info)
      const [expenseRes, paymentsRes] = await Promise.all([
        api.getExpense(id, expense.id),
        api.getExpensePayments(expense.id)
      ]);
      setSelectedExpense(expenseRes.data || expense);
      setExpensePayments(paymentsRes.data || []);
    } catch (err) {
      setSelectedExpense(expense);
      setExpensePayments([]);
    }
  };

  const handleMakePayment = async (e) => {
    e.preventDefault();
    if (!selectedExpense) return;
    setPaymentError('');
    try {
      await api.createExpensePayment(selectedExpense.id, paymentAmount, paymentNote);
      setPaymentAmount('');
      setPaymentNote('');
      // Reload all data (which includes payment status and activities)
      await loadData();
      // Refresh payments for modal after loadData completes
      const res = await api.getExpensePayments(selectedExpense.id);
      setExpensePayments(res.data || []);
    } catch (err) {
      setPaymentError(err.message);
    }
  };

  const handleDeletePayment = async (paymentId) => {
    if (!confirm('Delete this payment?')) return;
    try {
      await api.deleteExpensePayment(paymentId);
      // Reload all data (which includes payment status and activities)
      await loadData();
      // Refresh payments for modal after loadData completes
      const res = await api.getExpensePayments(selectedExpense.id);
      setExpensePayments(res.data || []);
    } catch (err) {
      setError(err.message);
    }
  };

  // Calculate user's remaining debt for an expense
  const getUserDebtForExpense = (expense) => {
    if (!expense.splits || expense.paid_by === user?.id) return 0;
    const userSplit = expense.splits.find(s => s.user_id === user?.id);
    if (!userSplit) return 0;
    const paidBack = expensePayments
      .filter(p => p.paid_by === user?.id)
      .reduce((sum, p) => sum + p.amount, 0);
    return Math.max(0, userSplit.amount - paidBack);
  };

  // Check if an expense is fully paid (all non-payer splits have been paid back)
  const isExpenseFullyPaid = () => {
    if (!selectedExpense?.splits) return false;
    // Total owed by non-payers (people who didn't pay the expense)
    const totalOwed = selectedExpense.splits
      .filter(s => s.user_id !== selectedExpense.paid_by)
      .reduce((sum, s) => sum + s.amount, 0);
    // Total paid back
    const totalPaidBack = expensePayments.reduce((sum, p) => sum + p.amount, 0);
    return totalPaidBack >= totalOwed - 0.01; // Small tolerance for floating point
  };

  // Get debts where current user owes money to someone
  const getMyDebts = () => {
    return balances.filter(b => b.from_user?.id === user?.id);
  };

  // Get expenses where user owes money (has a split and is not the payer)
  const getMyExpenseDebts = () => {
    return expenses.filter(expense => {
      // Use == for type-coerced comparison (id might be int or string)
      if (expense.paid_by == user?.id) return false; // User paid this expense
      if (!expense.splits || expense.splits.length === 0) return false;
      const userSplit = expense.splits.find(s => s.user_id == user?.id);
      if (!userSplit) return false; // User not in split
      
      // Check remaining debt using payment status
      const status = expensePaymentStatus[expense.id];
      if (status && status.totalPaid >= status.totalOwed - 0.01) return false; // Fully paid
      
      return true;
    }).map(expense => {
      const userSplit = expense.splits.find(s => s.user_id == user?.id);
      const payer = group.members?.find(m => m.id == expense.paid_by);
      return {
        expense,
        splitAmount: userSplit?.amount || 0,
        payerName: payer?.name || 'Unknown'
      };
    });
  };

  const selectDebtToPay = (debt) => {
    setSettleUser(debt.to_user.id.toString());
    setSettleAmount(debt.amount.toFixed(2));
    setGoPayMode('freeform');
  };

  // Use global currency display from context
  const formatCurrency = (amount) => formatAmount(amount);

  const getActivityIcon = (actionType) => {
    switch (actionType) {
      case 'expense_created': return '💰';
      case 'expense_deleted': return '🗑️';
      case 'settlement': return '🤝';
      case 'payment': return '💵';
      case 'member_added': return '👋';
      case 'member_removed': return '👤';
      case 'group_created': return '🎉';
      default: return '📝';
    }
  };

  const getActivityColor = (actionType) => {
    switch (actionType) {
      case 'expense_created': return 'var(--card-bg)';
      case 'expense_deleted': return 'var(--card-bg)';
      case 'settlement': return 'var(--card-bg)';
      case 'payment': return 'var(--card-bg)';
      case 'member_added': return 'var(--card-bg)';
      case 'member_removed': return 'var(--card-bg)';
      default: return 'var(--card-bg)';
    }
  };

  const formatActivityMessage = (activity) => {
    const userName = activity.user?.name || 'Someone';
    const relatedName = activity.related_user?.name || 'someone';
    
    switch (activity.action_type) {
      case 'expense_created':
        return `${userName} added expense: "${activity.description}"`;
      case 'expense_deleted':
        return `${userName} deleted expense: "${activity.description}"`;
      case 'settlement':
        return `${userName} made a free-form payment to ${relatedName}`;
      case 'payment':
        return `${userName} paid ${relatedName} - ${activity.description}`;
      case 'member_added':
        return `${userName} added ${relatedName} to the group`;
      case 'member_removed':
        return `${userName} removed ${relatedName} from the group`;
      case 'group_created':
        return `${userName} created the group`;
      default:
        return activity.description;
    }
  };

  if (loading) {
    return (
      <div className="container">
        <div className="card text-center" style={{ padding: '60px 20px' }}>
          <div className="loading-spinner" style={{
            width: '40px',
            height: '40px',
            border: '4px solid var(--border)',
            borderTop: '4px solid var(--primary)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }} />
          <p style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>Fetching your data...</p>
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

  if (!group) {
    return (
      <div className="container">
        <div className="card">
          <div className="alert alert-error">Group not found</div>
          <button className="btn btn-outline" onClick={() => navigate('/')}>
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      {error && <div className="alert alert-error">{error}</div>}

      {/* Group Header */}
      <div className="card">
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '2rem' }}>{group.emoji || '💰'}</span>
            <div>
              <h2 className="card-title" style={{ margin: 0 }}>{group.name}</h2>
              {group.description && <p className="text-muted" style={{ margin: 0 }}>{group.description}</p>}
            </div>
          </div>
          <button className="btn btn-outline btn-sm" onClick={() => navigate('/')}>
            ← Back
          </button>
        </div>

        {/* Members */}
        <div style={{ marginTop: '12px' }}>
          {group.members?.map((member) => (
            <span key={member.id} className="member-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <span className="member-avatar">{member.name.charAt(0)}</span>
              {member.name}
              {member.id !== user?.id && (
                <button
                  onClick={() => handleRemoveMember(member.id, member.name)}
                  style={{ 
                    background: 'none', 
                    border: 'none', 
                    cursor: 'pointer', 
                    padding: '0 4px',
                    color: 'var(--text-muted)',
                    fontSize: '14px',
                    lineHeight: 1
                  }}
                  title="Remove member"
                >
                  ×
                </button>
              )}
            </span>
          ))}
          <button
            className="member-badge"
            style={{ cursor: 'pointer', border: 'none', background: 'var(--primary)', color: 'white' }}
            onClick={() => {
              loadAllUsers();
              setShowMemberModal(true);
            }}
          >
            + Add
          </button>
        </div>
      </div>

      {/* Balance Card */}
      <div className="card balance-card">
        <div className="balance-label">Your balance</div>
        <div className={`balance-amount ${myBalance > 0 ? 'balance-positive' : myBalance < 0 ? 'balance-negative' : 'balance-zero'}`}>
          {myBalance >= 0 ? '+' : ''}{formatCurrency(myBalance)}
        </div>
        <p className="text-muted" style={{ marginTop: '8px' }}>
          {myBalance > 0 ? 'You are owed money' : myBalance < 0 ? 'You owe money' : 'All balanced!'}
        </p>
        <button
          className="btn btn-outline btn-sm"
          style={{ marginTop: '12px', color: 'var(--danger)', borderColor: 'var(--danger)' }}
          onClick={handleDeleteGroup}
        >
          Delete Group
        </button>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 mb-4">
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setShowExpenseModal(true)}>
          + Add Expense
        </button>
        <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { setGoPayMode('select'); setShowSettleModal(true); }}>
          🐹 Go Pay!
        </button>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab ${activeTab === 'expenses' ? 'active' : ''}`} onClick={() => setActiveTab('expenses')}>
          Expenses
        </button>
        <button className={`tab ${activeTab === 'balances' ? 'active' : ''}`} onClick={() => setActiveTab('balances')}>
          Balances
        </button>
        <button className={`tab ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
          History
        </button>
      </div>

      {/* Tab Content */}
      <div className="card">
        {activeTab === 'expenses' && (
          <>
            {activities.some(a => a.action_type === 'settlement') && (
              <div style={{ 
                padding: '12px 16px', 
                background: 'var(--card-bg)', 
                borderBottom: '1px solid var(--border-color)',
                color: 'var(--text-secondary)',
                fontSize: '0.9rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span>⚠️</span>
                <span>Attention! Free-form Payment was used. Please check history for details.</span>
              </div>
            )}
            {expenses.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">💸</div>
                <h3>No expenses yet</h3>
                <p>Add your first expense to get started.</p>
              </div>
            ) : (
              expenses.map((expense) => (
                <div 
                  key={expense.id} 
                  className="expense-item" 
                  style={{ cursor: 'pointer' }}
                  onClick={() => openExpenseDetail(expense)}
                >
                  <div className="expense-info">
                    <div className="expense-description">{expense.description}</div>
                    <div className="expense-meta">
                      Paid by {expense.paid_by_user?.name || 'Unknown'} • {expense.split_type}
                    </div>
                    {expensePaymentStatus[expense.id] && 
                      expensePaymentStatus[expense.id].totalOwed > 0 && 
                      expensePaymentStatus[expense.id].totalPaid >= expensePaymentStatus[expense.id].totalOwed - 0.01 && (
                        <div style={{ color: 'var(--success)', fontSize: '0.85rem', marginTop: '4px' }}>✅ Settlements were made</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span className="expense-amount">{formatCurrency(expense.amount)}</span>
                    <button 
                      className="btn btn-outline btn-sm" 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteExpense(expense.id);
                      }}
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {activeTab === 'balances' && (
          <>
            {balances.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">✅</div>
                <h3>All settled up!</h3>
                <p>No one owes anyone money.</p>
              </div>
            ) : (
              balances.map((balance, idx) => (
                <div key={idx} className="expense-item">
                  <div className="expense-info">
                    <div className="expense-description">
                      {balance.from_user?.name} owes {balance.to_user?.name}
                    </div>
                  </div>
                  <span className="expense-amount negative">{formatCurrency(balance.amount)}</span>
                </div>
              ))
            )}
          </>
        )}

        {activeTab === 'history' && (
          <>
            {activities.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📜</div>
                <h3>No activity yet</h3>
                <p>Activity history will appear here.</p>
              </div>
            ) : (
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {activities.map((activity) => (
                  <div key={activity.id} style={{ 
                    padding: '12px', 
                    borderBottom: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px'
                  }}>
                    <div style={{ 
                      width: '36px', 
                      height: '36px', 
                      borderRadius: '50%', 
                      background: getActivityColor(activity.action_type),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '16px',
                      flexShrink: 0
                    }}>
                      {getActivityIcon(activity.action_type)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '500' }}>
                        {formatActivityMessage(activity)}
                      </div>
                      {activity.amount && (
                        <div style={{ color: 'var(--primary)', fontWeight: '600' }}>
                          {formatCurrency(activity.amount)}
                        </div>
                      )}
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {new Date(activity.created_at).toLocaleString()}
                      </div>
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
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Add Expense</h3>
              <button className="modal-close" onClick={closeExpenseModal}>×</button>
            </div>
            <form onSubmit={handleAddExpense}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <input
                    type="text"
                    className="form-input"
                    value={expenseDesc}
                    onChange={(e) => setExpenseDesc(e.target.value)}
                    placeholder="e.g., Dinner"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Amount</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="number"
                      className="form-input"
                      style={{ flex: 1 }}
                      value={expenseAmount}
                      onChange={(e) => setExpenseAmount(e.target.value)}
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
                  {expenseCurrency !== 'EUR' && expenseAmount && (
                    <div style={{ marginTop: '8px', padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: '8px', fontSize: '0.9rem' }}>
                      {converting ? (
                        <span style={{ color: 'var(--text-secondary)' }}>Converting...</span>
                      ) : convertedAmount ? (
                        <span>
                          <strong>€{convertedAmount.toFixed(2)}</strong>
                          <span style={{ color: 'var(--text-secondary)', marginLeft: '8px' }}>
                            (1 {expenseCurrency} = {conversionRate?.toFixed(4)} EUR)
                          </span>
                        </span>
                      ) : (
                        <span style={{ color: 'var(--danger)' }}>Conversion failed</span>
                      )}
                    </div>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">How to split?</label>
                  <select
                    className="form-select"
                    value={splitType}
                    onChange={(e) => {
                      setSplitType(e.target.value);
                      if (e.target.value === 'percentage' && group?.members) {
                        // Initialize with equal split by default
                        const initialSplits = {};
                        const share = (100 / group.members.length).toFixed(1);
                        group.members.forEach(m => {
                          initialSplits[m.id] = share;
                        });
                        setMemberSplits(initialSplits);
                      }
                    }}
                  >
                    <option value="equal">Split equally</option>
                    <option value="percentage">Custom split</option>
                  </select>
                </div>
                {splitType === 'percentage' && group?.members && (
                  <div className="form-group">
                    <label className="form-label">Who owes what? (must total 100%)</label>
                    
                    {/* Quick preset buttons */}
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => {
                          const share = (100 / group.members.length).toFixed(1);
                          const splits = {};
                          group.members.forEach(m => { splits[m.id] = share; });
                          setMemberSplits(splits);
                        }}
                      >
                        Split equally
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => {
                          const others = group.members.filter(m => m.id !== user?.id);
                          const share = others.length > 0 ? (100 / others.length).toFixed(1) : '0';
                          const splits = {};
                          group.members.forEach(m => {
                            splits[m.id] = m.id === user?.id ? '0' : share;
                          });
                          setMemberSplits(splits);
                        }}
                      >
                        Others owe me 100%
                      </button>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '10px', padding: '10px', background: 'var(--card-bg)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                      <strong>You are paying {expenseAmount ? (
                        expenseCurrency === 'EUR' 
                          ? `€${expenseAmount}` 
                          : `${CURRENCIES.find(c => c.code === expenseCurrency)?.symbol || ''}${expenseAmount} ${expenseCurrency}${convertedAmount ? ` (€${convertedAmount.toFixed(2)})` : ''}`
                      ) : 'this expense'}.</strong><br/>
                      Enter what % each person <em>owes</em>.<br/>
                      • Put <strong>0% on yourself</strong> if you want full reimbursement<br/>
                      • Put <strong>50% each</strong> to split fairly<br/>
                      • Put <strong>100% on yourself</strong> = no one owes you anything
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {group.members.map((member) => (
                        <div key={member.id} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ minWidth: '120px', fontWeight: member.id === user?.id ? 'bold' : 'normal' }}>
                            {member.name} {member.id === user?.id ? '(you)' : ''}
                          </span>
                          <input
                            type="number"
                            className="form-input"
                            style={{ width: '120px' }}
                            value={memberSplits[member.id] || ''}
                            onChange={(e) => setMemberSplits(prev => ({
                              ...prev,
                              [member.id]: e.target.value
                            }))}
                            placeholder="0"
                            min="0"
                            max="100"
                            step="0.01"
                          />
                          <span>%</span>
                          {expenseAmount && memberSplits[member.id] && (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                              = €{((expenseCurrency === 'EUR' ? parseFloat(expenseAmount) : (convertedAmount || 0)) * parseFloat(memberSplits[member.id]) / 100).toFixed(2)}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: '8px', fontSize: '0.9rem', color: Object.values(memberSplits).reduce((sum, val) => sum + (parseFloat(val) || 0), 0) === 100 ? 'var(--primary)' : 'var(--danger)' }}>
                      Total: {Object.values(memberSplits).reduce((sum, val) => sum + (parseFloat(val) || 0), 0).toFixed(1)}% {Object.values(memberSplits).reduce((sum, val) => sum + (parseFloat(val) || 0), 0) === 100 ? '✓' : '(must equal 100%)'}
                    </div>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={closeExpenseModal}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">Add Expense</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Go Pay! Modal */}
      {showSettleModal && (
        <div className="modal-overlay" onClick={() => setShowSettleModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">🐹 Go Pay!</h3>
              <button className="modal-close" onClick={() => setShowSettleModal(false)}>×</button>
            </div>
            
            {goPayMode === 'select' ? (
              <div className="modal-body">
                {getMyExpenseDebts().length > 0 ? (
                  <>
                    <p style={{ marginBottom: '16px', color: 'var(--text-secondary)' }}>Expenses you owe on:</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '300px', overflowY: 'auto' }}>
                      {getMyExpenseDebts().map(({ expense, splitAmount, payerName }) => (
                        <div 
                          key={expense.id} 
                          style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center',
                            padding: '12px',
                            background: 'var(--card-bg)',
                            borderRadius: '8px',
                            border: '1px solid var(--border)'
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {expense.description}
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                              Paid by {payerName}
                            </div>
                            <div style={{ color: 'var(--danger)', fontSize: '14px' }}>
                              Your share: {formatCurrency(splitAmount)}
                            </div>
                          </div>
                          <button 
                            className="btn btn-primary btn-sm"
                            style={{ marginLeft: '12px' }}
                            onClick={() => { setShowSettleModal(false); openExpenseDetail(expense); }}
                          >
                            Pay
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '20px 0' }}>
                    🎉 You don't owe on any expenses!
                  </p>
                )}
                <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                  <button 
                    className="btn btn-outline" 
                    style={{ width: '100%' }}
                    onClick={() => { setSettleUser(''); setSettleAmount(''); setGoPayMode('freeform'); }}
                  >
                    Free-form Payment
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSettle}>
                <div className="modal-body">
                  <button 
                    type="button"
                    className="btn btn-outline btn-sm"
                    style={{ marginBottom: '16px' }}
                    onClick={() => setGoPayMode('select')}
                  >
                    ← Back to expenses
                  </button>
                  <div className="form-group">
                    <label className="form-label">Pay to</label>
                    <select
                      className="form-select"
                      value={settleUser}
                      onChange={(e) => setSettleUser(e.target.value)}
                      required
                    >
                      <option value="">Select member</option>
                      {group.members?.filter(m => m.id !== user?.id).map((member) => (
                        <option key={member.id} value={member.id}>{member.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Amount</label>
                    <input
                      type="number"
                      className="form-input"
                      value={settleAmount}
                      onChange={(e) => setSettleAmount(e.target.value)}
                      placeholder="0.00"
                      step="0.01"
                      min="0.01"
                      required
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-outline" onClick={() => setShowSettleModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-secondary">Record Payment</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {showMemberModal && (
        <div className="modal-overlay" onClick={() => setShowMemberModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Add Member</h3>
              <button className="modal-close" onClick={() => setShowMemberModal(false)}>×</button>
            </div>
            <form onSubmit={handleAddMember}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Select User</label>
                  <select
                    className="form-select"
                    value={selectedUser}
                    onChange={(e) => setSelectedUser(e.target.value)}
                    required
                  >
                    <option value="">Select a user</option>
                    {allUsers
                      .filter((u) => !group.members?.some((m) => m.id === u.id))
                      .map((u) => (
                        <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                      ))}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowMemberModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">Add Member</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Expense Detail/Payment Modal */}
      {showExpenseDetailModal && selectedExpense && (
        <div className="modal-overlay" onClick={() => setShowExpenseDetailModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3 className="modal-title">{selectedExpense.description}</h3>
              <button className="modal-close" onClick={() => setShowExpenseDetailModal(false)}>×</button>
            </div>
            <div className="modal-body">
              {/* Expense Summary */}
              <div style={{ background: 'var(--card-bg)', padding: '12px', borderRadius: '8px', marginBottom: '16px', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span>Total Amount:</span>
                  <strong>{formatCurrency(selectedExpense.amount)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span>Paid by:</span>
                  <strong>{selectedExpense.paid_by_user?.name || 'Unknown'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Split type:</span>
                  <span>{selectedExpense.split_type}</span>
                </div>
              </div>

              {/* Split Details */}
              {selectedExpense.splits && selectedExpense.splits.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <h4 style={{ marginBottom: '8px', fontSize: '0.95rem' }}>Who owes what:</h4>
                  {selectedExpense.splits.map((split) => (
                    <div key={split.user_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                      <span>{split.user?.name || `User ${split.user_id}`}</span>
                      <span>{formatCurrency(split.amount)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Payment History */}
              <div style={{ marginBottom: '16px' }}>
                <h4 style={{ marginBottom: '8px', fontSize: '0.95rem' }}>
                  Payment History {expensePayments.length > 0 && `(${expensePayments.length})`}
                </h4>
                {expensePayments.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No payments recorded yet</div>
                ) : (
                  <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                    {expensePayments.map((payment) => (
                      <div key={payment.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', background: 'var(--card-bg)', borderRadius: '6px', marginBottom: '6px', border: '1px solid var(--success)' }}>
                        <div>
                          <div style={{ fontWeight: '500' }}>
                            {payment.paid_by_user?.name} paid {formatCurrency(payment.amount)}
                          </div>
                          {payment.note && <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{payment.note}</div>}
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {new Date(payment.created_at).toLocaleDateString()}
                          </div>
                        </div>
                        {payment.paid_by === user?.id && (
                          <button 
                            className="btn btn-outline btn-sm" 
                            style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
                            onClick={() => handleDeletePayment(payment.id)}
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Fully Paid Message */}
              {isExpenseFullyPaid() && (
                <div style={{ 
                  background: 'var(--card-bg)', 
                  border: '2px solid var(--success)', 
                  borderRadius: '8px', 
                  padding: '16px', 
                  textAlign: 'center',
                  marginBottom: '16px'
                }}>
                  <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>✅</div>
                  <div style={{ fontWeight: '600', color: 'var(--success)', marginBottom: '4px' }}>
                    Everything was paid!
                  </div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    You may remove this expense :)
                  </div>
                </div>
              )}

              {/* Make Payment Form - only show if user owes money and not fully paid */}
              {selectedExpense.paid_by !== user?.id && !isExpenseFullyPaid() && (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                  <h4 style={{ marginBottom: '12px', fontSize: '0.95rem' }}>Pay Back Your Share</h4>
                  {paymentError && (
                    <div className="alert alert-error" style={{ marginBottom: '12px', padding: '10px', fontSize: '0.9rem' }}>
                      {paymentError}
                    </div>
                  )}
                  <form onSubmit={handleMakePayment}>
                    <div className="form-group">
                      <label className="form-label">Amount</label>
                      <input
                        type="number"
                        className="form-input"
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                        placeholder="0.00"
                        step="0.01"
                        min="0.01"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Note (optional)</label>
                      <input
                        type="text"
                        className="form-input"
                        value={paymentNote}
                        onChange={(e) => setPaymentNote(e.target.value)}
                        placeholder="e.g., Paid in cash"
                      />
                    </div>
                    <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                      Record Payment
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
