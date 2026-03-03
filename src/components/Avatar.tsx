import { memo } from 'react';

// Avatar images served from public/avatars/ — not bundled, loaded on demand
export const AVATAR_KEYS = [
  'camel', 'cat', 'dog', 'duck', 'elephant', 'flower',
  'gopher', 'mafia_1', 'mafia_2', 'monkey', 'mouse', 'rhino',
];

function getAvatarUrl(key: string): string {
  return `/avatars/${key}.png`;
}

// Color palette for initials fallback
const COLORS = [
  '#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#1abc9c',
  '#3498db', '#9b59b6', '#e91e63', '#00bcd4', '#ff5722',
];

function getColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

/**
 * Get initials from a name:
 * - "Evan Sthapit" → "ET" (first char of first name + last char of last name)
 * - "Evan" → "EV" (first 2 chars of single name)
 * - "E" → "E" (single char)
 */
export function getInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';

  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    const first = parts[0];
    const last = parts[parts.length - 1];
    return (first[0] + last[0]).toUpperCase();
  }

  // Single name
  if (trimmed.length === 1) return trimmed.toUpperCase();
  return trimmed.substring(0, 2).toUpperCase();
}

interface AvatarProps {
  name: string;
  avatar?: string;
  size?: number;
  style?: React.CSSProperties;
}

export default memo(function Avatar({ name, avatar, size = 36, style }: AvatarProps) {
  if (avatar && AVATAR_KEYS.includes(avatar)) {
    return (
      <div
        style={{
          width: size,
          height: size,
          minWidth: size,
          minHeight: size,
          borderRadius: '50%',
          overflow: 'hidden',
          flexShrink: 0,
          ...style,
        }}
      >
        <img
          src={getAvatarUrl(avatar)}
          alt={name}
          loading="lazy"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
        />
      </div>
    );
  }

  const initials = getInitials(name);
  const bg = getColor(name);

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.4,
        fontWeight: 700,
        color: '#fff',
        flexShrink: 0,
        userSelect: 'none',
        ...style,
      }}
      title={name}
    >
      {initials}
    </div>
  );
});
