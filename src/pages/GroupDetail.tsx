import { useState, useEffect, useRef, useMemo, FormEvent } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useTranslation, Trans } from 'react-i18next';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useCurrency, DISPLAY_CURRENCIES } from '../context/CurrencyContext';
import Avatar from '../components/Avatar';
import LoadingSpinner from '../components/LoadingSpinner';
import ReceiptScanner from '../components/ReceiptScanner';
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
  paid_by_user?: { name: string; avatar?: string };
}

interface ExpenseSplitWithUser {
  user_id: number;
  amount: number;
  user?: { name: string; avatar?: string };
}

interface ExpenseDetail extends Expense {
  paid_by_user?: { name: string; avatar?: string };
  splits?: ExpenseSplitWithUser[];
}

interface ExpensePaymentWithUsers extends ExpensePayment {
  paid_by_user?: { name: string; avatar?: string };
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
  paid: boolean;
}

const CURRENCIES: CurrencyInfo[] = DISPLAY_CURRENCIES;

export default function GroupDetail(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { formatAmount } = useCurrency();
  const { t } = useTranslation();
  const [group, setGroup] = useState<Group | null>(null);
  const [expenses, setExpenses] = useState<ExpenseWithUser[]>([]);
  const [unpaidExpenses, setUnpaidExpenses] = useState<ExpenseWithUser[]>([]);
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
  const [isEditingExpense, setIsEditingExpense] = useState<boolean>(false);
  const [editingExpenseId, setEditingExpenseId] = useState<number | null>(null);
  const [showSettleModal, setShowSettleModal] = useState<boolean>(false);
  const [showMemberModal, setShowMemberModal] = useState<boolean>(false);
  const [memberError, setMemberError] = useState<string>('');
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
  const [receiptItems, setReceiptItems] = useState<Array<{name: string; price: number}>>([]);
  const [receiptMode, setReceiptMode] = useState<'none' | 'interactive'>('none');
  const [receiptItemConfigs, setReceiptItemConfigs] = useState<Array<{
    included: boolean;
    paidBy: number;
    splitType: 'equal' | 'percentage';
    memberSplits: Record<number, string>;
  }>>([]);
  const [addingReceipt, setAddingReceipt] = useState(false);
  const [receiptDiscount, setReceiptDiscount] = useState<string>('');
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
      const [groupRes, expensesRes, balancesRes, myBalanceRes, paymentStatusRes, activitiesRes, settlementsRes, unpaidRes] = await Promise.all([
        api.getGroup(id!),
        api.getExpenses(id!),
        api.getGroupBalances(id!).catch(() => ({ data: { balances: [] } })),
        api.getMyBalance(id!).catch(() => ({ data: { balance: 0 } })),
        api.getGroupExpensePaymentStatuses(id!).catch(() => ({ data: {} })),
        api.getGroupActivities(id!).catch(() => ({ data: [] })),
        api.getSettlements(id!).catch(() => ({ data: [] })),
        api.getUnpaidExpenses(id!).catch(() => ({ data: [] })),
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
      setUnpaidExpenses(unpaidRes.data || []);
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
    setReceiptItems([]);
    setReceiptMode('none');
    setReceiptItemConfigs([]);
    setAddingReceipt(false);
    setReceiptDiscount('');
  };

  const handleAddExpense = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const finalAmount = expenseCurrency === 'EUR' ? expenseAmount : convertedAmount;
      if (!finalAmount) {
        setError(t('group.waitConversion'));
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
          setError(t('group.percentsMust100'));
          return;
        }
        splitWith = Object.entries(memberSplits).map(([userId, percent]) => ({
          user_id: parseInt(userId),
          amount: parseFloat(percent) || 0
        }));
      } else if (splitType === 'exact') {
        // treat memberSplits values as exact amounts when editing/creating exact splits
        splitWith = Object.entries(memberSplits).map(([userId, amt]) => ({
          user_id: parseInt(userId),
          amount: parseFloat(amt) || 0
        }));
      }

      if (isEditingExpense && editingExpenseId) {
        await api.updateExpense(id!, editingExpenseId, finalAmount, finalDesc, splitType, splitWith, expensePaidBy || undefined);
      } else {
        await api.createExpense(id!, finalAmount, finalDesc, splitType, splitWith, expensePaidBy || undefined);
      }
      closeExpenseModal();
      setIsEditingExpense(false);
      setEditingExpenseId(null);
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const openEditExpense = (expense: ExpenseDetail) => {
    setIsEditingExpense(true);
    setEditingExpenseId(expense.id);
    setShowExpenseModal(true);
    setExpenseAmount(expense.amount.toFixed(2));
    setExpenseDesc(expense.description || '');
    setExpensePaidBy(expense.paid_by || 0);
    setSplitType(expense.split_type === 'percentage' ? 'percentage' : (expense.split_type === 'exact' ? 'exact' : 'equal'));
    // Prefill memberSplits for percentage or exact
    const preSplits: Record<number, string> = {};
    if (expense.splits && expense.splits.length > 0) {
      if (expense.split_type === 'percentage') {
        expense.splits.forEach(s => {
          const pct = expense.amount > 0 ? (s.amount / expense.amount) * 100 : 0;
          preSplits[s.user_id] = pct.toFixed(2);
        });
      } else if (expense.split_type === 'exact') {
        expense.splits.forEach(s => {
          preSplits[s.user_id] = s.amount.toFixed(2);
        });
      }
    }
    setMemberSplits(preSplits);
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
    if (!confirm(t('group.removeMemberConfirm', { name: memberName }))) return;
    try {
      setMemberError('');
      await api.removeMember(id!, memberId);
      await loadData();
    } catch (err: any) {
      setMemberError(err.message);
    }
  };

  const handleDeleteExpense = async (expenseId: number) => {
    if (!confirm(t('group.deleteExpense'))) return;
    try {
      await api.deleteExpense(id!, expenseId);
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handlePayMyShare = async (expense: ExpenseWithUser) => {
    if (!user || !expense.splits) return;
    const userSplit = expense.splits.find(s => s.user_id === user.id);
    if (!userSplit) return;
    try {
      // Fetch existing payments to calculate remaining amount
      const res = await api.getExpensePayments(expense.id);
      const myPayments = (res.data || []).filter(p => p.paid_by === user.id);
      const alreadyPaid = myPayments.reduce((sum, p) => sum + p.amount, 0);
      const remaining = userSplit.amount - alreadyPaid;
      if (remaining <= 0.01) return;
      await api.createExpensePayment(expense.id, remaining, 'Paid my share');
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteSettlement = async (settlementId: number) => {
    if (!confirm(t('group.deleteSettlement'))) return;
    try {
      await api.deleteSettlement(id!, settlementId);
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteGroup = async () => {
    if (balances.length > 0) {
      alert(t('group.balanceNotSettled'));
      return;
    }
    if (!confirm(t('group.deleteGroupConfirm'))) return;
    try {
      await api.deleteGroup(id!);
      navigate('/');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleClearAllExpenses = async () => {
    if (!confirm(t('group.clearExpensesConfirm'))) return;
    try {
      await api.clearAllExpenses(id!);
      await loadData();
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
    if (!confirm(t('group.deletePayment'))) return;
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

  const myExpenseDebts = useMemo((): ExpenseDebt[] => {
    const unpaidIds = new Set(unpaidExpenses.map(e => e.id));
    return expenses.filter(expense => {
      if (expense.paid_by == user?.id) return false;
      if (!expense.splits || expense.splits.length === 0) return false;
      const userSplit = expense.splits.find(s => s.user_id == user?.id);
      if (!userSplit) return false;
      return true;
    }).map(expense => {
      const userSplit = expense.splits!.find(s => s.user_id == user?.id);
      const payer = group?.members?.find(m => m.id == expense.paid_by);
      return {
        expense,
        splitAmount: userSplit?.amount || 0,
        payerName: payer?.name || 'Unknown',
        paid: !unpaidIds.has(expense.id)
      };
    });
  }, [expenses, unpaidExpenses, user?.id, group?.members]);

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
        return t('activity.addedExpense', { name: userName, desc: activity.description });
      case 'expense_deleted':
        return t('activity.deletedExpense', { name: userName, desc: activity.description });
      case 'settlement':
        return t('activity.settlement', { name: userName, related: relatedName });
      case 'payment':
        return t('activity.payment', { name: userName, related: relatedName, desc: activity.description });
      case 'member_added':
        return t('activity.memberAdded', { name: userName, related: relatedName });
      case 'member_removed':
        return t('activity.memberRemoved', { name: userName, related: relatedName });
      case 'group_created':
        return t('activity.groupCreated', { name: userName });
      case 'group_updated':
        return t('activity.groupUpdated', { name: userName, desc: activity.description });
      default:
        return activity.description;
    }
  };

  if (loading) {
    return <LoadingSpinner message={t('common.fetchingData')} />;
  }

  if (!group) {
    return (
      <div className="container">
        <div style={{ marginBottom: '16px' }}>
          <Link to="/" style={{ color: 'var(--primary)', textDecoration: 'none', fontSize: '0.9rem' }}>
            {t('common.backToDashboard')}
          </Link>
        </div>
        <div className="card">
          <div className="alert alert-error">{t('group.groupNotFound')}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div style={{ marginBottom: '16px' }}>
        <Link to="/" style={{ color: 'var(--primary)', textDecoration: 'none', fontSize: '0.9rem' }}>
            {t('common.backToDashboard')}
        </Link>
      </div>
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
                  placeholder={t('group.groupNamePlaceholder')}
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
                  placeholder={t('group.descPlaceholder')}
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
                    {t('common.save')}
                  </button>
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => setEditingGroup(false)}
                  >
                    {t('common.cancel')}
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
                title={t('group.clickToEdit')}
              >
                <h2 className="card-title" style={{ margin: 0, wordBreak: 'break-word' }}>{group.name}</h2>
                {group.description && <p className="text-muted" style={{ margin: 0, wordBreak: 'break-word' }}>{group.description}</p>}
                <p className="text-muted" style={{ margin: 0, fontSize: '0.8rem' }}>
                  {t('group.createdBy')} {group.members?.find(m => m.id === group.created_by)?.name || t('common.unknown')} {t('group.on')} {group.created_at ? new Date(group.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : ''}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Members button */}
        <button
          className="btn btn-outline btn-sm"
          style={{ marginTop: '10px' }}
          onClick={() => {
            loadAllUsers();
            setMemberError('');
            setShowMemberModal(true);
          }}
        >
          👥 {t('group.members')} ({group.members?.length || 0})
        </button>
      </div>

      {/* Balance Card */}
      <div className="card balance-card">
        <div className="balance-label">{t('group.yourBalance')}</div>
        <div className={`balance-amount ${myBalance > 0 ? 'balance-positive' : myBalance < 0 ? 'balance-negative' : 'balance-zero'}`}>
          {myBalance >= 0 ? '+' : ''}{formatCurrency(myBalance)}
        </div>
        <p className="text-muted" style={{ marginTop: '8px' }}>
          {myBalance > 0 ? t('group.youAreOwed') : myBalance < 0 ? t('group.youOwe') : t('group.allBalanced')}
        </p>
        <div style={{ display: 'flex', gap: '8px', marginTop: '12px', justifyContent: 'center' }}>
          <button
            className="btn btn-outline btn-sm"
            style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
            onClick={handleClearAllExpenses}
          >
            {t('group.clearAllExpenses')}
          </button>
          <button
            className="btn btn-outline btn-sm"
            style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
            onClick={handleDeleteGroup}
          >
            {t('group.deleteGroup')}
          </button>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 mb-4">
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setShowExpenseModal(true)}>
          {t('group.addExpense')}
        </button>
        <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { setGoPayMode('select'); setShowSettleModal(true); }}>
          {t('group.goPay')}
        </button>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab ${activeTab === 'expenses' ? 'active' : ''}`} onClick={() => setActiveTab('expenses')}>
          {t('group.expenses')}
        </button>
        <button className={`tab ${activeTab === 'balances' ? 'active' : ''}`} onClick={() => setActiveTab('balances')}>
          {t('group.balances')}
        </button>
        <button className={`tab ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
          {t('group.history')}
        </button>
      </div>

      {/* Tab Content */}
      <div className="card">
        {activeTab === 'expenses' && (
          <>
            {expenses.length === 0 && settlements.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">💸</div>
                <h3>{t('group.noExpenses')}</h3>
                <p>{t('group.noExpensesDesc')}</p>
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
                      <div className="expense-meta" style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                        <span>{t('common.paidBy')}</span>
                        <Avatar name={expense.paid_by_user?.name || 'Unknown'} avatar={expense.paid_by_user?.avatar} size={16} />
                        <span>{expense.paid_by_user?.name || 'Unknown'}</span>
                        <span>• {expense.split_type}</span>
                      </div>
                      {expensePaymentStatus[expense.id] && 
                        expensePaymentStatus[expense.id].totalOwed > 0 && 
                        expensePaymentStatus[expense.id].totalPaid >= expensePaymentStatus[expense.id].totalOwed - 0.01 && (
                          <div style={{ color: 'var(--success)', fontSize: '0.85rem', marginTop: '4px' }}>{t('group.settlementsWereMade')}</div>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                      <span className="expense-amount">{formatCurrency(expense.amount)}</span>
                      {expense.paid_by !== user?.id && 
                        expense.splits?.find(s => s.user_id === user?.id) && 
                        unpaidExpenses.some(u => u.id === expense.id) && (
                        <button 
                          className="btn btn-outline btn-sm" 
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePayMyShare(expense);
                          }}
                          title={t('group.markAsPaid')}
                          style={{ fontSize: '0.8rem' }}
                        >
                          {t('group.paidStatus')}
                        </button>
                      )}
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button 
                          className="btn btn-outline btn-sm" 
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditExpense(expense as unknown as ExpenseDetail);
                          }}
                          title={t('group.editExpense')}
                          style={{ fontSize: '0.9rem' }}
                        >
                          ✎
                        </button>
                        <button 
                          className="btn btn-outline btn-sm" 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteExpense(expense.id);
                          }}
                          title={t('group.deleteExpense')}
                        >
                          ×
                        </button>
                      </div>
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
                      {t('group.freeFormPayments')}
                    </div>
                    {settlements.map((settlement) => {
                      const payer = group?.members?.find(m => m.id === settlement.paid_by);
                      const payee = group?.members?.find(m => m.id === settlement.paid_to);
                      return (
                        <div key={`s-${settlement.id}`} className="expense-item">
                          <div className="expense-info">
                            <div className="expense-description" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <Avatar name={payer?.name || 'Unknown'} avatar={payer?.avatar} size={20} />
                                <strong>{payer?.name || 'Unknown'}</strong>
                              </span>
                              <span style={{ color: 'var(--text-muted)' }}>→</span>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <Avatar name={payee?.name || 'Unknown'} avatar={payee?.avatar} size={20} />
                                <strong>{payee?.name || 'Unknown'}</strong>
                              </span>
                            </div>
                            <div className="expense-meta">
                              {t('group.freeFormPayment')} • {new Date(settlement.created_at).toLocaleDateString()}
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
                <h3>{t('group.allSettled')}</h3>
                <p>{t('group.noOneOwes')}</p>
              </div>
            ) : (
              balances.map((balance, idx) => (
                <div key={idx} className="expense-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '8px' }}>
                  <div className="expense-info">
                    <div className="expense-description" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Avatar name={balance.from_user?.name || '?'} avatar={balance.from_user?.avatar} size={22} />
                        <strong>{balance.from_user?.name}</strong>
                      </span>
                      <span style={{ color: 'var(--text-muted)' }}>{t('group.owes')}</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Avatar name={balance.to_user?.name || '?'} avatar={balance.to_user?.avatar} size={22} />
                        <strong>{balance.to_user?.name}</strong>
                      </span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className="expense-amount negative">{formatCurrency(balance.amount)}</span>
                  </div>
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
                <h3>{t('group.noActivity')}</h3>
                <p>{t('group.noActivityDesc')}</p>
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
              <h3 className="modal-title">{t('group.addExpenseTitle')}</h3>
              <button className="modal-close" onClick={closeExpenseModal}>×</button>
            </div>
            <form onSubmit={handleAddExpense}>
              <div className="modal-body">
                <ReceiptScanner onResult={(result) => {
                  // Fill description with store name or item summary
                  if (result.storeName) {
                    setExpenseDesc(result.storeName.slice(0, 420));
                  } else if (result.items.length > 0) {
                    setExpenseDesc(result.items.map(i => i.name).join(', ').slice(0, 420));
                  }
                  // Fill total amount from sum of items (not receipt total which may include tax etc.)
                  if (result.items.length > 0) {
                    const itemSum = Math.round(result.items.reduce((s, it) => s + it.price, 0) * 100) / 100;
                    setExpenseAmount(itemSum.toFixed(2));
                  } else if (result.total) {
                    setExpenseAmount(result.total.toFixed(2));
                  }
                  // Store items and enter interactive mode
                  setReceiptItems(result.items);
                  if (result.items.length > 0) {
                    setReceiptMode('interactive');
                    setReceiptItemConfigs(result.items.map(() => ({
                      included: true,
                      paidBy: 0,
                      splitType: 'equal' as const,
                      memberSplits: {},
                    })));
                  }
                }} />

                {/* Interactive Receipt Mode */}
                {receiptMode === 'interactive' && receiptItems.length > 0 && (
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{
                      background: 'var(--bg)',
                      borderRadius: '10px',
                      padding: '12px',
                      border: '1px solid var(--border)',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{t('group.receipt.items')}</span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {t('group.receipt.selected', { count: receiptItemConfigs.filter(c => c.included).length, total: receiptItems.length })}
                        </span>
                      </div>

                      <button
                        type="button"
                        style={{ 
                          background: 'none', border: 'none', color: 'var(--text-muted)', 
                          fontSize: '0.8rem', cursor: 'pointer', marginBottom: '12px', width: '100%', textAlign: 'center'
                        }}
                        onClick={() => { setReceiptMode('none'); }}
                      >
                        {t('group.receipt.skipManual')}
                      </button>

                      {/* Group summary preview */}
                      {(() => {
                        const included = receiptItemConfigs.map((c, idx) => ({ ...c, idx })).filter(c => c.included);
                        if (included.length === 0) return null;
                        // Build groups for preview
                        const previewGroups: Record<string, { items: string[], splitLabel: string }> = {};
                        for (const c of included) {
                          const splitsKey = c.splitType === 'percentage'
                            ? Object.entries(c.memberSplits).sort(([a], [b]) => a.localeCompare(b)).map(([uid, pct]) => `${uid}:${pct}`).join(',')
                            : 'equal';
                          const key = `${c.paidBy}-${c.splitType}-${splitsKey}`;
                          if (!previewGroups[key]) {
                            let splitLabel = 'Split equally';
                            if (c.splitType === 'percentage') {
                              const entries = Object.entries(c.memberSplits);
                              const nonZero = entries.filter(([, pct]) => parseFloat(pct) > 0);
                              if (nonZero.length > 0) {
                                splitLabel = nonZero.map(([uid, pct]) => {
                                  const m = group?.members?.find(mm => mm.id === parseInt(uid));
                                  const name = m ? (m.id === user?.id ? 'You' : m.name.split(' ')[0]) : `#${uid}`;
                                  return `${name} ${pct}%`;
                                }).join(', ');
                              } else {
                                splitLabel = 'Custom %';
                              }
                            }
                            previewGroups[key] = { items: [], splitLabel };
                          }
                          const itemName = receiptItems[c.idx]?.name || 'Item';
                          previewGroups[key].items.push(itemName);
                        }
                        const groups = Object.values(previewGroups);
                        if (groups.length <= 1 && groups[0]?.splitLabel === 'Split equally') return null;
                        return (
                          <div style={{ marginBottom: '10px', padding: '8px 10px', background: 'var(--card-bg)', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            <div style={{ fontWeight: 600, marginBottom: '4px' }}>{t('group.receipt.willCreate', { count: groups.length })}:</div>
                            {groups.map((g, idx) => (
                              <div key={idx} style={{ padding: '2px 0' }}>
                                <span style={{ fontWeight: 500 }}>{idx + 1}.</span> {g.items.join(', ')} — <em>{g.splitLabel}</em>
                              </div>
                            ))}
                          </div>
                        );
                      })()}

                      {receiptItems.map((item, i) => {
                        const config = receiptItemConfigs[i];
                        if (!config) return null;
                        return (
                          <div key={i} style={{
                            padding: '10px',
                            marginBottom: '8px',
                            background: config.included ? 'var(--card-bg)' : 'transparent',
                            borderRadius: '8px',
                            border: config.included ? '1px solid var(--primary)' : '1px solid var(--border)',
                            opacity: config.included ? 1 : 0.5,
                            transition: 'all 0.2s',
                          }}>
                            {/* Item header: checkbox + editable name + editable price + delete */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: config.included ? '8px' : '0' }}>
                              <input
                                type="checkbox"
                                checked={config.included}
                                onChange={() => {
                                  setReceiptItemConfigs(prev => {
                                    const updated = [...prev];
                                    updated[i] = { ...updated[i], included: !updated[i].included };
                                    return updated;
                                  });
                                }}
                                style={{ width: '18px', height: '18px', cursor: 'pointer', flexShrink: 0 }}
                              />
                              <input
                                type="text"
                                className="form-input"
                                value={item.name}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setReceiptItems(prev => {
                                    const updated = [...prev];
                                    updated[i] = { ...updated[i], name: val };
                                    return updated;
                                  });
                                }}
                                placeholder={t('group.receipt.itemName')}
                                style={{
                                  flex: 1, padding: '4px 6px', fontSize: '0.85rem', minWidth: '0',
                                  ...(config.included && !item.name.trim() ? { borderColor: 'var(--danger)' } : {}),
                                }}
                              />
                              <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
                                <span style={{ fontSize: '0.85rem' }}>€</span>
                                <input
                                  type="number"
                                  className="form-input"
                                  value={item.price || ''}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value) || 0;
                                    setReceiptItems(prev => {
                                      const updated = [...prev];
                                      updated[i] = { ...updated[i], price: val };
                                      return updated;
                                    });
                                  }}
                                  style={{
                                    width: '70px', padding: '4px 6px', fontSize: '0.85rem', textAlign: 'right' as const,
                                    ...(config.included && item.price <= 0 ? { borderColor: 'var(--danger)' } : {}),
                                  }}
                                  step="0.01"
                                  min="0"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setReceiptItems(prev => prev.filter((_, idx) => idx !== i));
                                  setReceiptItemConfigs(prev => prev.filter((_, idx) => idx !== i));
                                }}
                                style={{
                                  background: 'none', border: 'none', cursor: 'pointer',
                                  color: 'var(--danger)', fontSize: '1.1rem', padding: '2px 4px', flexShrink: 0,
                                  lineHeight: 1,
                                }}
                                title={t('group.receipt.removeItem')}
                              >
                                ✕
                              </button>
                            </div>

                            {/* Per-item options (only when included) */}
                            {config.included && (
                              <div style={{ paddingLeft: '26px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                                  <select
                                    className="form-select"
                                    value={config.paidBy}
                                    onChange={(e) => {
                                      const val = parseInt(e.target.value);
                                      setReceiptItemConfigs(prev => {
                                        const updated = [...prev];
                                        updated[i] = { ...updated[i], paidBy: val };
                                        return updated;
                                      });
                                    }}
                                    style={{ flex: 1, padding: '6px 8px', fontSize: '0.8rem', minWidth: '100px' }}
                                  >
                                    <option value={0}>{t('group.paidByYou')}</option>
                                    {group?.members?.filter(m => m.id !== user?.id).map(member => (
                                      <option key={member.id} value={member.id}>{t('group.paidByMember', { name: member.name })}</option>
                                    ))}
                                  </select>
                                  <select
                                    className="form-select"
                                    value={config.splitType}
                                    onChange={(e) => {
                                      const newSplitType = e.target.value as 'equal' | 'percentage';
                                      setReceiptItemConfigs(prev => {
                                        const updated = [...prev];
                                        updated[i] = { ...updated[i], splitType: newSplitType };
                                        if (newSplitType === 'percentage' && group?.members) {
                                          const share = (100 / group.members.length).toFixed(1);
                                          const splits: Record<number, string> = {};
                                          group.members.forEach(m => { splits[m.id] = share; });
                                          updated[i] = { ...updated[i], splitType: newSplitType, memberSplits: splits };
                                        }
                                        return updated;
                                      });
                                    }}
                                    style={{ flex: 1, padding: '6px 8px', fontSize: '0.8rem', minWidth: '100px' }}
                                  >
                                    <option value="equal">{t('common.splitEqually')}</option>
                                    <option value="percentage">{t('common.customPercent')}</option>
                                  </select>
                                </div>

                                {/* Percentage splits for this item */}
                                {config.splitType === 'percentage' && group?.members && (
                                  <div style={{ fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                                    {/* Quick preset buttons */}
                                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '4px' }}>
                                      <button
                                        type="button"
                                        className="btn btn-outline btn-sm"
                                        style={{ fontSize: '0.7rem', padding: '2px 6px' }}
                                        onClick={() => {
                                          const share = (100 / group.members!.length).toFixed(1);
                                          const splits: Record<number, string> = {};
                                          group.members!.forEach(m => { splits[m.id] = share; });
                                          setReceiptItemConfigs(prev => {
                                            const updated = [...prev];
                                            updated[i] = { ...updated[i], memberSplits: splits };
                                            return updated;
                                          });
                                        }}
                                      >
                                        {t('common.splitEqually')}
                                      </button>
                                      <button
                                        type="button"
                                        className="btn btn-outline btn-sm"
                                        style={{ fontSize: '0.7rem', padding: '2px 6px' }}
                                        onClick={() => {
                                          const payerId = config.paidBy || user?.id;
                                          const splits: Record<number, string> = {};
                                          const others = group.members!.filter(m => m.id !== payerId);
                                          const share = others.length > 0 ? (100 / others.length).toFixed(1) : '0';
                                          group.members!.forEach(m => { splits[m.id] = m.id === payerId ? '0' : share; });
                                          setReceiptItemConfigs(prev => {
                                            const updated = [...prev];
                                            updated[i] = { ...updated[i], memberSplits: splits };
                                            return updated;
                                          });
                                        }}
                                      >
                                        {t('group.receipt.othersOwePayer')}
                                      </button>
                                      {group.members!.filter(member => member.id !== (config.paidBy || user?.id)).map(member => (
                                        <button
                                          key={member.id}
                                          type="button"
                                          className="btn btn-outline btn-sm"
                                          style={{ fontSize: '0.7rem', padding: '2px 6px' }}
                                          onClick={() => {
                                            const splits: Record<number, string> = {};
                                            group.members!.forEach(m => { splits[m.id] = m.id === member.id ? '100' : '0'; });
                                            setReceiptItemConfigs(prev => {
                                              const updated = [...prev];
                                              updated[i] = { ...updated[i], memberSplits: splits };
                                              return updated;
                                            });
                                          }}
                                        >
                                          {member.id === user?.id ? t('group.iOwe') : t('group.owes100', { name: member.name.split(' ')[0] })}
                                        </button>
                                      ))}
                                    </div>
                                    {/* Explanation */}
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', padding: '6px 8px', background: 'var(--card-bg)', borderRadius: '6px', border: '1px solid var(--border)', marginBottom: '4px' }}>
                                      <Trans i18nKey="group.receipt.enterOwes" components={{ em: <em /> }} /><br/>
                                      {t('group.receipt.zeroOnPayer')}<br/>
                                      {t('group.receipt.hundredOnSomeone')}
                                    </div>
                                    {group.members.map(member => (
                                      <div key={member.id} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span style={{ minWidth: '80px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                          <Avatar name={member.name} avatar={member.avatar} size={16} />
                                          {member.name}{member.id === user?.id ? ` (${t('common.you')})` : ''}
                                        </span>
                                        <input
                                          type="number"
                                          className="form-input"
                                          style={{ width: '70px', padding: '4px 6px', fontSize: '0.8rem' }}
                                          value={config.memberSplits[member.id] || ''}
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            setReceiptItemConfigs(prev => {
                                              const updated = [...prev];
                                              updated[i] = {
                                                ...updated[i],
                                                memberSplits: { ...updated[i].memberSplits, [member.id]: val }
                                              };
                                              return updated;
                                            });
                                          }}
                                          placeholder="0"
                                          min="0"
                                          max="100"
                                        />
                                        <span>%</span>
                                      </div>
                                    ))}
                                    <div style={{
                                      fontSize: '0.75rem',
                                      color: Object.values(config.memberSplits).reduce((s, v) => s + (parseFloat(v) || 0), 0) === 100
                                        ? 'var(--primary)' : 'var(--danger)'
                                    }}>
                                      Total: {Object.values(config.memberSplits).reduce((s, v) => s + (parseFloat(v) || 0), 0).toFixed(1)}%
                                      {Object.values(config.memberSplits).reduce((s, v) => s + (parseFloat(v) || 0), 0) === 100 ? ' ✓' : ''}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Add item manually */}
                      <button
                        type="button"
                        onClick={() => {
                          setReceiptItems(prev => [...prev, { name: '', price: 0 }]);
                          setReceiptItemConfigs(prev => [...prev, {
                            included: true,
                            paidBy: 0,
                            splitType: 'equal' as const,
                            memberSplits: {},
                          }]);
                        }}
                        style={{
                          width: '100%', padding: '8px', marginBottom: '8px',
                          background: 'none', border: '1px dashed var(--border)',
                          borderRadius: '8px', cursor: 'pointer',
                          color: 'var(--primary)', fontSize: '0.85rem', fontWeight: 500,
                        }}
                      >
                        {t('group.receipt.addItemManually')}
                      </button>

                      {/* Total summary */}
                      <div style={{
                        borderTop: '1px solid var(--border)',
                        marginTop: '4px',
                        padding: '8px 10px 0',
                      }}>
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontWeight: 500,
                          fontSize: '0.9rem',
                          color: 'var(--text-muted)',
                        }}>
                          <span>{t('group.receipt.itemsSubtotal')}</span>
                          <span>€{(Math.round(receiptItems.reduce((sum, item, i) => 
                            receiptItemConfigs[i]?.included ? sum + item.price : sum, 0
                          ) * 100) / 100).toFixed(2)}</span>
                        </div>

                        {/* Discount / adjustment */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '6px 0' }}>
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{t('group.receipt.discountAdjustment')}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flex: 1, justifyContent: 'flex-end' }}>
                            <span style={{ fontSize: '0.85rem' }}>€</span>
                            <input
                              type="number"
                              className="form-input"
                              value={receiptDiscount}
                              onChange={(e) => setReceiptDiscount(e.target.value)}
                              placeholder="0.00"
                              step="0.01"
                              style={{ width: '90px', padding: '4px 6px', fontSize: '0.85rem', textAlign: 'right' }}
                            />
                          </div>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                          {(() => {
                            const sub = Math.round(receiptItems.reduce((s, it, i) => receiptItemConfigs[i]?.included ? s + it.price : s, 0) * 100) / 100;
                            const disc = parseFloat(receiptDiscount) || 0;
                            if (sub + disc <= 0 && disc < 0) {
                              return <span style={{ color: 'var(--danger)' }}>{t('group.receipt.discountExceeds')}</span>;
                            }
                            return t('group.receipt.discountHint');
                          })()}
                        </div>

                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontWeight: 600,
                          fontSize: '0.95rem',
                          borderTop: '1px solid var(--border)',
                          paddingTop: '6px',
                        }}>
                          <span>{t('common.total')}</span>
                          {(() => {
                            const total = Math.round((
                              receiptItems.reduce((sum, item, i) => 
                                receiptItemConfigs[i]?.included ? sum + item.price : sum, 0
                              ) + (parseFloat(receiptDiscount) || 0)
                            ) * 100) / 100;
                            return <span style={{ color: total <= 0 ? 'var(--danger)' : undefined }}>
                              €{Math.max(0, total).toFixed(2)}
                            </span>;
                          })()}
                        </div>
                      </div>

                      {/* Action buttons — at bottom */}
                      <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          style={{ flex: 1 }}
                          disabled={addingReceipt || receiptItemConfigs.filter(c => c.included).length === 0 || (() => {
                            const sub = receiptItems.reduce((s, it, idx) => receiptItemConfigs[idx]?.included ? s + it.price : s, 0);
                            if ((sub + (parseFloat(receiptDiscount) || 0)) <= 0) return true;
                            for (let idx = 0; idx < receiptItems.length; idx++) {
                              if (!receiptItemConfigs[idx]?.included) continue;
                              if (!receiptItems[idx].name.trim()) return true;
                              if (receiptItems[idx].price <= 0) return true;
                            }
                            return false;
                          })()}
                          onClick={async () => {
                            setAddingReceipt(true);
                            try {
                              const groups: Record<string, { items: Array<{name: string; price: number; idx: number}>, config: typeof receiptItemConfigs[0] }> = {};
                              for (let i = 0; i < receiptItems.length; i++) {
                                const config = receiptItemConfigs[i];
                                if (!config?.included) continue;
                                const splitsKey = config.splitType === 'percentage'
                                  ? Object.entries(config.memberSplits).sort(([a], [b]) => a.localeCompare(b)).map(([uid, pct]) => `${uid}:${pct}`).join(',')
                                  : 'equal';
                                const key = `${config.paidBy}-${config.splitType}-${splitsKey}`;
                                if (!groups[key]) groups[key] = { items: [], config };
                                groups[key].items.push({ ...receiptItems[i], idx: i });
                              }
                              console.log('[Receipt] All item configs:', receiptItemConfigs.map((c, idx) => ({
                                idx,
                                item: receiptItems[idx]?.name,
                                included: c.included,
                                splitType: c.splitType,
                                memberSplits: c.memberSplits,
                                paidBy: c.paidBy,
                              })));
                              console.log('[Receipt] Groups:', Object.entries(groups).map(([key, g]) => ({
                                key,
                                items: g.items.map(it => it.name),
                                splitType: g.config.splitType,
                                memberSplits: g.config.memberSplits,
                              })));

                              const allIncludedTotal = Math.round(receiptItems.reduce((s, it, idx) => receiptItemConfigs[idx]?.included ? s + it.price : s, 0) * 100) / 100;
                              const discount = parseFloat(receiptDiscount) || 0;
                              for (const [gKey, group] of Object.entries(groups)) {
                                const groupItemTotal = Math.round(group.items.reduce((s, it) => s + it.price, 0) * 100) / 100;
                                const groupDiscount = allIncludedTotal > 0 ? Math.round(discount * (groupItemTotal / allIncludedTotal) * 100) / 100 : 0;
                                const totalAmount = Math.round((groupItemTotal + groupDiscount) * 100) / 100;
                                const desc = group.items.map(it => it.name || 'Item').join(', ').slice(0, 420);
                                const cfg = group.config;
                                let splitWith: Array<{ user_id: number; amount: number }> = [];
                                if (cfg.splitType === 'percentage') {
                                  const pctTotal = Object.values(cfg.memberSplits).reduce((s, v) => s + (parseFloat(v) || 0), 0);
                                  if (Math.abs(pctTotal - 100) > 0.01) {
                                    setError('Percentages must total 100%');
                                    setAddingReceipt(false);
                                    return;
                                  }
                                  splitWith = Object.entries(cfg.memberSplits).map(([uid, pct]) => ({
                                    user_id: parseInt(uid),
                                    amount: parseFloat(pct) || 0,
                                  }));
                                }
                                console.log(`[Receipt] Creating expense [${gKey}]:`, { desc, amount: totalAmount, splitType: cfg.splitType, splitWith, paidBy: cfg.paidBy });
                                await api.createExpense(
                                  id!,
                                  totalAmount.toFixed(2),
                                  desc,
                                  cfg.splitType,
                                  splitWith,
                                  cfg.paidBy || undefined,
                                );
                              }
                              closeExpenseModal();
                              await loadData();
                            } catch (err: any) {
                              setError(err.message);
                            } finally {
                              setAddingReceipt(false);
                            }
                          }}
                        >
                          {addingReceipt ? t('group.receipt.adding') : (() => {
                            const included = receiptItemConfigs.filter(c => c.included);
                            const groupKeys = new Set(included.map(c => {
                              const splitsKey = c.splitType === 'percentage'
                                ? Object.entries(c.memberSplits).sort(([a], [b]) => a.localeCompare(b)).map(([uid, pct]) => `${uid}:${pct}`).join(',')
                                : 'equal';
                              return `${c.paidBy}-${c.splitType}-${splitsKey}`;
                            }));
                            return t('group.receipt.addAsExpenses', { count: groupKeys.size });
                          })()}
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          style={{ flex: 1 }}
                          onClick={() => {
                            const included = receiptItems.filter((_, i) => receiptItemConfigs[i]?.included);
                            const itemSum = Math.round(included.reduce((sum, item) => sum + item.price, 0) * 100) / 100;
                            const discount = parseFloat(receiptDiscount) || 0;
                            const total = Math.round((itemSum + discount) * 100) / 100;
                            setExpenseAmount(total.toFixed(2));
                            setExpenseDesc(included.map(i => i.name).join(', ').slice(0, 420));
                            setReceiptMode('none');
                          }}
                        >
                          {t('group.receipt.combineAll')}
                        </button>
                      </div>

                    </div>
                  </div>
                )}

                {/* Standard items display (non-interactive) */}
                {receiptMode === 'none' && receiptItems.length > 0 && (
                  <div style={{
                    background: 'var(--bg)',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    marginBottom: '16px',
                    fontSize: '0.85rem',
                  }}>
                    <div style={{ fontWeight: 600, marginBottom: '6px', color: 'var(--text-muted)' }}>
                      {t('group.receipt.itemsFound')}
                    </div>
                    {receiptItems.map((item, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                        <span>{item.name}</span>
                        <span style={{ fontWeight: 500 }}>€{item.price.toFixed(2)}</span>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      style={{ width: '100%', marginTop: '8px' }}
                      onClick={() => {
                        setReceiptMode('interactive');
                        setReceiptItemConfigs(receiptItems.map(() => ({
                          included: true,
                          paidBy: 0,
                          splitType: 'equal' as const,
                          memberSplits: {},
                        })));
                      }}
                    >
                      {t('group.receipt.backToItemMode')}
                    </button>
                  </div>
                )}

                {/* Divider between receipt and manual form */}
                {receiptItems.length > 0 && receiptMode !== 'interactive' && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    margin: '8px 0 16px',
                  }}>
                    <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{t('group.receipt.orAddManually')}</span>
                    <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
                  </div>
                )}

                {/* Hide manual form when in interactive mode — receipt buttons handle it */}
                {receiptMode !== 'interactive' && (<>
                <div className="form-group">
                  <label className="form-label">{t('group.descLabel')}</label>
                  <textarea
                    className="form-input"
                    value={expenseDesc}
                    onChange={(e) => setExpenseDesc(e.target.value.slice(0, 420))}
                    placeholder={t('group.descPlaceholder')}
                    maxLength={420}
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
                    color: expenseDesc.length >= 420 ? 'var(--error-color, #ef4444)' : 'var(--text-muted)',
                    marginTop: '4px'
                  }}>
                    {expenseDesc.length}/420
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">{t('common.paidBy')}</label>
                  <select
                    className="form-select"
                    value={expensePaidBy}
                    onChange={(e) => setExpensePaidBy(parseInt(e.target.value))}
                  >
                    <option value={0}>{t('group.paidByYou')} ({user?.name})</option>
                    {group?.members?.filter(m => m.id !== user?.id).map(member => (
                      <option key={member.id} value={member.id}>{member.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">{t('group.amount')}</label>
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
                <div className="form-group">
                  <label className="form-label">{t('group.howToSplit')}</label>
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
                    <option value="equal">{t('common.splitEqually')}</option>
                    <option value="percentage">{t('common.customSplit')}</option>
                  </select>
                </div>
                {splitType === 'equal' && group?.members && expenseAmount && (() => {
                  const amt = expenseCurrency === 'EUR' ? parseFloat(expenseAmount) : (convertedAmount || 0);
                  const n = group.members!.length;
                  if (!amt || n === 0) return null;
                  const perPerson = Math.floor(amt / n * 100) / 100;
                  const remainder = Math.round((amt - perPerson * n) * 100) / 100;
                  const payerName = expensePaidBy
                    ? group.members?.find(m => m.id === expensePaidBy)?.name?.split(' ')[0] || 'Payer'
                    : t('common.you');
                  if (remainder > 0) {
                    return (
                      <div style={{ marginTop: '4px', padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        {t('group.equalSplitHint', { total: amt.toFixed(2), count: n, perPerson: perPerson.toFixed(2), remainder: remainder.toFixed(2), payerName: payerName === t('common.you') ? t('group.remainderYour') : t('group.remainderTheir', { name: payerName }), payerShare: (perPerson + remainder).toFixed(2) })}
                      </div>
                    );
                  }
                  return null;
                })()}
                {splitType === 'percentage' && group?.members && (
                  <div className="form-group">
                    <label className="form-label">{t('group.whoOwesWhat')}</label>
                    
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
                        {t('common.splitEqually')}
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
                        {t('group.othersOwe', { name: expensePaidBy ? group.members?.find(m => m.id === expensePaidBy)?.name?.split(' ')[0] : t('common.you') })}
                      </button>
                      {group.members!.filter(member => member.id !== (expensePaidBy || user?.id)).map(member => (
                        <button
                          key={member.id}
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => {
                            const splits: Record<number, string> = {};
                            group.members!.forEach(m => { splits[m.id] = m.id === member.id ? '100' : '0'; });
                            setMemberSplits(splits);
                          }}
                        >
                          {member.id === user?.id ? t('group.iOwe') : t('group.owes100', { name: member.name.split(' ')[0] })}
                        </button>
                      ))}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '10px', padding: '10px', background: 'var(--card-bg)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                      <strong>{t('group.payerIsPaying', { name: expensePaidBy ? group.members?.find(m => m.id === expensePaidBy)?.name : t('common.you'), verb: expensePaidBy ? 'is' : 'are', amount: expenseAmount ? (expenseCurrency === 'EUR' ? `€${expenseAmount}` : `${CURRENCIES.find(c => c.code === expenseCurrency)?.symbol || ''}${expenseAmount} ${expenseCurrency}${convertedAmount ? ` (€${convertedAmount.toFixed(2)})` : ''}`) : 'this expense' })}</strong><br/>
                      <Trans i18nKey="group.enterPercent" components={{ em: <em /> }} /><br/>
                      <Trans i18nKey="group.zeroPercent" components={{ strong: <strong /> }} /><br/>
                      <Trans i18nKey="group.fiftyPercent" components={{ strong: <strong /> }} /><br/>
                      <Trans i18nKey="group.hundredPercent" components={{ strong: <strong /> }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {group.members.map((member) => (
                        <div key={member.id} className="split-row" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span className="split-name" style={{ minWidth: '120px', fontWeight: member.id === user?.id ? 'bold' : 'normal', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Avatar name={member.name} avatar={member.avatar} size={20} />
                            {member.name} {member.id === user?.id ? `(${t('common.you')})` : ''}
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
                      {t('common.total')}: {Object.values(memberSplits).reduce((sum, val) => sum + (parseFloat(val) || 0), 0).toFixed(1)}% {Object.values(memberSplits).reduce((sum, val) => sum + (parseFloat(val) || 0), 0) === 100 ? '✓' : t('group.mustEqual100')}
                    </div>
                  </div>
                )}
                </>)}
              </div>
              {receiptMode !== 'interactive' && (
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={closeExpenseModal}>
                  {t('common.cancel')}
                </button>
                <button type="submit" className="btn btn-primary">{t('group.addExpenseBtn')}</button>
              </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Go Pay! Modal */}
      {showSettleModal && (
        <div className="modal-overlay" onClick={() => setShowSettleModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{t('group.goPayTitle')}</h3>
              <button className="modal-close" onClick={() => setShowSettleModal(false)}>×</button>
            </div>
            
            {goPayMode === 'select' ? (
              <div className="modal-body">
                {myExpenseDebts.length > 0 ? (
                  <>
                    <p style={{ marginBottom: '16px', color: 'var(--text-secondary)' }}>{t('group.yourExpenses')}</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '300px', overflowY: 'auto' }}>
                      {myExpenseDebts.map(({ expense, splitAmount, payerName, paid }) => (
                        <div 
                          key={expense.id} 
                          style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center',
                            padding: '12px',
                            background: 'var(--card-bg)',
                            borderRadius: '8px',
                            border: paid ? '1px solid var(--success, #22c55e)' : '1px solid var(--border)',
                            opacity: paid ? 0.7 : 1
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {paid && <span style={{ color: 'var(--success, #22c55e)', marginRight: '6px' }}>✅</span>}
                              {expense.description}
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                              {t('common.paidBy')} {payerName}
                            </div>
                            <div style={{ color: paid ? 'var(--success, #22c55e)' : 'var(--danger)', fontSize: '14px' }}>
                              {paid ? t('group.paid') : t('group.yourShare', { amount: formatCurrency(splitAmount) })}
                            </div>
                          </div>
                          {!paid && (
                            <button 
                              className="btn btn-primary btn-sm"
                              style={{ marginLeft: '12px' }}
                              onClick={() => { setShowSettleModal(false); openExpenseDetail(expense); }}
                            >
                              {t('common.pay')}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '20px 0' }}>
                    {t('group.noExpenseDebts')}
                  </p>
                )}
                <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                  <button 
                    className="btn btn-outline" 
                    style={{ width: '100%' }}
                    onClick={() => { setSettleUser(''); setSettleAmount(''); setGoPayMode('freeform'); }}
                  >
                    {t('group.freeFormPaymentBtn')}
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
                    {t('group.backToExpenses')}
                  </button>
                  <div className="form-group">
                    <label className="form-label">{t('group.payTo')}</label>
                    <select
                      className="form-select"
                      value={settleUser}
                      onChange={(e) => setSettleUser(e.target.value)}
                      required
                    >
                      <option value="">{t('group.selectMember')}</option>
                      {group.members?.filter(m => m.id !== user?.id).map((member) => (
                        <option key={member.id} value={member.id}>{member.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t('group.amount')}</label>
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
                    {t('common.cancel')}
                  </button>
                  <button type="submit" className="btn btn-secondary">{t('group.recordPayment')}</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Members Modal */}
      {showMemberModal && (
        <div className="modal-overlay" onClick={() => setShowMemberModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h3 className="modal-title">👥 {t('group.membersTitle')}</h3>
              <button className="modal-close" onClick={() => setShowMemberModal(false)}>×</button>
            </div>
            <div className="modal-body" style={{ padding: 0 }}>
              {memberError && (
                <div style={{ padding: '10px 16px', background: 'var(--danger)', color: 'white', fontSize: '0.85rem' }}>
                  {memberError}
                </div>
              )}
              {/* Member list */}
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {group.members?.map((member) => (
                  <li key={member.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                    <Avatar name={member.name} avatar={member.avatar} size={36} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {member.name}{member.id === user?.id ? ` (${t('group.you')})` : ''}
                        {member.id === group.created_by && (
                          <span style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: '8px', background: 'var(--primary)', color: 'var(--btn-text, white)', fontWeight: 500 }}>{t('group.creator')}</span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.email}</div>
                    </div>
                    {member.id !== user?.id ? (
                      <button
                        className="btn btn-outline btn-sm"
                        style={{ color: 'var(--danger)', borderColor: 'var(--danger)', flexShrink: 0 }}
                        onClick={() => handleRemoveMember(member.id, member.name)}
                      >
                        {t('group.remove')}
                      </button>
                    ) : (
                      <button
                        className="btn btn-outline btn-sm"
                        style={{ color: 'var(--danger)', borderColor: 'var(--danger)', flexShrink: 0 }}
                        onClick={async () => {
                          if (!confirm(t('group.leaveGroupConfirm'))) return;
                          try {
                            setMemberError('');
                            await api.removeMember(id!, member.id);
                            navigate('/');
                          } catch (err: any) {
                            setMemberError(err.message);
                          }
                        }}
                      >
                        {t('group.leave')}
                      </button>
                    )}
                  </li>
                ))}
              </ul>

              {/* Add member */}
              <form onSubmit={handleAddMember} style={{ padding: '16px', borderTop: '1px solid var(--border)' }}>
                <label className="form-label" style={{ marginBottom: '6px' }}>{t('group.addAMember')}</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select
                    className="form-select"
                    style={{ flex: 1 }}
                    value={selectedUser}
                    onChange={(e) => setSelectedUser(e.target.value)}
                    required
                  >
                    <option value="">{t('group.selectAUser')}</option>
                    {allUsers
                      .filter((u) => !group.members?.some((m) => m.id === u.id))
                      .map((u) => (
                        <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                      ))}
                  </select>
                  <button type="submit" className="btn btn-primary" disabled={!selectedUser}>{t('group.addBtn')}</button>
                </div>
              </form>
            </div>
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
                  <span>{t('group.totalAmount')}:</span>
                  <strong>{formatCurrency(selectedExpense.amount)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span>{t('group.paidByLabel')}:</span>
                  <strong style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <Avatar name={selectedExpense.paid_by_user?.name || 'Unknown'} avatar={selectedExpense.paid_by_user?.avatar} size={22} />
                    {selectedExpense.paid_by_user?.name || 'Unknown'}
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{t('group.splitType')}:</span>
                  <span>{selectedExpense.split_type}</span>
                </div>
              </div>

              {/* Split Details */}
              {selectedExpense.splits && selectedExpense.splits.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <h4 style={{ marginBottom: '8px', fontSize: '0.95rem' }}>{t('group.whoOwesWhat')}:</h4>
                  {selectedExpense.splits.map((split) => {
                    const paidBack = expensePayments
                      .filter(p => p.paid_by === split.user_id)
                      .reduce((sum, p) => sum + p.amount, 0);
                    const remaining = split.amount - paidBack;
                    return (
                      <div key={split.user_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Avatar name={split.user?.name || `User ${split.user_id}`} avatar={split.user?.avatar} size={20} />
                          {split.user?.name || `User ${split.user_id}`}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {paidBack > 0 && (
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                              {formatCurrency(split.amount)}
                            </span>
                          )}
                          <span style={{ color: remaining <= 0.01 ? 'var(--success)' : undefined, fontWeight: remaining <= 0.01 ? 600 : undefined }}>
                            {remaining <= 0.01 ? `✅ ${t('group.paidStatus')}` : formatCurrency(remaining)}
                          </span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Payment History */}
              <div style={{ marginBottom: '16px' }}>
                <h4 style={{ marginBottom: '8px', fontSize: '0.95rem' }}>
                  {t('group.paymentHistoryTitle')} {expensePayments.length > 0 && `(${expensePayments.length})`}
                </h4>
                {expensePayments.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{t('group.noPaymentsYet')}</div>
                ) : (
                  <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                    {expensePayments.map((payment) => (
                      <div key={payment.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', background: 'var(--card-bg)', borderRadius: '6px', marginBottom: '6px', border: '1px solid var(--success)' }}>
                        <div>
                          <div style={{ fontWeight: '500', display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                            <Avatar name={payment.paid_by_user?.name || '?'} avatar={payment.paid_by_user?.avatar} size={18} />
                            <span>{payment.paid_by_user?.name}</span>
                            <span>{t('group.paidAmount', { amount: formatCurrency(payment.amount) })}</span>
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
                    {t('group.everythingPaid')}
                  </div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    {t('group.mayRemoveExpense')}
                  </div>
                </div>
              )}

              {/* Make Payment Form - only show if user owes money and not fully paid */}
              {selectedExpense.paid_by !== user?.id && !isExpenseFullyPaid() && (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                  {/* Quick Pay My Share button */}
                  {selectedExpense.splits?.find(s => s.user_id === user?.id) && (() => {
                    const userSplit = selectedExpense.splits!.find(s => s.user_id === user?.id)!;
                    const paidBack = expensePayments
                      .filter(p => p.paid_by === user?.id)
                      .reduce((sum, p) => sum + p.amount, 0);
                    const remaining = userSplit.amount - paidBack;
                    return remaining > 0.01 ? (
                      <button
                        className="btn btn-primary"
                        style={{ width: '100%', marginBottom: '16px' }}
                        onClick={async () => {
                          try {
                            await api.createExpensePayment(selectedExpense.id, remaining, 'Paid my share');
                            await loadData();
                            const res = await api.getExpensePayments(selectedExpense.id);
                            setExpensePayments(res.data || []);
                          } catch (err: any) {
                            setPaymentError(err.message);
                          }
                        }}
                      >
                        {t('group.paidStatus')} ({formatCurrency(remaining)})
                      </button>
                    ) : null;
                  })()}
                  <h4 style={{ marginBottom: '12px', fontSize: '0.95rem' }}>{t('group.payBackYourShare')}</h4>
                  {paymentError && (
                    <div className="alert alert-error" style={{ marginBottom: '12px', padding: '10px', fontSize: '0.9rem' }}>
                      {paymentError}
                    </div>
                  )}
                  <form onSubmit={handleMakePayment}>
                    <div className="form-group">
                      <label className="form-label">{t('group.amount')}</label>
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
                      <label className="form-label">{t('group.noteOptional')}</label>
                      <input
                        type="text"
                        className="form-input"
                        value={paymentNote}
                        onChange={(e) => setPaymentNote(e.target.value)}
                        placeholder={t('group.notePlaceholder')}
                      />
                    </div>
                    <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                      {t('group.recordPayment')}
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
