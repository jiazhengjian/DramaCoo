import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description: ReactNode;
  actions?: ReactNode;
}

export default function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <header className="xyq-page-header">
      <div className="min-w-0">
        <h1 className="xyq-page-title">{title}</h1>
        <p className="xyq-page-description">{description}</p>
      </div>
      {actions && <div className="xyq-page-actions">{actions}</div>}
    </header>
  );
}
