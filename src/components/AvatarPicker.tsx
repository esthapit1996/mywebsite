import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import Avatar, { AVATAR_KEYS } from './Avatar';

interface AvatarPickerProps {
  currentAvatar?: string;
  userName: string;
  onClose: () => void;
  onAvatarChange: (avatar: string) => void;
}

export default function AvatarPicker({ currentAvatar, userName, onClose, onAvatarChange }: AvatarPickerProps) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState(currentAvatar || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await api.updateAvatar(selected);
      if (res.error) {
        setError(res.error);
      } else {
        onAvatarChange(selected);
        onClose();
      }
    } catch {
      setError(t('avatar.failedUpdate'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px' }}>
        <div className="modal-header">
          <h2>{t('avatar.chooseAvatar')}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {/* Current preview */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
          <Avatar name={userName} avatar={selected || undefined} size={72} />
        </div>

        {/* Initials option (no avatar) */}
        <div style={{ marginBottom: '12px' }}>
          <button
            onClick={() => setSelected('')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 12px',
              border: selected === '' ? '2px solid var(--primary)' : '2px solid transparent',
              borderRadius: '8px',
              background: 'var(--card-bg)',
              color: 'var(--text-color)',
              cursor: 'pointer',
              width: '100%',
            }}
          >
            <Avatar name={userName} size={32} />
            <span>{t('avatar.useInitials')}</span>
          </button>
        </div>

        {/* Avatar grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '10px',
          marginBottom: '16px',
        }}>
          {AVATAR_KEYS.map((key) => (
            <button
              key={key}
              onClick={() => setSelected(key)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
                padding: '10px 6px',
                border: selected === key ? '2px solid var(--primary)' : '2px solid transparent',
                borderRadius: '10px',
                background: 'var(--card-bg)',
                cursor: 'pointer',
                transition: 'border-color 0.15s',
              }}
            >
              <img
                src={`/avatars/${key}.png`}
                alt={key}
                loading="lazy"
                style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }}
              />
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                {key.replace('_', ' ')}
              </span>
            </button>
          ))}
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={saving || selected === (currentAvatar || '')}
            onClick={handleSave}
          >
            {saving ? t('avatar.saving') : t('avatar.saveAvatar')}
          </button>
        </div>
      </div>
    </div>
  );
}
