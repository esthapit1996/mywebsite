import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

export default function PaymentHistory() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const response = await api.getPaymentHistory();
      setHistory(response.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load payment history');
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = async () => {
    if (!confirm('Are you sure you want to clear your payment history? This cannot be undone.')) return;
    setClearing(true);
    try {
      await api.clearPaymentHistory();
      setHistory([]);
    } catch (err) {
      setError(err.message || 'Failed to clear history');
    } finally {
      setClearing(false);
    }
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="container">
        <div className="card text-center" style={{ padding: '60px 20px' }}>
          <div className="loading-spinner" style={{
            width: '40px',
            height: '40px',
            border: '4px solid #e2e8f0',
            borderTop: '4px solid #10b981',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }} />
          <p style={{ color: '#64748b', fontSize: '1rem' }}>Loading payment history...</p>
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

  return (
    <div className="container">
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">📜 My Payment History</h2>
          <div style={{ display: 'flex', gap: '8px' }}>
            {history.length > 0 && (
              <button 
                className="btn btn-outline btn-sm" 
                onClick={handleClearHistory}
                disabled={clearing}
                style={{ color: 'var(--error-color, #ef4444)' }}
              >
                {clearing ? 'Clearing...' : '🗑️ Clear'}
              </button>
            )}
            <Link to="/" className="btn btn-outline btn-sm">← Back</Link>
          </div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {history.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">💸</div>
            <h3>No payment history</h3>
            <p>When you send or receive payments, they'll appear here.</p>
          </div>
        ) : (
          <>
            <ul className="list">
            {history.map((item) => (
              <li key={`${item.type}-${item.id}`} className="list-item" style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                gap: '12px'
              }}>
                <div style={{ flex: 1 }}>
                  <div className="list-item-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>{item.is_payer ? '📤' : '📥'}</span>
                    <span>
                      {item.is_payer ? (
                        <>You paid <strong>{item.other_user?.name}</strong></>
                      ) : (
                        <><strong>{item.other_user?.name}</strong> paid you</>
                      )}
                    </span>
                  </div>
                  <div className="list-item-subtitle" style={{ marginTop: '4px' }}>
                    {item.group_name && <span>{item.group_name}</span>}
                    {item.description && <span> • {item.description}</span>}
                    <span style={{ marginLeft: '8px', opacity: 0.7 }}>{formatDate(item.created_at)}</span>
                  </div>
                </div>
                <span style={{ 
                  fontWeight: '600',
                  fontSize: '1.1rem',
                  color: item.is_payer ? 'var(--error-color, #ef4444)' : 'var(--success-color, #22c55e)'
                }}>
                  {item.is_payer ? '-' : '+'}€{item.amount.toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
          <div style={{ 
            padding: '12px 16px', 
            borderTop: '1px solid var(--border-color)',
            fontSize: '0.8rem',
            color: 'var(--text-muted)',
            textAlign: 'center'
          }}>
            💡 Showing last 250 transactions to keep our database small and efficient
          </div>
          </>
        )}
      </div>
    </div>
  );
}
