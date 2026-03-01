import { useState, useEffect, useRef, FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useCurrency, DISPLAY_CURRENCIES } from '../context/CurrencyContext';
import type { 
  Group, 
  GroupMember, 
  Expense, 
  Balance, 
  ExpensePayment,
  PaymentStatus,
  CurrencyInfo,
  Settlement
} from '../types';

// Local type for activities since it has nested user objects
interface Activity {
  id: number;
  group_id: number;
  user_id: number;
  action_type: string;
  description: string;
  amount?: number;
  created_at: string;
  user?: { id: number; name: string };
  related_user?: { id: number; name: string };
}

interface ExpenseWithUser extends Expense {
  paid_by_user?: { name: string };
}

interface ExpenseSplitWithUser {
  user_id: number;
  amount: number;
  user?: { name: string };
}

interface ExpenseDetail extends Expense {
  paid_by_user?: { name: string };
  splits?: ExpenseSplitWithUser[];
}

interface ExpensePaymentWithUsers extends ExpensePayment {
  paid_by_user?: { name: string };
}

interface User {
  id: number;
  name: string;
  email: string;
}

interface ExpenseDebt {
  expense: ExpenseWithUser;
  splitAmount: number;
  payerName: string;
}

const CURRENCIES: CurrencyInfo[] = DISPLAY_CURRENCIES;

export default function GroupDetail(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { formatAmount } = useCurrency();
  const [group, setGroup] = useState<Group | null>(null);
  const [expenses, setExpenses] = useState<ExpenseWithUser[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [myBalance, setMyBalance] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'expenses' | 'balances' | 'history'>('expenses');
  const [error, setError] = useState<string>('');
  const [expensePaymentStatus, setExpensePaymentStatus] = useState<Record<number, PaymentStatus>>({});
  const [activities, setActivities] = useState<Activity[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);

  // Edit group states
  const [editingGroup, setEditingGroup] = useState<boolean>(false);
  const [editName, setEditName] = useState<string>('');
  const [editDescription, setEditDescription] = useState<string>('');

  // Modal states
  const [showExpenseModal, setShowExpenseModal] = useState<boolean>(false);
  const [showSettleModal, setShowSettleModal] = useState<boolean>(false);
  const [showMemberModal, setShowMemberModal] = useState<boolean>(false);
  const [showExpenseDetailModal, setShowExpenseDetailModal] = useState<boolean>(false);

  // Expense detail/payment states
  const [selectedExpense, setSelectedExpense] = useState<ExpenseDetail | null>(null);
  const [expensePayments, setExpensePayments] = useState<ExpensePaymentWithUsers[]>([]);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentNote, setPaymentNote] = useState<string>('');
  const [paymentError, setPaymentError] = useState<string>('');

  // Expense form
  const [expenseAmount, setExpenseAmount] = useState<string>('');
  const [expenseDesc, setExpenseDesc] = useState<string>('');
  const [splitType, setSplitType] = useState<'equal' | 'percentage'>('equal');
  const [memberSplits, setMemberSplits] = useState<Record<number, string>>({});
  const [expenseCurrency, setExpenseCurrency] = useState<string>('EUR');
  const [convertedAmount, setConvertedAmount] = useState<number | null>(null);
  const [conversionRate, setConversionRate] = useState<number | null>(null);
  const [converting, setConverting] = useState<boolean>(false);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState<boolean>(false);
  const [expensePaidBy, setExpensePaidBy] = useState<number>(0);
  const currencyPickerRef = useRef<HTMLDivElement>(null);

  // Settlement form
  const [settleUser, setSettleUser] = useState<string>('');
  const [settleAmount, setSettleAmount] = useState<string>('');
  const [goPayMode, setGoPayMode] = useState<'select' | 'freeform'>('select');

  // Add member
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('');

  useEffect(() => {
    loadData();
  }, [id]);

  // Close currency picker when clicking outside
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
      const [groupRes, expensesRes, balancesRes, myBalanceRes, paymentStatusRes, activitiesRes, settlementsRes] = await Promise.all([
        api.getGroup(id!),
        api.getExpenses(id!),
        api.getGroupBalances(id!).catch(() => ({ data: { balances: [] } })),
        api.getMyBalance(id!).catch(() => ({ data: { balance: 0 } })),
        api.getGroupExpensePaymentStatuses(id!).catch(() => ({ data: {} })),
        api.getGroupActivities(id!).catch(() => ({ data: [] })),
        api.getSettlements(id!).catch(() => ({ data: [] })),
      ]);
      
      setGroup(groupRes.data || null);
      setExpenses(expensesRes.data || []);
      setBalances(balancesRes.data?.balances || []);
      setMyBalance(myBalanceRes.data?.balance || 0);
      
      const statusData = paymentStatusRes.data || {};
      const statusMap: Record<number, PaymentStatus> = {};
      Object.entries(statusData).forEach(([expenseId, status]: [string, any]) => {
        statusMap[parseInt(expenseId)] = { totalOwed: status.total_owed, totalPaid: status.total_paid };
      });
      setExpensePaymentStatus(statusMap);
      
      setActivities(activitiesRes.data || []);
      setSettlements(settlementsRes.data || []);
    } catch (err: any) {
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
    setExpensePaidBy(0);
  };

  const handleAddExpense = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const finalAmount = expenseCurrency === 'EUR' ? expenseAmount : convertedAmount;
      if (!finalAmount) {
        setError('Please wait for currency conversion');
        return;
      }

      let finalDesc = expenseDesc;
      if (expenseCurrency !== 'EUR') {
        const currencySymbol = CURRENCIES.find(c => c.code === expenseCurrency)?.symbol || expenseCurrency;
        finalDesc = `${expenseDesc} (${currencySymbol}${expenseAmount} ${expenseCurrency})`;
      }

      let splitWith: Array<{ user_id: number; amount: number }> = [];
      
      if (splitType === 'percentage') {
        const totalPercent = Object.values(memberSplits).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
        if (Math.abs(totalPercent - 100) > 0.01) {
          setError('Percentages must add up to 100%');
          return;
        }
        splitWith = Object.entries(memberSplits).map(([userId, percent]) => ({
          user_id: parseInt(userId),
          amount: parseFloat(percent) || 0
        }));
      }
      await api.createExpense(id!, finalAmount, finalDesc, splitType, splitWith, expensePaidBy || undefined);
      closeExpenseModal();
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleSettle = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api.createSettlement(id!, parseInt(settleUser), settleAmount);
      setShowSettleModal(false);
      setSettleUser('');
      setSettleAmount('');
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleAddMember = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api.addMember(id!, parseInt(selectedUser));
      setShowMemberModal(false);
      setSelectedUser('');
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRemoveMember = async (memberId: number, memberName: string) => {
    if (!confirm(`Remove ${memberName} from the group?`)) return;
    try {
      await api.removeMember(id!, memberId);
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteExpense = async (expenseId: number) => {
    if (!confirm('Delete this expense?')) return;
    try {
      await api.deleteExpense(id!, expenseId);
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteSettlement = async (settlementId: number) => {
    if (!confirm('Delete this free-form payment?')) return;
    try {
      await api.deleteSettlement(id!, settlementId);
      await loadData();
    } catch (err: any) {
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
      await api.deleteGroup(id!);
      navigate('/');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const openExpenseDetail = async (expense: ExpenseWithUser) => {
    setPaymentAmount('');
    setPaymentNote('');
    setPaymentError('');
    setShowExpenseDetailModal(true);
    try {
      const [expenseRes, paymentsRes] = await Promise.all([
        api.getExpense(id!, expense.id),
        api.getExpensePayments(expense.id)
      ]);
      setSelectedExpense(expenseRes.data || expense);
      setExpensePayments(paymentsRes.data || []);
    } catch (err) {
      setSelectedExpense(expense as ExpenseDetail);
      setExpensePayments([]);
    }
  };

  const handleMakePayment = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedExpense) return;
    setPaymentError('');
    try {
      await api.createExpensePayment(selectedExpense.id, paymentAmount, paymentNote);
      setPaymentAmount('');
      setPaymentNote('');
      await loadData();
      const res = await api.getExpensePayments(selectedExpense.id);
      setExpensePayments(res.data || []);
    } catch (err: any) {
      setPaymentError(err.message);
    }
  };

  const handleDeletePayment = async (paymentId: number) => {
    if (!confirm('Delete this payment?')) return;
    try {
      await api.deleteExpensePayment(paymentId);
      await loadData();
      const res = await api.getExpensePayments(selectedExpense!.id);
      setExpensePayments(res.data || []);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const isExpenseFullyPaid = (): boolean => {
    if (!selectedExpense?.splits) return false;
    const totalOwed = selectedExpense.splits
      .filter(s => s.user_id !== selectedExpense.paid_by)
      .reduce((sum, s) => sum + s.amount, 0);
    const totalPaidBack = expensePayments.reduce((sum, p) => sum + p.amount, 0);
    return totalPaidBack >= totalOwed - 0.01;
  };

  const getMyExpenseDebts = (): ExpenseDebt[] => {
    return expenses.filter(expense => {
      if (expense.paid_by == user?.id) return false;
      if (!expense.splits || expense.splits.length === 0) return false;
      const userSplit = expense.splits.find(s => s.user_id == user?.id);
      if (!userSplit) return false;
      
      const status = expensePaymentStatus[expense.id];
      if (status && status.totalPaid >= status.totalOwed - 0.01) return false;
      
      return true;
    }).map(expense => {
      const userSplit = expense.splits!.find(s => s.user_id == user?.id);
      const payer = group?.members?.find(m => m.id == expense.paid_by);
      return {
        expense,
        splitAmount: userSplit?.amount || 0,
        payerName: payer?.name || 'Unknown'
      };
    });
  };

  const formatCurrency = (amount: number): string => formatAmount(amount);

  const getActivityIcon = (actionType: string): string => {
    switch (actionType) {
      case 'expense_created': return '💰';
      case 'expense_deleted': return '🗑️';
      case 'settlement': return '🤝';
      case 'payment': return '💵';
      case 'member_added': return '👋';
      case 'member_removed': return '👤';
      case 'group_created': return '🎉';
      case 'group_updated': return '✏️';
      default: return '📝';
    }
  };

  const getActivityColor = (actionType: string): string => {
    return 'var(--card-bg)';
  };

  const formatActivityMessage = (activity: Activity): string => {
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
      case 'group_updated':
        return `${userName}: ${activity.description}`;
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
        <div className="card-header" style={{ alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: '2rem' }}>{group.emoji || '💰'}</span>
            {editingGroup ? (
              <div style={{ flex: 1 }}>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && editName.trim()) {
                      (async () => {
                        try {
                          const res = await api.updateGroup(id!, editName.trim(), editDescription.trim());
                          setGroup(res.data || null);
                          setEditingGroup(false);
                          loadData();
                        } catch (err: any) {
                          setError(err.message);
                        }
                      })();
                    }
                    if (e.key === 'Escape') setEditingGroup(false);
                  }}
                  maxLength={69}
                  style={{ 
                    background: 'transparent', 
                    border: 'none', 
                    borderBottom: '1px solid var(--primary)',
                    outline: 'none',
                    color: 'var(--text)', 
                    fontSize: '1.25rem', 
                    fontWeight: 700, 
                    width: '100%',
                    padding: '2px 0',
                    margin: 0,
                    fontFamily: 'inherit'
                  }}
                  placeholder="Group name"
                  autoFocus
                />
                <div style={{ fontSize: '0.75rem', color: editName.length >= 60 ? 'var(--warning)' : 'var(--text-muted)', textAlign: 'right' }}>
                  {editName.length}/69
                </div>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && editName.trim()) {
                      e.preventDefault();
                      (async () => {
                        try {
                          const res = await api.updateGroup(id!, editName.trim(), editDescription.trim());
                          setGroup(res.data || null);
                          setEditingGroup(false);
                          loadData();
                        } catch (err: any) {
                          setError(err.message);
                        }
                      })();
                    }
                    if (e.key === 'Escape') setEditingGroup(false);
                  }}
                  maxLength={128}
                  rows={2}
                  style={{ 
                    background: 'transparent', 
                    border: 'none', 
                    borderBottom: '1px solid var(--border)',
                    outline: 'none',
                    color: 'var(--text-muted)', 
                    fontSize: '0.9rem', 
                    width: '100%',
                    padding: '2px 0',
                    marginTop: '4px',
                    fontFamily: 'inherit',
                    resize: 'none'
                  }}
                  placeholder="Description (optional)"
                />
                <div style={{ fontSize: '0.75rem', color: editDescription.length >= 120 ? 'var(--warning)' : 'var(--text-muted)', textAlign: 'right' }}>
                  {editDescription.length}/128
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={async () => {
                      try {
                        const res = await api.updateGroup(id!, editName.trim(), editDescription.trim());
                        setGroup(res.data || null);
                        setEditingGroup(false);
                        loadData();
                      } catch (err: any) {
                        setError(err.message);
                      }
                    }}
                    disabled={!editName.trim()}
                  >
                    Save
                  </button>
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => setEditingGroup(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div
                style={{ cursor: 'pointer', minWidth: 0 }}
                onClick={() => {
                  setEditName(group.name);
                  setEditDescription(group.description || '');
                  setEditingGroup(true);
                }}
                title="Click to edit"
              >
                <h2 className="card-title" style={{ margin: 0, wordBreak: 'break-word' }}>{group.name}</h2>
                {group.description && <p className="text-muted" style={{ margin: 0, wordBreak: 'break-word' }}>{group.description}</p>}
              </div>
            )}
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
            style={{ cursor: 'pointer', border: 'none', background: 'var(--primary)', color: 'var(--btn-text, white)' }}
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
            {expenses.length === 0 && settlements.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">💸</div>
                <h3>No expenses yet</h3>
                <p>Add your first expense to get started.</p>
              </div>
            ) : (
              <>
                {expenses.map((expense) => (
                  <div 
                    key={expense.id} 
                    className="expense-item" 
                    style={{ cursor: 'pointer' }}
                    onClick={() => openExpenseDetail(expense)}
                  >
                    <div className="expense-info">
                      <div className="expense-description" style={{ 
                        wordBreak: 'break-word', 
                        hyphens: 'auto', 
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}>{expense.description}</div>
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
                ))}
                {/* Free-form Payments (Settlements) */}
                {settlements.length > 0 && (
                  <>
                    <div style={{ 
                      padding: '10px 16px', 
                      background: 'var(--bg-secondary)', 
                      borderTop: '1px solid var(--border-color)',
                      borderBottom: '1px solid var(--border-color)',
                      fontSize: '0.85rem', 
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      🤝 Free-form Payments
                    </div>
                    {settlements.map((settlement) => {
                      const payer = group?.members?.find(m => m.id === settlement.paid_by);
                      const payee = group?.members?.find(m => m.id === settlement.paid_to);
                      return (
                        <div key={`s-${settlement.id}`} className="expense-item">
                          <div className="expense-info">
                            <div className="expense-description">
                              {payer?.name || 'Unknown'} → {payee?.name || 'Unknown'}
                            </div>
                            <div className="expense-meta">
                              Free-form payment • {new Date(settlement.created_at).toLocaleDateString()}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span className="expense-amount" style={{ color: '#10b981' }}>{formatCurrency(settlement.amount)}</span>
                            <button 
                              className="btn btn-outline btn-sm" 
                              onClick={() => handleDeleteSettlement(settlement.id)}
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </>
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
                    <div className="expense-description" style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
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
                  <textarea
                    className="form-input"
                    value={expenseDesc}
                    onChange={(e) => setExpenseDesc(e.target.value.slice(0, 69))}
                    placeholder="e.g., Dinner"
                    maxLength={69}
                    required
                    style={{ 
                      minHeight: '60px', 
                      resize: 'vertical',
                      fontFamily: 'inherit'
                    }}
                  />
                  <div style={{ 
                    textAlign: 'right', 
                    fontSize: '0.85rem', 
                    color: expenseDesc.length >= 69 ? 'var(--error-color, #ef4444)' : 'var(--text-muted)',
                    marginTop: '4px'
                  }}>
                    {expenseDesc.length}/69
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Paid by</label>
                  <select
                    className="form-select"
                    value={expensePaidBy}
                    onChange={(e) => setExpensePaidBy(parseInt(e.target.value))}
                  >
                    <option value={0}>You ({user?.name})</option>
                    {group?.members?.filter(m => m.id !== user?.id).map(member => (
                      <option key={member.id} value={member.id}>{member.name}</option>
                    ))}
                  </select>
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
                      setSplitType(e.target.value as 'equal' | 'percentage');
                      if (e.target.value === 'percentage' && group?.members) {
                        const initialSplits: Record<number, string> = {};
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
                          const share = (100 / group.members!.length).toFixed(1);
                          const splits: Record<number, string> = {};
                          group.members!.forEach(m => { splits[m.id] = share; });
                          setMemberSplits(splits);
                        }}
                      >
                        Split equally
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => {
                          const payerId = expensePaidBy || user?.id;
                          const others = group.members!.filter(m => m.id !== payerId);
                          const share = others.length > 0 ? (100 / others.length).toFixed(1) : '0';
                          const splits: Record<number, string> = {};
                          group.members!.forEach(m => {
                            splits[m.id] = m.id === payerId ? '0' : share;
                          });
                          setMemberSplits(splits);
                        }}
                      >
                        Others owe {expensePaidBy ? group.members?.find(m => m.id === expensePaidBy)?.name?.split(' ')[0] : 'me'} 100%
                      </button>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '10px', padding: '10px', background: 'var(--card-bg)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                      <strong>{expensePaidBy ? group.members?.find(m => m.id === expensePaidBy)?.name : 'You'} {expensePaidBy ? 'is' : 'are'} paying {expenseAmount ? (
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
                        <div key={member.id} className="split-row" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span className="split-name" style={{ minWidth: '120px', fontWeight: member.id === user?.id ? 'bold' : 'normal' }}>
                            {member.name} {member.id === user?.id ? '(you)' : ''}
                          </span>
                          <input
                            type="number"
                            className="form-input split-input"
                            style={{ width: '100px' }}
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
              <h3 className="modal-title" style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap', hyphens: 'auto' }}>{selectedExpense.description}</h3>
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
