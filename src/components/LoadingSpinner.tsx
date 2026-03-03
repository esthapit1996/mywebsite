import { memo } from 'react';

interface LoadingSpinnerProps {
  message?: string;
}

function LoadingSpinner({ message }: LoadingSpinnerProps) {
  return (
    <div className="container">
      <div className="card text-center" style={{ padding: '60px 20px' }}>
        <div className="loading-spinner" />
        {message && <p style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>{message}</p>}
      </div>
    </div>
  );
}

export default memo(LoadingSpinner);
