import type { ReactNode } from "react";

interface PageHeaderProps {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}

export default function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-2 mb-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">{eyebrow}</p>
        <h1 className="text-2xl font-serif font-medium text-ink">{title}</h1>
        {description && <p className="mt-1 text-muted text-sm">{description}</p>}
      </div>
      {actions && <div className="flex items-end gap-2">{actions}</div>}
    </header>
  );
}
