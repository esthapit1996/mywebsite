// Icons for debt groups and GoWish shared groups (same options for both)
export const GROUP_EMOJIS = [
  '💰', '🍕', '🍔', '🍽️', '🍻', '☕',
  '✈️', '🚗', '🏨', '🏖️',
  '🏠', '🛒', '💡',
  '👨‍👩‍👧‍👦', '👥', '🎉', '💑',
  '🎬', '🎮', '🎵',
  '🏥', '🏋️',
  '🐵', '🐶', '🐱', '🐷',
  '💼', '🎓', '⚽', '🏆',
];

interface GroupEmojiPickerProps {
  value: string;
  onChange: (emoji: string) => void;
}

export default function GroupEmojiPicker({ value, onChange }: GroupEmojiPickerProps) {
  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: '8px',
      padding: '12px',
      border: '1px solid #ddd',
      borderRadius: '8px',
      maxHeight: '120px',
      overflowY: 'auto',
    }}>
      {GROUP_EMOJIS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onChange(emoji)}
          style={{
            fontSize: '1.5rem',
            padding: '8px',
            border: value === emoji ? '2px solid var(--primary)' : '2px solid transparent',
            borderRadius: '8px',
            background: value === emoji ? '#e8f5e9' : 'transparent',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
