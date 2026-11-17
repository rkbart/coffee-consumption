import type { ReactNode } from "react";

interface PageHeaderProps {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}

export default function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <header className="mb-5 flex flex-col gap-4 sm:mb-6 md:flex-row md:items-start md:justify-between">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">{eyebrow}</p>
        <h1 className="text-2xl font-serif font-medium text-ink [overflow-wrap:anywhere]">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted">{description}</p>}
      </div>
      {actions && <div className="flex w-full flex-wrap items-center gap-2 md:w-auto md:shrink-0 md:justify-end [&>button]:min-h-11 [&>a]:min-h-11 [&>button]:max-w-full [&>a]:max-w-full">{actions}</div>}
    </header>
  );
}
