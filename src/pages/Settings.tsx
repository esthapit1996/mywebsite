import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import api from '../services/api';
import Avatar from '../components/Avatar';
import AvatarPicker from '../components/AvatarPicker';

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters');
      return;
    }

    if (oldPassword === newPassword) {
      setError('New password must be different from old password');
      return;
    }

    setLoading(true);
    try {
      await api.changePassword(oldPassword, newPassword, confirmPassword);
      setSuccess('Password changed successfully!');
      setTimeout(() => onClose(), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>🔒 Change Password</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Current Password</label>
            <input
              type="password"
              className="form-input"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              placeholder="Enter current password"
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">New Password</label>
            <input
              type="password"
              className="form-input"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password (min 6 chars)"
              required
              minLength={6}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Confirm New Password</label>
            <input
              type="password"
              className="form-input"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-type new password"
              required
              minLength={6}
            />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Changing...' : 'Change Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Settings() {
  const { user, refreshUser } = useAuth();
  const { currentCurrency, ratesLoading } = useCurrency();
  const navigate = useNavigate();
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);

  if (!user) return null;

  return (
    <div className="container">
      <div style={{ marginBottom: '16px' }}>
        <Link to="/" style={{ color: 'var(--primary)', textDecoration: 'none', fontSize: '0.9rem' }}>
          ← Back to Dashboard
        </Link>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">⚙️ Settings</h2>
        </div>

        <ul className="list">
          {/* Profile / Avatar */}
          <li className="list-item">
            <button
              onClick={() => setShowAvatarPicker(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px', width: '100%',
                background: 'none', border: 'none', color: 'inherit', cursor: 'pointer',
                padding: '4px 0', fontSize: '1rem', textAlign: 'left',
              }}
            >
              <Avatar name={user.name} avatar={user.avatar} size={36} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500 }}>Change Avatar</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Update your profile picture</div>
              </div>
              <span style={{ color: 'var(--text-muted)' }}>›</span>
            </button>
          </li>

          {/* Display Currency */}
          <li className="list-item">
            <button
              onClick={() => navigate('/currency-picker')}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px', width: '100%',
                background: 'none', border: 'none', color: 'inherit', cursor: 'pointer',
                padding: '4px 0', fontSize: '1rem', textAlign: 'left',
              }}
            >
              <span style={{ fontSize: '1.4rem', width: '36px', textAlign: 'center' }}>
                {ratesLoading ? '⏳' : currentCurrency.symbol}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500 }}>Display Currency</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Currently: {currentCurrency.code} ({currentCurrency.symbol})
                </div>
              </div>
              <span style={{ color: 'var(--text-muted)' }}>›</span>
            </button>
          </li>

          {/* Reset Password */}
          <li className="list-item">
            <button
              onClick={() => setShowPasswordModal(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px', width: '100%',
                background: 'none', border: 'none', color: 'inherit', cursor: 'pointer',
                padding: '4px 0', fontSize: '1rem', textAlign: 'left',
              }}
            >
              <span style={{ fontSize: '1.4rem', width: '36px', textAlign: 'center' }}>🔒</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500 }}>Reset Password</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Change your account password</div>
              </div>
              <span style={{ color: 'var(--text-muted)' }}>›</span>
            </button>
          </li>

          {/* Members (admin only) */}
          {user.email === 'evansthapit20@gmail.com' && (
            <li className="list-item">
              <button
                onClick={() => navigate('/members')}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px', width: '100%',
                  background: 'none', border: 'none', color: 'inherit', cursor: 'pointer',
                  padding: '4px 0', fontSize: '1rem', textAlign: 'left',
                }}
              >
                <span style={{ fontSize: '1.4rem', width: '36px', textAlign: 'center' }}>👥</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500 }}>Members</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Manage user accounts</div>
                </div>
                <span style={{ color: 'var(--text-muted)' }}>›</span>
              </button>
            </li>
          )}
        </ul>
      </div>

      {showPasswordModal && <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />}
      {showAvatarPicker && (
        <AvatarPicker
          currentAvatar={user.avatar}
          userName={user.name}
          onClose={() => setShowAvatarPicker(false)}
          onAvatarChange={() => refreshUser()}
        />
      )}
    </div>
  );
}
