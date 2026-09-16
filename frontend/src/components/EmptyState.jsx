import { Inbox } from 'lucide-react';

export default function EmptyState({ icon: Icon = Inbox, title = 'Aucune donnée', message = '', action }) {
  return (
    <div className="empty-state">
      <Icon size={48} strokeWidth={1.2} style={{ color: 'var(--gray-300)' }} aria-hidden="true" />
      <strong style={{ color: 'var(--gray-600)', fontSize: 'var(--font-size-base)' }}>{title}</strong>
      {message && <p>{message}</p>}
      {action}
    </div>
  );
}
