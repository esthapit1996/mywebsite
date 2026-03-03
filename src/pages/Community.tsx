import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import Avatar from '../components/Avatar';
import type { User } from '../types';

const TITLES: Record<string, { label: string; emoji: string; color: string }> = {
  'evansthapit20@gmail.com': { label: 'Founder', emoji: '👑', color: '#f59e0b' },
  'e.ivanishcheva@yandex.ru': { label: 'Trailblazer', emoji: '🚀', color: '#8b5cf6' },
};

const DEFAULT_TITLE = { label: 'Member', emoji: '🐹', color: 'var(--primary, #3b82f6)' };

function getTitle(email: string) {
  return TITLES[email] || DEFAULT_TITLE;
}

export default function Community() {
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
        const aTitle = TITLES[a.email];
        const bTitle = TITLES[b.email];
        if (aTitle?.label === 'Founder') return -1;
        if (bTitle?.label === 'Founder') return 1;
        if (aTitle && !bTitle) return -1;
        if (!aTitle && bTitle) return 1;
        return new Date(a.created_at || '').getTime() - new Date(b.created_at || '').getTime();
      });
      setMembers(sorted);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load community members');
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
          ← Back to Dashboard
        </Link>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">🐹 GopherDebt Community</h2>
        </div>

        <div style={{ padding: '0 16px 8px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          Meet the GopherDebt family — {members.length} {members.length === 1 ? 'member' : 'members'} strong!
        </div>

        {error && <div className="alert alert-error" style={{ margin: '0 16px 12px' }}>{error}</div>}

        {loading ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            Loading community...
          </div>
        ) : members.length === 0 ? (
          <div className="empty-state" style={{ padding: '30px' }}>
            <div className="empty-state-icon">🐹</div>
            <h3>No members yet</h3>
            <p>The community is just getting started!</p>
          </div>
        ) : (
          <ul className="list">
            {members.map((member) => {
              const title = getTitle(member.email);
              return (
                <li key={member.id} className="list-item" style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}>
                  <Avatar name={member.name} avatar={member.avatar} size={40} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, fontSize: '1rem' }}>
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
                        background: `${title.color}20`,
                        color: title.color,
                        border: `1px solid ${title.color}40`,
                        whiteSpace: 'nowrap',
                      }}>
                        {title.emoji} {title.label}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Joined {formatJoinDate(member.created_at)}
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
