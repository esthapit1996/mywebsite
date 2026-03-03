import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import Avatar from '../components/Avatar';
import type { User } from '../types';

const TITLE_KEYS: Record<string, { key: string; emoji: string; color: string }> = {
  'evansthapit20@gmail.com': { key: 'community.founder', emoji: '👑', color: '#f59e0b' },
  'e.ivanishcheva@yandex.ru': { key: 'community.trailblazer', emoji: '🚀', color: '#8b5cf6' },
};

const DEFAULT_TITLE_KEY = { key: 'community.memberTitle', emoji: '🐹', color: 'var(--primary, #3b82f6)' };

function getTitleKey(email: string) {
  return TITLE_KEYS[email] || DEFAULT_TITLE_KEY;
}

export default function Community() {
  const { t } = useTranslation();
  const [members, setMembers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    try {
      const response = await api.getAllUsers();
      // Sort: founder first, then trailblazer, then by join date
      const sorted = (response.data || []).sort((a, b) => {
        const aTitle = TITLE_KEYS[a.email];
        const bTitle = TITLE_KEYS[b.email];
        if (aTitle?.key === 'community.founder') return -1;
        if (bTitle?.key === 'community.founder') return 1;
        if (aTitle && !bTitle) return -1;
        if (!aTitle && bTitle) return 1;
        return new Date(a.created_at || '').getTime() - new Date(b.created_at || '').getTime();
      });
      setMembers(sorted);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('community.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const formatJoinDate = (dateStr?: string) => {
    if (!dateStr) return 'Unknown';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="container">
      <div style={{ marginBottom: '16px' }}>
        <Link to="/" style={{ color: 'var(--primary)', textDecoration: 'none', fontSize: '0.9rem' }}>
          {t('common.backToDashboard')}
        </Link>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title"><span className="notranslate">🐹 GopherDebt</span> {t('community.title')}</h2>
        </div>

        <div style={{ padding: '0 16px 8px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          {t('community.subtitle', { count: members.length, memberWord: members.length === 1 ? t('community.member') : t('community.members') })}
        </div>

        {error && <div className="alert alert-error" style={{ margin: '0 16px 12px' }}>{error}</div>}

        {loading ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            {t('community.loadingCommunity')}
          </div>
        ) : members.length === 0 ? (
          <div className="empty-state" style={{ padding: '30px' }}>
            <div className="empty-state-icon">🐹</div>
            <h3>{t('community.noMembers')}</h3>
            <p>{t('community.gettingStarted')}</p>
          </div>
        ) : (
          <ul className="list">
            {members.map((member) => {
              const titleInfo = getTitleKey(member.email);
              return (
                <li key={member.id} className="list-item" style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}>
                  <Avatar name={member.name} avatar={member.avatar} size={40} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span className="notranslate" style={{ fontWeight: 600, fontSize: '1rem' }}>
                        {member.name}
                      </span>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: '12px',
                        background: `${titleInfo.color}20`,
                        color: titleInfo.color,
                        border: `1px solid ${titleInfo.color}40`,
                        whiteSpace: 'nowrap',
                      }}>
                        {titleInfo.emoji} {t(titleInfo.key)}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {t('community.joined')} {formatJoinDate(member.created_at)}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
