import { useEffect, type ReactNode } from "react";
import { IconClose } from "./Icons";

interface ModalProps {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}

export default function Modal({ open, title, subtitle, onClose, children, wide }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.classList.add("modal-open");
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("modal-open");
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-ink/30 p-2 sm:items-center sm:p-4" onMouseDown={onClose} role="presentation">
      <div
        className={`flex max-h-[calc(100dvh-1rem)] w-full max-w-2xl flex-col overflow-hidden rounded-t-xl border border-line bg-surface shadow-xl sm:max-h-[calc(100dvh-2rem)] sm:rounded-xl ${wide ? "sm:max-w-4xl" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-line px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 className="text-xl font-serif font-medium text-ink">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
          </div>
          <button className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-accent" onClick={onClose} aria-label="Close dialog">
            <IconClose size={18} />
          </button>
        </header>
        <div className="modal-body min-h-0 overflow-y-auto p-4 sm:p-6">{children}</div>
      </div>
    </div>
  );
}
